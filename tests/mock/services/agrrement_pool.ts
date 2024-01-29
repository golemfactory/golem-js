/* eslint @typescript-eslint/ban-ts-comment: 0 */
import { Agreement, AgreementPoolService } from "../../../src/agreement";
import { agreementsApproved } from "../fixtures";
import { AgreementConfig } from "../../../src/agreement";
import { Proposal } from "../../../src/market";
import { YagnaMock } from "../rest/yagna";
import { mock, instance, when } from "@johanblumenberg/ts-mockito";

const proposals: Proposal[] = [];
const proposalMock = mock(Proposal);
const testProvider = { id: "test_provider_id", name: "Test Provider", walletAddress: "test_wallet_address" };
when(proposalMock.provider).thenReturn(testProvider);
const proposal = instance(proposalMock);
const yagnaApi = new YagnaMock().getApi();
const invalidProviderIds: string[] = [];
// @ts-ignore
export const agreementPoolServiceMock: AgreementPoolService = {
  async getAgreement(): Promise<Agreement> {
    const agreementData = agreementsApproved[0];
    return new Agreement(agreementData.agreementId, proposal, yagnaApi, new AgreementConfig());
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
