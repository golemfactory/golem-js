import { Proposal as ProposalModel, ProposalAllOfStateEnum } from "ya-ts-client/dist/ya-market/src/models/index.js";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api.js";
import { DemandOfferBase } from "ya-ts-client/dist/ya-market/index.js";
import { Events } from "../events/index.js";

export interface ProposalMetadata {
  transfer_protocol: string;
  cpu_brand: string;
  cpu_capabilities: string[];
  cpu_cores: number;
  cpu_threads: number;
  mem: number;
  storage: number;
  provider_name: string;
  public_net: boolean;
  runtime_capabilities: string[];
  runtime_name: string;
}
/**
 * Proposal module - an object representing an offer in the state of a proposal from the provider.
 * @category Mid-level
 */
export class Proposal {
  id: string;
  readonly issuerId: string;
  readonly properties: object;
  readonly constraints: string;
  readonly timestamp: string;
  counteringProposalId: string | null;
  private readonly state: ProposalAllOfStateEnum;
  private readonly prevProposalId: string | undefined;
  private _score: number | null = null;

  /**
   * Create proposal for given subscription ID
   *
   * @param subscriptionId - subscription ID
   * @param parentId - Previous proposal ID with Initial state
   * @param api - {@link RequestorApi}
   * @param model - {@link ProposalModel}
   * @param demandRequest - {@link DemandOfferBase}
   * @param eventTarget - {@link EventTarget}
   */
  constructor(
    private readonly subscriptionId: string,
    private readonly parentId: string | null,
    private readonly api: RequestorApi, // TODO: why API explicitly?
    model: ProposalModel,
    private readonly demandRequest: DemandOfferBase,
    private eventTarget?: EventTarget
  ) {
    this.id = model.proposalId;
    this.issuerId = model.issuerId;
    this.properties = model.properties;
    this.constraints = model.constraints;
    this.state = model.state;
    this.prevProposalId = model.prevProposalId;
    this.timestamp = model.timestamp;
    this.counteringProposalId = null;
  }

  get metadata(): ProposalMetadata {
    return {
      transfer_protocol: this.properties["golem.activity.caps.transfer.protocol"],
      cpu_brand: this.properties["golem.inf.cpu.brand"],
      cpu_capabilities: this.properties["golem.inf.cpu.capabilities"],
      cpu_cores: this.properties["golem.inf.cpu.cores"],
      cpu_threads: this.properties["golem.inf.cpu.threads"],
      mem: this.properties["golem.inf.mem.gib"],
      storage: this.properties["golem.inf.storage.gib"],
      provider_name: this.properties["golem.node.id.name"],
      public_net: this.properties["golem.node.net.is-public"],
      runtime_capabilities: this.properties["golem.runtime.capabilities"],
      runtime_name: this.properties["golem.runtime.name"],
    };
  }

  set score(score: number | null) {
    this._score = score;
  }

  get score(): number | null {
    return this._score;
  }

  isInitial(): boolean {
    return this.state === ProposalAllOfStateEnum.Initial;
  }

  isDraft(): boolean {
    return this.state === ProposalAllOfStateEnum.Draft;
  }

  isExpired(): boolean {
    return this.state === ProposalAllOfStateEnum.Expired;
  }

  isRejected(): boolean {
    return this.state === ProposalAllOfStateEnum.Rejected;
  }

  async reject(reason = "no reason") {
    // eslint-disable-next-line @typescript-eslint/ban-types
    await this.api.rejectProposalOffer(this.subscriptionId, this.id, { message: reason as {} }).catch((e) => {
      throw new Error(e?.response?.data?.message || e);
    });
    this.eventTarget?.dispatchEvent(new Events.ProposalRejected({ id: this.id, providerId: this.issuerId }));
  }

  async respond(chosenPlatform: string) {
    this.demandRequest.properties["golem.com.payment.chosen-platform"] = chosenPlatform;
    const { data: proposalId } = await this.api
      .counterProposalDemand(this.subscriptionId, this.id, this.demandRequest, { timeout: 20000 })
      .catch((e) => {
        throw new Error(e?.response?.data?.message || e);
      });
    this.counteringProposalId = proposalId;
    this.eventTarget?.dispatchEvent(
      new Events.ProposalResponded({ id: this.id, providerId: this.issuerId, parentId: this.parentId })
    );
    return proposalId;
  }
}
