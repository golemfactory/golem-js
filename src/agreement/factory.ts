import { Agreement, AgreementOptions } from "./agreement";
import { Logger, defaultLogger, YagnaApi } from "../utils";
import { AgreementConfig } from "./config";
import { Events } from "../events";
import { GolemError } from "../error/golem-error";
import { ProposalProperties } from "../market/proposal";

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
    this.logger = agreementOptions?.logger || defaultLogger("golem-js:AgreementFactory");
  }

  /**
   * Create Agreement for given proposal ID
   *
   * @return Agreement
   */
  async create(proposalId: string): Promise<Agreement> {
    try {
      const agreementProposalRequest = {
        proposalId,
        validTo: new Date(+new Date() + 3600 * 1000).toISOString(),
      };
      const { data: agreementId } = await this.yagnaApi.market.createAgreement(agreementProposalRequest, {
        timeout: this.options.agreementRequestTimeout,
      });
      const { data } = await this.yagnaApi.market.getAgreement(agreementId);
      const offerProperties: ProposalProperties = data.offer.properties as ProposalProperties;
      const demandProperties: ProposalProperties = data.demand.properties as ProposalProperties;
      const chosenPaymentPlatform = demandProperties["golem.com.payment.chosen-platform"];
      const provider = {
        name: offerProperties["golem.node.id.name"],
        id: data.offer.providerId,
        walletAddress: offerProperties[`golem.com.payment.platform.${chosenPaymentPlatform}.address`] as string,
      };
      if (!provider.id || !provider.name) throw new GolemError("Unable to get provider info");
      const agreement = new Agreement(agreementId, provider, this.yagnaApi, this.options);
      this.options.eventTarget?.dispatchEvent(
        new Events.AgreementCreated({
          id: agreementId,
          provider,
          validTo: data?.validTo,
          proposalId,
        }),
      );
      this.logger.debug(`Agreement created`, { id: agreementId });
      return agreement;
    } catch (error) {
      throw new GolemError(
        `Unable to create agreement ${error?.response?.data?.message || error?.response?.data || error}`,
      );
    }
  }
}
