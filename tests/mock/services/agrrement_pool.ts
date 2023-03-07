/* eslint @typescript-eslint/ban-ts-comment: 0 */
import { Agreement, AgreementPoolService } from "../../../yajsapi/agreement/index.js";
import { agreementsApproved } from "../fixtures/index.js";
import { AgreementConfig } from "../../../yajsapi/agreement/config.js";

const proposalIds: string[] = [];
const invalidProviderIds: string[] = [];
const provider = { id: "test_provider_id", name: "Test Provider" };
// @ts-ignore
export const agreementPoolServiceMock: AgreementPoolService = {
  async getAgreement(): Promise<Agreement> {
    const agreementData = agreementsApproved[0];
    return new Agreement(agreementData.agreementId, provider, new AgreementConfig());
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
