import { isBrowser } from "../utils/runtimeContextChecker";
import { GolemWorkerBrowser } from "./worker-browser";
import { GolemWorkerNode } from "./worker-node";
const Worker = isBrowser ? GolemWorkerBrowser : GolemWorkerNode;
export { Worker };
