/* eslint @typescript-eslint/ban-ts-comment: 0 */
import { Agreement, AgreementPoolService } from "../../yajsapi/agreement";
import { agreementsApproved } from "./fixtures";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import { AgreementConfig } from "../../yajsapi/agreement/config";

const proposalIds: string[] = [];
const invalidProviderIds: string[] = [];
// @ts-ignore
export const agreementPoolServiceMock: AgreementPoolService = {
  async getAgreement(): Promise<Agreement> {
    const agreementData = agreementsApproved[0];
    return new Agreement(agreementData.agreementId, {} as RequestorApi, {} as AgreementConfig);
  },
  addProposal: (proposalId: string) => {
    proposalIds.push(proposalId);
  },
  isProviderLastAgreementRejected(providerId: string): boolean {
    return invalidProviderIds.includes(providerId);
  },
  async releaseAgreement(agreementId: string, allowReuse = false) {
    return undefined;
  },
  // @ts-ignore
  getProposalIds() {
    return proposalIds;
  },
  setInvalidProvider(providerId) {
    invalidProviderIds.push(providerId);
  },
};
