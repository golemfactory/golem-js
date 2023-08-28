import { Proposal as ProposalModel, ProposalAllOfStateEnum } from "ya-ts-client/dist/ya-market/src/models";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import { DemandOfferBase } from "ya-ts-client/dist/ya-market";
import { Events } from "../events";

type ProposalProperties = Record<string, string | number | string[] | number[] | boolean> & {
  "golem.activity.caps.transfer.protocol": string[];
  "golem.com.payment.debit-notes.accept-timeout?": number;
  "golem.com.payment.platform.erc20-goerli-tglm.address": string;
  "golem.com.payment.platform.erc20-mumbai-tglm.address": string;
  "golem.com.payment.platform.erc20-rinkeby-tglm.address": string;
  "golem.com.payment.platform.zksync-rinkeby-tglm.address": string;
  "golem.com.pricing.model": "linear";
  "golem.com.pricing.model.linear.coeffs": number[];
  "golem.com.scheme": string;
  "golem.com.scheme.payu.debit-note.interval-sec?"?: number;
  "golem.com.scheme.payu.payment-timeout-sec?"?: number;
  "golem.com.usage.vector": string[];
  "golem.inf.cpu.architecture": string;
  "golem.inf.cpu.brand": string;
  "golem.inf.cpu.capabilities": string[];
  "golem.inf.cpu.cores": number;
  "golem.inf.cpu.model": string;
  "golem.inf.cpu.threads": number;
  "golem.inf.cpu.vendor": string[];
  "golem.inf.mem.gib": number;
  "golem.inf.storage.gib": number;
  "golem.node.debug.subnet": string;
  "golem.node.id.name": string;
  "golem.node.net.is-public": boolean;
  "golem.runtime.capabilities": string[];
  "golem.runtime.name": string;
  "golem.runtime.version": string;
  "golem.srv.caps.multi-activity": boolean;
  "golem.srv.caps.payload-manifest": boolean;
};

export interface ProposalDetails {
  transferProtocol: string[];
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
  properties: ProposalProperties;
  constraints: string;
}

/**
 * Proposal module - an object representing an offer in the state of a proposal from the provider.
 * @hidden
 */
export class Proposal {
  id: string;
  readonly issuerId: string;
  readonly provider: { id: string; name: string };
  readonly properties: ProposalProperties;
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
    private eventTarget?: EventTarget,
  ) {
    this.id = model.proposalId;
    this.issuerId = model.issuerId;
    this.properties = model.properties as ProposalProperties;
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
      }),
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
          }),
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
      }),
    );
    return counteringProposalId;
  }

  hasPaymentPlatform(paymentPlatform: string): boolean {
    return this.getProviderPaymentPlatforms().includes(paymentPlatform);
  }

  private getProviderPaymentPlatforms(): string[] {
    return (
      Object.keys(this.properties)
        .filter((prop) => prop.startsWith("golem.com.payment.platform."))
        .map((prop) => prop.split(".")[4]) || []
    );
  }
}
