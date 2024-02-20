import { GolemDeploymentBuilder } from "./deployment-builder";
import { GolemDeployment } from "./deployment";

/**
 * Represents the Golem Runtime, which manages the execution and management of Golem Workers.
 * Manages the market and payments and also stores a pool of available providers for workers' use.
 */
export class GolemRuntime {
  private deployment: GolemDeployment;

  constructor(options?: RuntimeOptions) {}

  /**
   * It publishes demand and collects available offers from the market,
   * as well as launches the necessary services to run work and process payments.
   */
  async init() {
    this.deployment = new GolemDeploymentBuilder()
      .createService("worker", {})
      .createNetwork("network", {})
      .addServiceToNetwork("worker", "network")
      .build();

    await this.deployment.start();
  }

  /**
   * Spawn a new Golem Worker.
   * Creates a new worker runtime environment on the available provider using the GolemRuntime pool.
   * @param scriptURL
   * @param options
   */
  async startWorker(scriptURL: string | URL, options?: GolemWorkerOptions): Promise<GolemWorker> {
    const activity = await this.deployment.service("worker").acquire();

    const worker = new Worker(activity, scriptURL, options);

    console.log(`GolemWorker starting on provider ${activity.info.provider.name} ...`);

    return worker;
  }

  /**
   * Terminate GolemWorker. Clears the runtime on the provider and returns it back to the GolemRuntime pool.
   * @param worker
   */
  async terminateWorker(worker: GolemWorker) {}

  /**
   * Terminates Golem's resources and processes all payments.
   */
  async end() {
    await this.deployment.stop();
  }
}

async function main() {
  const runtime = new GolemRuntime({
    market: {
      subnetTag: "public",
      imageTag: "golem/worker:latest",
      capabilities: ["gpu"],
    },
  });

  runtime.init();

  const worker = await runtime.startWorker("worker.js");
  worker.on("message", () => {
    worker.postMessage("hello");
  });

  // Sync termination
  await worker.terminate();

  await runtime.end();

  const w = new Worker("worker.js");
  w.terminate();
}
