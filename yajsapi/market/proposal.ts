import { Proposal as ProposalModel, ProposalAllOfStateEnum } from "ya-ts-client/dist/ya-market/src/models/index.js";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api.js";
import { DemandOfferBase } from "ya-ts-client/dist/ya-market/index.js";
import { Events } from "../events/index.js";

export interface ProposalDetails {
  transferProtocol: string;
  cpuBrand: string;
  cpuCapabilities: string[];
  cpuCores: number;
  cpuThreads: number;
  memory: number;
  storage: number;
  providerName: string;
  publicNet: boolean;
  runtimeCapabilities: string[];
  runtimeName: string;
  state: ProposalAllOfStateEnum;
}

export interface ProposalDTO {
  id: string;
  issuerId: string;
  provider: { id: string; name: string };
  properties: object;
  constraints: string;
}

/**
 * Proposal module - an object representing an offer in the state of a proposal from the provider.
 * @category Mid-level
 */
export class Proposal {
  id: string;
  readonly issuerId: string;
  readonly provider: { id: string; name: string };
  readonly properties: object;
  readonly constraints: string;
  readonly timestamp: string;
  counteringProposalId: string | null;
  private readonly state: ProposalAllOfStateEnum;
  private readonly prevProposalId: string | undefined;

  /**
   * Create proposal for given subscription ID
   *
   * @param subscriptionId - subscription ID
   * @param parentId - Previous proposal ID with Initial state
   * @param setCounteringProposalReference
   * @param api - {@link RequestorApi}
   * @param model - {@link ProposalModel}
   * @param demandRequest - {@link DemandOfferBase}
   * @param eventTarget - {@link EventTarget}
   */
  constructor(
    private readonly subscriptionId: string,
    private readonly parentId: string | null,
    private readonly setCounteringProposalReference: (id: string, parentId: string) => void | null,
    private readonly api: RequestorApi,
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
    this.provider = { id: this.issuerId, name: this.details.providerName };
  }

  get details(): ProposalDetails {
    return {
      transferProtocol: this.properties["golem.activity.caps.transfer.protocol"],
      cpuBrand: this.properties["golem.inf.cpu.brand"],
      cpuCapabilities: this.properties["golem.inf.cpu.capabilities"],
      cpuCores: this.properties["golem.inf.cpu.cores"],
      cpuThreads: this.properties["golem.inf.cpu.threads"],
      memory: this.properties["golem.inf.mem.gib"],
      storage: this.properties["golem.inf.storage.gib"],
      providerName: this.properties["golem.node.id.name"],
      publicNet: this.properties["golem.node.net.is-public"],
      runtimeCapabilities: this.properties["golem.runtime.capabilities"],
      runtimeName: this.properties["golem.runtime.name"],
      state: this.state,
    };
  }
  get dto(): ProposalDTO {
    return {
      id: this.id,
      issuerId: this.issuerId,
      provider: this.provider,
      properties: this.properties,
      constraints: this.constraints,
    };
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
    this.eventTarget?.dispatchEvent(
      new Events.ProposalRejected({
        id: this.id,
        providerId: this.issuerId,
        parentId: this.id,
        reason,
      })
    );
  }

  async respond(chosenPlatform: string) {
    this.demandRequest.properties["golem.com.payment.chosen-platform"] = chosenPlatform;
    const { data: counteringProposalId } = await this.api
      .counterProposalDemand(this.subscriptionId, this.id, this.demandRequest, { timeout: 20000 })
      .catch((e) => {
        const reason = e?.response?.data?.message || e.toString();
        this.eventTarget?.dispatchEvent(
          new Events.ProposalFailed({
            id: this.id,
            providerId: this.issuerId,
            parentId: this.id,
            reason,
          })
        );
        throw new Error(reason);
      });

    if (this.setCounteringProposalReference) {
      this.setCounteringProposalReference(this.id, counteringProposalId);
    }
    this.eventTarget?.dispatchEvent(
      new Events.ProposalResponded({
        id: this.id,
        providerId: this.issuerId,
        counteringProposalId: counteringProposalId,
      })
    );
    return counteringProposalId;
  }
}
