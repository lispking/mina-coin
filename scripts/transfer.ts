import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../../');
dotenvConfig({ path: resolve(projectRoot, '.env') });

import {
    PrivateKey,
    Mina,
    fetchAccount,
    UInt32,
    UInt64,
    AccountUpdate,
} from 'o1js';
import { DogeToken } from '../src/index.js';

const print = (args: any) => {
    console.log(`[${new Date().toISOString()}] ${args}`);
}

const SECRET_KEY = process.env.SECRET_KEY;
if (!SECRET_KEY) {
    throw new Error("SECRET_KEY env not found");
}

const DOGE_TOKEN_KEY = process.env.DOGE_TOKEN_KEY;
if (!DOGE_TOKEN_KEY) {
    throw new Error("DOGE_TOKEN_KEY env not found");
}

const ZK_APP_KEY = process.env.ZK_APP_KEY;
if (!ZK_APP_KEY) {
    throw new Error("ZK_APP_KEY env not found");
}

console.time('Deploy');
const network = Mina.Network({
    mina: 'https://api.minascan.io/node/devnet/v1/graphql/',
    archive: 'https://api.minascan.io/archive/devnet/v1/graphql/'
});
Mina.setActiveInstance(network);

const deployerKey = PrivateKey.fromBase58(SECRET_KEY);
const deployer = deployerKey.toPublicKey();

const deployerAccount = await fetchAccount({ publicKey: deployer });
print(`Using the network ${network.getNetworkId()}`);
print(`Deploy wallet Address: ${deployer.toBase58()}`);
print(`Wallet Nonce: ${deployerAccount.account?.nonce}`);
print(`Wallet Balance: ${deployerAccount.account?.balance}`);

console.time('Compile DogeToken');
await DogeToken.compile();
console.timeEnd('Compile DogeToken');

const config = {
    deadline: UInt32.from(1000000),
    hardCap: UInt64.from(10e9),
    fixedPrice: UInt64.from(1e9),
}

console.time('Deploy DogeToken');
const dogeTokenKey = PrivateKey.fromBase58(DOGE_TOKEN_KEY);
const dogeAddress = dogeTokenKey.toPublicKey();
const dogeToken = new DogeToken(dogeAddress);
const dogeTokenId = dogeToken.deriveTokenId();
print(`dogeAddress: ${dogeAddress.toBase58()}`);
print(`dogeTokenId: ${dogeTokenId}`);

const zkAppKey = PrivateKey.fromBase58(ZK_APP_KEY);
const zkAppAccount = zkAppKey.toPublicKey();
print(`zkAppAccount: ${zkAppAccount.toBase58()}`);

console.time('Transfer token to zkApp');
const transferAmt = config.hardCap;
const tx = await Mina.transaction({
    sender: deployer,
    fee: 0.2 * 1e9,
    memo: 'Transfer',
}, async () => {
    // AccountUpdate.fundNewAccount(deployer);
    await dogeToken.transfer(dogeAddress, zkAppAccount, transferAmt);
});
await tx.prove();
await tx.sign([deployerKey, dogeTokenKey]).send().wait();
console.timeEnd('Transfer token to zkApp');

console.log('zkAppX account\'s balance', Mina.getBalance(zkAppAccount, dogeTokenId).toString());
