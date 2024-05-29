import { Agreement, AgreementState, IAgreementApi, IAgreementRepository } from "../../../market/agreement/agreement";
import { MarketApi } from "ya-ts-client";
import { GolemMarketError, MarketErrorCode, OfferProposal } from "../../../market";
import { withTimeout } from "../../utils/timeout";
import { Logger } from "../../utils";
import { AgreementApiConfig } from "../../../market/agreement";
import { GolemUserError } from "../../error/golem-error";
import { getMessageFromApiError } from "../../utils/apiErrorMessage";

export class AgreementApiAdapter implements IAgreementApi {
  constructor(
    private readonly appSessionId: string,
    private readonly api: MarketApi.RequestorService,
    private readonly repository: IAgreementRepository,
    private readonly logger: Logger,
    private readonly config = new AgreementApiConfig(),
  ) {}

  async confirmAgreement(agreement: Agreement): Promise<Agreement> {
    try {
      await this.api.confirmAgreement(agreement.id, this.appSessionId);
      await this.api.waitForApproval(agreement.id, this.config.agreementWaitingForApprovalTimeout);
      this.logger.debug(`Agreement approved`, { id: agreement.id });

      // Get fresh copy
      return this.repository.getById(agreement.id);
      // this.events.emit("confirmed", { id: this.id, provider: this.getProviderInfo() });
    } catch (error) {
      // this.events.emit("rejected", {
      //   id: this.id,
      //   provider: this.getProviderInfo(),
      //   reason: error.toString(),
      // });
      throw new GolemMarketError(
        `Unable to confirm agreement with provider`,
        MarketErrorCode.AgreementApprovalFailed,
        error,
      );
    }
  }

  async createAgreement(proposal: OfferProposal): Promise<Agreement> {
    try {
      const agreementProposalRequest = {
        proposalId: proposal.id,
        validTo: new Date(+new Date() + 3600 * 1000).toISOString(),
      };

      const agreementId = await withTimeout(
        this.api.createAgreement(agreementProposalRequest),
        this.config.agreementRequestTimeout,
      );

      if (typeof agreementId !== "string") {
        throw new GolemMarketError(
          `Unable to create agreement. Invalid response from the server`,
          MarketErrorCode.LeaseProcessCreationFailed,
        );
      }

      this.logger.debug(`Agreement created`, {
        agreementId: agreementId,
        proposalId: proposal.id,
        demandId: proposal.demand.id,
      });

      return this.repository.getById(agreementId);
    } catch (error) {
      const message = getMessageFromApiError(error);
      throw new GolemMarketError(
        `Unable to create agreement ${message}`,
        MarketErrorCode.LeaseProcessCreationFailed,
        error,
      );
    }
  }

  async proposeAgreement(proposal: OfferProposal): Promise<Agreement> {
    const agreement = await this.createAgreement(proposal);
    const confirmed = await this.confirmAgreement(agreement);
    const state = confirmed.getState();

    if (state !== "Approved") {
      throw new GolemMarketError(
        `Agreement ${agreement.id} cannot be approved. Current state: ${state}`,
        MarketErrorCode.AgreementApprovalFailed,
      );
    }

    this.logger.info("Established agreement", { agreementId: agreement.id, provider: agreement.getProviderInfo() });

    return confirmed;
  }

  getAgreement(id: string): Promise<Agreement> {
    return this.repository.getById(id);
  }

  async getAgreementState(id: string): Promise<AgreementState> {
    const entry = await this.repository.getById(id);
    return entry.getState();
  }

  async terminateAgreement(agreement: Agreement, reason: string = "Finished"): Promise<Agreement> {
    try {
      // Re-fetch entity before acting to be sure that we don't terminate a terminated activity
      const current = await this.repository.getById(agreement.id);

      if (current.getState() === "Terminated") {
        throw new GolemUserError("You can not terminate an agreement that's already terminated");
      }

      await withTimeout(
        // TODO: Make a fix in ya-ts-client typings so that's going to be specifically {message:string}
        this.api.terminateAgreement(current.id, {
          message: reason,
        }),
        this.config.agreementRequestTimeout,
      );

      // this.events.emit("terminated", {
      //   id: this.id,
      //   provider: this.getProviderInfo(),
      //   reason: reason,
      // });

      this.logger.debug(`Agreement terminated`, { id: agreement.id, reason });

      return this.repository.getById(agreement.id);
    } catch (error) {
      const message = getMessageFromApiError(error);
      throw new GolemMarketError(
        `Unable to terminate agreement ${agreement.id}. ${message}`,
        MarketErrorCode.LeaseProcessTerminationFailed,
        error,
      );
    }
  }
}
