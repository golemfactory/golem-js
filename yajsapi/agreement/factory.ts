import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import { Agreement } from "./agreement";
import { AgreementConfigContainer } from "./agreement_config_container";
import { Logger, dayjs } from "../utils";
import { AgreementProposal } from "./agreement_pool_service";

export class AgreementFactory {
  private readonly api: RequestorApi;
  private logger?: Logger;

  constructor(private readonly configContainer: AgreementConfigContainer) {
    this.logger = configContainer.logger;
    this.api = configContainer.api;
  }

  public async create(proposal: AgreementProposal): Promise<Agreement> {
    try {
      const agreementProposalRequest = {
        proposalId: proposal.proposalId,
        validTo: dayjs().add(3600, "second").toISOString(),
      };
      const { data: agreementId } = await this.api.createAgreement(agreementProposalRequest, {
        timeout: 3000,
      });
      const agreement = new Agreement(agreementId, this.configContainer);
      await agreement.refreshDetails();
      return agreement;
    } catch (error) {
      throw error?.response?.data?.message || error;
    }
  }
}
