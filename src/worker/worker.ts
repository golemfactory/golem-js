// import { isBrowser } from "../utils/runtimeContextChecker";
// import { GolemWorkerBrowser } from "./worker-browser";
import { GolemWorkerNode } from "./worker-node";
// export default { GolemWorker: isBrowser ? GolemWorkerBrowser : GolemWorkerNode };
export { GolemWorkerNode as GolemWorker };
