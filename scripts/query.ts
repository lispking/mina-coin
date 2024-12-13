import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '../../');
dotenvConfig({ path: resolve(projectRoot, '.env') });

import {
    PrivateKey,
    Mina,
    fetchAccount,
    Field,
    PublicKey,
    UInt64,
    AccountUpdate,
} from 'o1js';
import { CrowdFunding, DogeToken } from '../src/index.js';

const SECRET_KEY = process.env.SECRET_KEY;
if (!SECRET_KEY) {
    throw new Error("SECRET_KEY env not found");
}

const network = Mina.Network({
    mina: 'https://api.minascan.io/node/devnet/v1/graphql/',
    archive: 'https://api.minascan.io/archive/devnet/v1/graphql/'
});
Mina.setActiveInstance(network);

const deployerKey = PrivateKey.fromBase58(SECRET_KEY);
const deployer = deployerKey.toPublicKey();

const deployerAccount = await fetchAccount({ publicKey: deployer });
console.log(`Using the network ${network.getNetworkId()}`);
console.log(`Deploy wallet Address: ${deployer.toBase58()}`);
console.log(`Wallet Nonce: ${deployerAccount.account?.nonce}`);
console.log(`Wallet Balance: ${deployerAccount.account?.balance}`);

const dogeAddress = PublicKey.fromBase58('B62qm4AgjdYA2ikv3iFsGxKbA2DtSLVGEiYcreWKPXsHksjeGRJcgc3');
const dogeToken = new DogeToken(dogeAddress);
const dogeTokenId = dogeToken.deriveTokenId();
console.log(`dogeTokenId: ${dogeTokenId.toString()}`);

const zkAppAccount = PublicKey.fromBase58('B62qqGK1BtuPJKYBaw7j8mAcBtHdL2hw5JJyoCH15khMde3AgHzEASZ');
const zkApp = new CrowdFunding(zkAppAccount, dogeTokenId);
console.log(`zkApp Address: ${zkAppAccount.toBase58()}`);
console.log(`zkApp deadline: ${zkApp.getDeadline().toString()}`);
console.log(`zkApp hardCap: ${zkApp.getHardCap().toString()}`);
console.log(`zkApp fixedPrice: ${zkApp.getFixedPrice().toString()}`);
console.log(`zkApp investors: ${zkApp.getInvestor().toBase58()}`);
console.log(`zkApp balance: ${zkApp.account.balance.get().toString()}`);
