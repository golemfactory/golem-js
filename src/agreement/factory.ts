import { Agreement, AgreementOptions } from "./agreement";
import { Logger, defaultLogger, YagnaApi } from "../utils";
import { AgreementConfig } from "./config";
import { Events } from "../events";
import { Proposal, GolemMarketError, MarketErrorCode } from "../market";
import { withTimeout } from "../utils/timeout";

/**
 * AgreementFactory
 * @description Use {@link Agreement.create} instead
 * @internal
 */
export class AgreementFactory {
  private readonly logger: Logger;
  private readonly options: AgreementConfig;

  /**
   * Create AgreementFactory
   * @param yagnaApi - {@link YagnaApi}
   * @param agreementOptions - {@link AgreementOptions}
   */
  constructor(
    private readonly yagnaApi: YagnaApi,
    agreementOptions?: AgreementOptions,
  ) {
    this.options = new AgreementConfig(agreementOptions);
    this.logger = agreementOptions?.logger || defaultLogger("market");
  }

  /**
   * Create Agreement for given proposal ID
   *
   * @return Agreement
   */
  async create(proposal: Proposal): Promise<Agreement> {
    try {
      const agreementProposalRequest = {
        proposalId: proposal.id,
        validTo: new Date(+new Date() + 3600 * 1000).toISOString(),
      };
      const agreementId = await withTimeout(
        this.yagnaApi.market.createAgreement(agreementProposalRequest),
        this.options.agreementRequestTimeout,
      );
      if (typeof agreementId !== "string") {
        throw new GolemMarketError(
          `Unable to create agreement. Invalid response from the server`,
          MarketErrorCode.AgreementCreationFailed,
          proposal.demand,
        );
      }
      const data = await this.yagnaApi.market.getAgreement(agreementId);
      const agreement = new Agreement(agreementId, proposal, this.yagnaApi, this.options);
      this.options.eventTarget?.dispatchEvent(
        new Events.AgreementCreated({
          id: agreementId,
          provider: proposal.provider,
          validTo: data?.validTo,
          proposalId: proposal.id,
        }),
      );
      this.logger.debug(`Agreement created`, { id: agreementId });
      return agreement;
    } catch (error) {
      throw new GolemMarketError(
        `Unable to create agreement ${error?.response?.data?.message || error?.response?.data || error}`,
        MarketErrorCode.AgreementCreationFailed,
        proposal.demand,
        error,
      );
    }
  }
}
