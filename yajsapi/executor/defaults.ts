import { dayjs } from "../utils";

export const DEFAULT_YAGNA_API_URL = "http://127.0.0.1:7465";

export const DEFAULT_EXECUTOR_OPTIONS = {
  maxWorkers: 5,
  budget: 1.0,
  subnetTag: "devnet-beta",
  payment: { driver: "erc20", network: "rinkeby" },
  timeout: dayjs.duration({ minutes: 15 }).asMilliseconds(),
};

export const DEFAULT_INVOICE_RECEIVE_TIMEOUT: number = dayjs.duration({ minutes: 5 }).asMilliseconds();
