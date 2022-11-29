import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import { Agreement, AgreementOptions } from "./agreement";
import { Logger, dayjs } from "../utils";
import { Configuration } from "ya-ts-client/dist/ya-market";
import { AgreementConfig } from "./config";

export class AgreementFactory {
  private readonly logger?: Logger;
  private readonly config: AgreementConfig;

  constructor(agreementOptions: AgreementOptions) {
    this.config = new AgreementConfig(agreementOptions);
    this.logger = agreementOptions?.logger;
  }

  async create(proposalId: string): Promise<Agreement> {
    try {
      const api = new RequestorApi(new Configuration(this.config.yagnaOptions));
      const agreementProposalRequest = {
        proposalId,
        validTo: dayjs().add(3600, "second").toISOString(),
      };
      const { data: agreementId } = await api.createAgreement(agreementProposalRequest, {
        timeout: this.config.requestTimeout,
      });
      const agreement = new Agreement(agreementId, api, this.config, this.logger);
      await agreement.refreshDetails();
      return agreement;
    } catch (error) {
      throw error?.response?.data?.message || error;
    }
  }
}
