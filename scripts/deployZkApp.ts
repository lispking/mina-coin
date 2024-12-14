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
    UInt64,
    UInt32,
} from 'o1js';
import { CrowdFunding, DogeToken } from '../src/index.js';

const logFile = fs.openSync(resolve(projectRoot, 'deploy.log'), 'a');
const print = (args: any) => {
    console.log(`[${new Date().toISOString()}] ${args}`);
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${args}\n`);
}

const SECRET_KEY = process.env.SECRET_KEY;
if (!SECRET_KEY) {
    throw new Error("SECRET_KEY env not found");
}

const DOGE_TOKEN_KEY = process.env.DOGE_TOKEN_KEY;
if (!DOGE_TOKEN_KEY) {
    throw new Error("DOGE_TOKEN_KEY env not found");
}

print('>>> Start deploy zkApp');

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

const dogeTokenKey = PrivateKey.fromBase58(DOGE_TOKEN_KEY);
const dogeAddress = dogeTokenKey.toPublicKey();
const dogeToken = new DogeToken(dogeAddress);
const dogeTokenId = dogeToken.deriveTokenId();
print(`dogeTokenKey: ${dogeTokenKey.toBase58()}`);
print(`dogeAddress: ${dogeAddress.toBase58()}`);
print(`dogeTokenId: ${dogeTokenId.toString()}`);

console.time('Compile CrowdFunding');
await CrowdFunding.compile();
console.timeEnd('Compile CrowdFunding');

const zkAppKey = PrivateKey.random();
const zkAppAccount = zkAppKey.toPublicKey();
const zkApp = new CrowdFunding(zkAppAccount, dogeTokenId);
print(`zkAppKey: ${zkAppKey.toBase58()}`);
print(`zkAppAccount: ${zkAppAccount.toBase58()}`);

const config = {
    deadline: UInt32.from(1000000),
    hardCap: UInt64.from(10e9),
    fixedPrice: UInt64.from(1e9),
}

console.time('Deploy CrowdFunding');
let tx = await Mina.transaction({
    sender: deployer,
    fee: 0.2 * 1e9,
    memo: 'Deploy',
}, async () => {
    AccountUpdate.fundNewAccount(deployer);
    await zkApp.deploy({
        verificationKey: undefined,
        ...config,
    });
    await dogeToken.approveAccountUpdate(zkApp.self);
});
await tx.prove();
await tx.sign([deployerKey, zkAppKey]).send().wait();
console.timeEnd('Deploy CrowdFunding');

console.time('Transfer token to zkApp');
tx = await Mina.transaction({
    sender: deployer,
    fee: 0.2 * 1e9,
    memo: 'Transfer',
}, async () => {
    AccountUpdate.fundNewAccount(deployer);
    await dogeToken.transfer(dogeAddress, zkAppAccount, config.hardCap);
});
await tx.prove();
await tx.sign([dogeTokenKey, deployerKey]).send().wait();
console.timeEnd('Transfer token to zkApp');

console.timeEnd('Deploy');
print('>>> Deploy zkApp done');
