import { Address, createPublicClient, decodeFunctionData, Hex, http, Log, parseAbi } from "viem";
import config from "./config.js";
import { holesky } from "viem/chains";
import { readFile } from "fs/promises";
import chalk from "chalk";

const abiLock = JSON.parse(await readFile("./contracts/lockAbi.json", "utf8"));

const publicClient = createPublicClient({
  chain: holesky,
  transport: http(config.rpcUrl),
});

async function checkIsDopositClosed(spenderAddress: Address, funderAddress: Address, logs: Log[]) {
  for (const log of logs) {
    if (!log.transactionHash) return false;
    const transaction = await publicClient.getTransaction({ hash: <Hex>log.transactionHash });
    const parsedMethod = decodeFunctionData({
      abi: abiLock,
      data: transaction.input,
    });
    const functionNamePlusArgs = `${parsedMethod.functionName}(${parsedMethod.args.join(",")})`;
    console.log(chalk.magenta("\ncall:", functionNamePlusArgs));
    console.log(chalk.magenta("event:"), log["eventName"]);
    console.log(chalk.magenta("from:"), transaction.from);
    console.log(chalk.magenta("hash:"), transaction.hash, "\n");
    const functionName = parsedMethod.functionName.toLowerCase();
    // if deposit is closed by spender (requestor), stop observing
    if (functionName.includes("close") && transaction.from === spenderAddress) {
      console.log(chalk.grey(`Deposit has been closed by spender.`));
      return true;
    }
    // if deposit is terminated by spender (requestor), stop observing
    if (functionName === "terminatedeposit" && transaction.from === funderAddress) {
      console.log(chalk.grey(`Deposit has been terminated by spender.`));
      return true;
    }
  }
  return false;
}

async function startWatchingContractTransactions(address: string) {
  const spenderAddress = <Address>address;
  const funderAddress = <Address>config.funder.address;
  let isDepositClosed = false;

  const stopWatchingContractTransactions = publicClient.watchEvent({
    onLogs: async (logs) => (isDepositClosed = await checkIsDopositClosed(spenderAddress, funderAddress, logs)),
    events: parseAbi([
      "event DepositCreated(uint256 indexed id, address spender)",
      "event DepositClosed(uint256 indexed id, address spender)",
      "event DepositExtended(uint256 indexed id, address spender)",
      "event DepositFeeTransfer(uint256 indexed id, address spender, uint128 amount)",
      "event DepositTerminated(uint256 indexed id, address spender)",
      "event DepositTransfer(uint256 indexed id, address spender, address recipient, uint128 amount)",
    ]),
    address: <Address>config.lockPaymentContract.holeskyAddress,
  });
  return {
    stopWatchingContractTransactions,
    isDepositClosed: () => isDepositClosed,
  };
}

export default {
  startWatchingContractTransactions,
};
