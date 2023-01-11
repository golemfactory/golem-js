import { Agreement, AgreementOptions } from "./agreement";
import { Logger } from "../utils";
import { AgreementConfig } from "./config";
import { Events } from "../events";

/**
 * AgreementFactory
 * @description Use {@link Agreement.create} instead
 * @ignore
 */
export class AgreementFactory {
  private readonly logger?: Logger;
  private readonly options: AgreementConfig;

  /**
   * Create AgreementFactory
   * @param agreementOptions - {@link AgreementOptions}
   */
  constructor(agreementOptions?: AgreementOptions) {
    this.options = new AgreementConfig(agreementOptions);
    this.logger = agreementOptions?.logger;
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
        validTo: new Date(+new Date() + 3600).toISOString(),
      };
      const { data: agreementId } = await this.options.api.createAgreement(agreementProposalRequest, {
        timeout: this.options.requestTimeout,
      });
      const { data } = await this.options.api.getAgreement(agreementId);
      const provider = {
        name: data?.offer.properties["golem.node.id.name"],
        id: data?.offer.providerId,
      };
      if (!provider.id || !provider.name) throw new Error("Unable to get provider info");
      const agreement = new Agreement(agreementId, provider, this.options);
      this.options.eventTarget?.dispatchEvent(
        new Events.AgreementCreated({
          id: agreementId,
          providerId: provider.id,
          providerName: provider.name,
          proposalId,
        })
      );
      this.logger?.info(`Agreement ${agreementId} created`);
      return agreement;
    } catch (error) {
      throw new Error(`Unable to create agreement ${error?.response?.data?.message || error?.response?.data || error}`);
    }
  }
}
