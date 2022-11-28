/* eslint @typescript-eslint/ban-ts-comment: 0 */
import { AgreementPoolService } from "../../yajsapi/agreement";

const proposalIds: string[] = [];
const invalidProviderIds: string[] = [];
// @ts-ignore
export const agreementPoolServiceMock: AgreementPoolService = {
  addProposal: (proposalId: string) => {
    proposalIds.push(proposalId);
  },
  isProviderLastAgreementRejected(providerId: string): boolean {
    return invalidProviderIds.includes(providerId);
  },
  // @ts-ignore
  getProposalIds() {
    return proposalIds;
  },
  setInvalidProvider(providerId) {
    invalidProviderIds.push(providerId);
  },
};
