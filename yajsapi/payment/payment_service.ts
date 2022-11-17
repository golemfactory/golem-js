import {
  RequestorApi,
  Configuration,
  Allocation as AllocationModel,
  MarketDecoration,
} from "ya-ts-client/dist/ya-payment";
import { Logger } from "../utils";
import { Allocation } from "./allocation";
import { EventBus } from "../events/event_bus";

export class PaymentService {
  private readonly api: RequestorApi;

  constructor(
    private readonly yagnaOptions: { apiKey?: string; basePath?: string },
    private readonly eventBus: EventBus,
    private readonly logger?: Logger
  ) {
    const apiConfig = new Configuration({
      apiKey: yagnaOptions.apiKey,
      basePath: yagnaOptions.basePath,
      accessToken: yagnaOptions.apiKey,
    });
    this.api = new RequestorApi(apiConfig);
  }
  async run() {
    this.logger?.info("The Payment Service has started");
  }

  async getDemandDecoration({ budget, paymentNetwork, paymentDriver }): Promise<MarketDecoration> {
    const { data: existingAllocations } = await this.api.getAllocations();
    // TODO: how to filter existing allocations? by budget?
    const availableAllocations = existingAllocations.filter((a) => parseFloat(a.remainingAmount) >= budget);
    const allocations = availableAllocations || (await this.createAllocations(budget, paymentNetwork, paymentDriver));
    const allocationIds = allocations.map((a) => a.allocationId);
    const { data: decorations } = await this.api.getDemandDecorations(allocationIds);
    return decorations;
  }

  // TODO
  async end() {
    const { data: models } = await this.api.getAllocations();
    const allocations = models.map((model) => new Allocation(this.api, model));
    for (const allocation of allocations) await allocation.releaseAllocation();
  }

  private async createAllocations(budget, paymentNetwork: string, paymentDriver: string): Promise<Allocation[]> {
    // todo: get accounts details and validate if exists
    const model: AllocationModel = {
      totalAmount: budget,
      makeDeposit: false,
      remainingAmount: "",
      spentAmount: "",
      timestamp: "",
      allocationId: "",
    };
    const { data: newModel } = await this.api.createAllocation(model);
    return [new Allocation(this.api, newModel)];
  }

  acceptPayments(id: string) {
    // todo
  }
}
