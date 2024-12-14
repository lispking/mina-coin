import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../../');
dotenvConfig({ path: resolve(projectRoot, '.env') });

import {
    PrivateKey,
    Mina,
    AccountUpdate,
    fetchAccount,
} from 'o1js';
import { DogeToken } from '../src/index.js';

const logFile = fs.openSync(resolve(projectRoot, 'deploy.log'), 'a');
const print = (args: any) => {
    console.log(`[${new Date().toISOString()}] ${args}`);
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${args}\n`);
}

const SECRET_KEY = process.env.SECRET_KEY;
if (!SECRET_KEY) {
    throw new Error("SECRET_KEY env not found");
}

print('>>> Start deploy DogeToken');

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

console.time('Deploy DogeToken');
const dogeTokenKey = PrivateKey.random();
const dogeAddress = dogeTokenKey.toPublicKey();
const dogeToken = new DogeToken(dogeAddress);
const dogeTokenId = dogeToken.deriveTokenId();
print(`dogeTokenKey: ${dogeTokenKey.toBase58()}`);
print(`dogeAddress: ${dogeAddress.toBase58()}`);
print(`dogeTokenId: ${dogeTokenId.toString()}`);
let tx = await Mina.transaction({
    sender: deployer,
    fee: 0.2 * 1e9,
    memo: 'Deploy',
}, async () => {
    AccountUpdate.fundNewAccount(deployer, 2);
    await dogeToken.deploy();
});
await tx.prove();
await tx.sign([dogeTokenKey, deployerKey]).send().wait();
console.timeEnd('Deploy DogeToken');

print('>>> Deploy DogeToken done');
