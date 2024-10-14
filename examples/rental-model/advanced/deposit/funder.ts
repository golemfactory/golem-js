import { Address, createPublicClient, createWalletClient, formatEther, Hex, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { holesky } from "viem/chains";
import chalk from "chalk";
import { readFile } from "fs/promises";
import config from "./config.js";

const abiGlm = JSON.parse(await readFile("./contracts/glmAbi.json", "utf8"));
const abiLock = JSON.parse(await readFile("./contracts/lockAbi.json", "utf8"));
const funderAccount = privateKeyToAccount(<Hex>config.funder.privateKey);
const nonce = Math.floor(Math.random() * config.funder.nonceSpace);

// walletClient for writeContract functions
const walletClient = createWalletClient({
  account: funderAccount,
  chain: holesky,
  transport: http(config.rpcUrl),
});

// publicClient for readContract functions
const publicClient = createPublicClient({
  chain: holesky,
  transport: http(config.rpcUrl),
});

const LOCK_CONTRACT = {
  address: config.lockPaymentContract.holeskyAddress,
  abi: abiLock,
};
const GLM_CONTRACT = {
  address: config.glmContract.holeskyAddress,
  abi: abiGlm,
};

async function createAllowance({ budget, fee }: { budget: number; fee: number }) {
  const amountWei = parseEther(`${budget}`);
  const flatFeeAmountWei = parseEther(`${fee}`);
  const allowanceBudget = amountWei + flatFeeAmountWei;

  console.log(
    chalk.yellow(
      `\nCreating allowance of ${formatEther(allowanceBudget)} GLM for ${LOCK_CONTRACT.address} contract ...`,
    ),
  );

  const hash = await walletClient.writeContract({
    address: <Hex>GLM_CONTRACT.address,
    abi: GLM_CONTRACT.abi,
    functionName: "increaseAllowance",
    args: [LOCK_CONTRACT.address, allowanceBudget],
    chain: walletClient.chain,
    account: walletClient.account,
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
  });

  console.log(chalk.yellow(`Allowance successfully created with Tx ${receipt.transactionHash}.`));
}

async function checkAllowance() {
  const args = [config.funder.address, LOCK_CONTRACT.address];

  console.log(chalk.yellow(`\nChecking allowance for ${args[1]} contract ...`));

  const allowance = <bigint>await publicClient.readContract({
    abi: GLM_CONTRACT.abi,
    functionName: "allowance",
    address: <Hex>GLM_CONTRACT.address,
    args,
  });

  console.log(chalk.yellow(`Allowance of ${formatEther(allowance)} GLM is set.`));
}

type DepositParams = {
  address: string;
  budget: number;
  fee: number;
  expirationSec: number;
};

async function createDeposit({ address, budget, fee, expirationSec }: DepositParams) {
  const validToTimestamp = new Date().getTime() + expirationSec * 1000;
  const args = [BigInt(nonce), address, parseEther(`${budget}`), parseEther(`${fee}`), BigInt(validToTimestamp)];

  console.log(
    chalk.blueBright(
      `\nCreating deposit of amount: ${formatEther(<bigint>args[2])} GLM, flatFeeAmount: ${formatEther(<bigint>args[3])} GLM, for ${(expirationSec / 3600).toFixed(2)} hours.`,
    ),
  );
  console.log(chalk.blueBright(`Using contract at address: ${LOCK_CONTRACT.address}.`));

  const hash = await walletClient.writeContract({
    address: <Hex>LOCK_CONTRACT.address,
    abi: LOCK_CONTRACT.abi,
    functionName: "createDeposit",
    args,
    chain: walletClient.chain,
    account: walletClient.account,
  });

  await publicClient.waitForTransactionReceipt({
    hash,
  });

  console.log(chalk.blueBright(`Deposit successfully created with Tx ${hash}.`));

  const depositId = await getDepositID();
  const depositDetails = await getDepositDetails();
  return {
    id: "0x" + depositId.toString(16),
    amount: depositDetails.amount,
    contract: config.lockPaymentContract.holeskyAddress,
  };
}

async function extendDeposit({ budget, fee, expirationSec }: Partial<DepositParams> & { expirationSec: number }) {
  const validToTimestamp = new Date().getTime() + expirationSec * 1000;
  const args = [
    BigInt(nonce),
    BigInt(budget ? parseEther(`${budget}`) : 0),
    BigInt(fee ? parseEther(`${fee}`) : 0),
    BigInt(validToTimestamp),
  ];

  console.log(
    chalk.blueBright(
      `\nExtending deposit of additional amount: ${formatEther(<bigint>args[1])}  GLM, flatFeeAmount: ${formatEther(<bigint>args[2])}  GLM, for ${(expirationSec / 3600).toFixed(2)} hours.`,
    ),
  );
  console.log(chalk.blueBright(`Using contract at address: ${LOCK_CONTRACT.address}.`));

  const hash = await walletClient.writeContract({
    abi: LOCK_CONTRACT.abi,
    functionName: "extendDeposit",
    address: <Address>LOCK_CONTRACT.address,
    args,
    chain: walletClient.chain,
    account: walletClient.account,
  });

  await publicClient.waitForTransactionReceipt({
    hash,
  });

  console.log(chalk.blueBright(`Deposit successfully extended with Tx ${hash}.`));
}

async function getDepositID() {
  const depositID = <bigint>await publicClient.readContract({
    address: <Address>LOCK_CONTRACT.address,
    abi: LOCK_CONTRACT.abi,
    functionName: "idFromNonceAndFunder",
    args: [BigInt(nonce), config.funder.address],
  });

  console.log(
    chalk.blueBright(`\nDepositID: ${depositID} available on contract at address: ${LOCK_CONTRACT.address}.`),
  );
  return depositID;
}

interface DepositData {
  amount: bigint;
  id: string;
}

async function getDepositDetails() {
  const deposit = <DepositData>await publicClient.readContract({
    address: <Address>LOCK_CONTRACT.address,
    abi: LOCK_CONTRACT.abi,
    functionName: "getDepositByNonce",
    args: [BigInt(nonce), config.funder.address],
  });

  console.log(
    chalk.blueBright(`\nDeposit of `),
    deposit,
    chalk.grey(` available on contract ${LOCK_CONTRACT.address}.`),
  );
  const depositData = {
    amount: formatEther(deposit.amount),
    id: deposit.id.toString(),
    contract: LOCK_CONTRACT.address,
  };
  return depositData;
}

async function clearAllowance() {
  const args = [LOCK_CONTRACT.address, BigInt(0)];

  console.log(chalk.yellow(`\nClearing allowance for ${args[0]} contract ...`));

  const hash = await walletClient.writeContract({
    abi: GLM_CONTRACT.abi,
    functionName: "approve",
    address: <Address>GLM_CONTRACT.address,
    args,
    chain: walletClient.chain,
    account: walletClient.account,
  });

  await publicClient.waitForTransactionReceipt({
    hash,
  });

  console.log(chalk.yellow(`Allowance cleared with Tx ${hash}.\n`));
}

export default {
  createAllowance,
  checkAllowance,
  createDeposit,
  extendDeposit,
  clearAllowance,
};
