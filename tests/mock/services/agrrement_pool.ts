/* eslint @typescript-eslint/ban-ts-comment: 0 */
import { Agreement, AgreementPoolService } from "../../../src/agreement";
import { agreementsApproved } from "../fixtures";
import { AgreementConfig } from "../../../src/agreement";
import { Proposal } from "../../../src/market";
import { YagnaMock } from "../rest/yagna";

const proposals: Proposal[] = [];
const invalidProviderIds: string[] = [];
const provider = { id: "test_provider_id", name: "Test Provider" };
const yagnaApi = new YagnaMock().getApi();
// @ts-ignore
export const agreementPoolServiceMock: AgreementPoolService = {
  async getAgreement(): Promise<Agreement> {
    const agreementData = agreementsApproved[0];
    return new Agreement(agreementData.agreementId, provider, yagnaApi, new AgreementConfig());
  },
  async addProposal(proposal: Proposal) {
    proposals.push(proposal);
  },
  async releaseAgreement(agreementId: string, allowReuse: boolean) {
    return undefined;
  },
  // @ts-ignore
  getProposals() {
    return proposals;
  },
  setInvalidProvider(providerId) {
    invalidProviderIds.push(providerId);
  },
};
