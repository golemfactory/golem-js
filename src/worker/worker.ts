import { isBrowser } from "../utils/runtimeContextChecker";
import { GolemWorkerBrowser } from "./worker-browser";
import { GolemWorkerNode } from "./worker-node";
const GolemWorker = isBrowser ? GolemWorkerBrowser : GolemWorkerNode;
export { GolemWorker };
