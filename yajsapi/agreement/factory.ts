import { Agreement, AgreementOptions } from "./agreement";
import { Logger } from "../utils";
import { AgreementConfig } from "./config";

export class AgreementFactory {
  private readonly logger?: Logger;
  private readonly config: AgreementConfig;

  constructor(agreementOptions?: AgreementOptions) {
    this.config = new AgreementConfig(agreementOptions);
    this.logger = agreementOptions?.logger;
  }

  async create(proposalId: string): Promise<Agreement> {
    try {
      const agreementProposalRequest = {
        proposalId,
        validTo: new Date(+new Date() + 3600).toISOString(),
      };
      const { data: agreementId } = await this.config.api.createAgreement(agreementProposalRequest, {
        timeout: this.config.requestTimeout,
      });
      const { data } = await this.config.api.getAgreement(agreementId);
      const provider = {
        name: data?.offer.properties["golem.node.id.name"],
        id: data?.offer.providerId,
      };
      if (!provider.id || !provider.name) throw new Error("Unable to get provider info");
      const agreement = new Agreement(agreementId, provider, this.config);
      this.logger?.info(`Agreement ${agreementId} created`);
      return agreement;
    } catch (error) {
      throw new Error(`Unable to create agreement ${error?.response?.data?.message || error?.response?.data || error}`);
    }
  }
}
