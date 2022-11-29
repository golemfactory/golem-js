/* eslint @typescript-eslint/ban-ts-comment: 0 */
import { Agreement, AgreementPoolService } from "../../yajsapi/agreement";
import { agreementsApproved } from "./fixtures/agreements";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api";

const proposalIds: string[] = [];
const invalidProviderIds: string[] = [];
// @ts-ignore
export const agreementPoolServiceMock: AgreementPoolService = {
  async getAgreement(): Promise<Agreement> {
    const agreementData = agreementsApproved[0];
    return new Agreement(
      agreementData.agreementId,
      { id: agreementData.offer.providerId, name: "todo" },
      {} as RequestorApi
    );
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
