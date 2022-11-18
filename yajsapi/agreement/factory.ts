import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import { Agreement, AgreementState } from "./agreement";
import { AgreementConfigContainer } from "./agreement_config_container";
import { Logger, sleep } from "../utils";
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
        validTo: new Date(new Date().getUTCSeconds() + 3600).toISOString(),
      };
      const { data: agreementId } = await this.api.createAgreement(agreementProposalRequest, {
        timeout: 3000,
      });
      const agreement = new Agreement(agreementId, this.configContainer);
      let state = await agreement.getState();
      if (state === AgreementState.Proposal) await agreement.confirm();
      else {
        let timeout = false;
        setTimeout(() => (timeout = true), 10000);
        while (state !== AgreementState.Approved && !timeout) {
          state = await agreement.getState();
          if (state !== AgreementState.Pending && state !== AgreementState.Proposal) {
            throw new Error(`Agreement ${agreementId} cannot be approved. Current state: ${state}`);
          }
          await sleep(2);
        }
      }
      return agreement;
    } catch (error) {
      throw error?.response?.data?.message || error;
    }
  }
}
