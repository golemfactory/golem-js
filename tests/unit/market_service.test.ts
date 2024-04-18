describe("Market Service", () => {
  it.todo("TODO");
});
// import { AgreementPoolService, Allocation, MarketService, Package, YagnaApi } from "../../src";
// import {
//   proposalsDraft,
//   proposalsInitial,
//   proposalsShortDebitNoteTimeout,
//   proposalsWrongPaymentPlatform,
// } from "../fixtures";
// import { anything, instance, mock, reset, verify, when } from "@johanblumenberg/ts-mockito";
// import { LoggerMock } from "../mock/utils/logger";
// import * as YaTsClient from "ya-ts-client";
//
// import { simulateLongPoll } from "./helpers";
//
// const logger = new LoggerMock();
//
// const mockYagna = mock(YagnaApi);
// const mockPayment = mock(YaTsClient.PaymentApi.RequestorService);
// const mockMarket = mock(YaTsClient.MarketApi.RequestorService);
// const mockAgreementPoolService = mock(AgreementPoolService);
// const mockPackage = mock(Package);
// const mockAllocation = mock(Allocation);
//
// const yagnaApi = instance(mockYagna);
//
// describe("Market Service", () => {
//   beforeEach(() => {
//     logger.clear();
//
//     const someDecoration: YaTsClient.PaymentApi.MarketDecorationDTO = {
//       properties: [{ key: "", value: "" }],
//       constraints: [],
//     };
//
//     reset(mockYagna);
//     reset(mockPayment);
//     reset(mockMarket);
//     reset(mockAgreementPoolService);
//     reset(mockPayment);
//     reset(mockAllocation);
//
//     when(mockYagna.market).thenReturn(instance(mockMarket));
//     when(mockYagna.payment).thenReturn(instance(mockPayment));
//
//     when(mockPackage.getDemandDecoration()).thenResolve(someDecoration);
//
//     when(mockAllocation.getDemandDecoration()).thenResolve(someDecoration);
//     when(mockAllocation.paymentPlatform).thenReturn("erc20-holesky-tglm");
//
//     when(mockPayment.getDemandDecorations(anything())).thenResolve(someDecoration);
//
//     when(mockMarket.subscribeDemand(anything())).thenResolve("demand-id");
//   });
//
//   it("should respond initial proposal", async () => {
//     const marketService = new MarketService(instance(mockAgreementPoolService), yagnaApi, {
//       logger,
//       minProposalsBatchSize: 1,
//       proposalsBatchReleaseTimeoutMs: 10,
//     });
//
//     when(mockMarket.collectOffers("demand-id", anything(), anything()))
//       .thenCall(() => simulateLongPoll(proposalsInitial))
//       .thenCall(() => simulateLongPoll([]));
//
//     await marketService.run(instance(mockPackage), instance(mockAllocation));
//
//     await logger.expectToInclude("Proposal has been responded", { id: expect.anything() }, 100);
//
//     await marketService.end();
//   });
//
//   it("should add draft proposal to agreement pool", async () => {
//     const marketService = new MarketService(instance(mockAgreementPoolService), yagnaApi, { logger });
//
//     when(mockMarket.collectOffers("demand-id", anything(), anything()))
//       .thenCall(() => simulateLongPoll(proposalsDraft))
//       .thenCall(() => simulateLongPoll([]));
//
//     await marketService.run(instance(mockPackage), instance(mockAllocation));
//
//     await logger.expectToInclude("Proposal has been confirmed and added to agreement pool", expect.anything(), 100);
//
//     verify(mockAgreementPoolService.addProposal(anything())).times(proposalsDraft.length);
//
//     await marketService.end();
//   });
//
//   it("should reject initial proposal without common payment platform", async () => {
//     const marketService = new MarketService(instance(mockAgreementPoolService), yagnaApi, {
//       logger,
//       minProposalsBatchSize: 1,
//       proposalsBatchReleaseTimeoutMs: 10,
//     });
//
//     when(mockMarket.collectOffers("demand-id", anything(), anything()))
//       .thenCall(() => simulateLongPoll([proposalsInitial[6]]))
//       .thenCall(() => simulateLongPoll([]));
//
//     await marketService.run(instance(mockPackage), instance(mockAllocation));
//
//     await logger.expectToInclude(
//       "Proposal has been rejected",
//       {
//         reason: "No common payment platform",
//         id: expect.anything(),
//       },
//       100,
//     );
//     await marketService.end();
//   });
//
//   it("should reject when no common payment platform", async () => {
//     const marketService = new MarketService(instance(mockAgreementPoolService), yagnaApi, {
//       logger,
//       minProposalsBatchSize: 1,
//       proposalsBatchReleaseTimeoutMs: 10,
//     });
//
//     when(mockMarket.collectOffers("demand-id", anything(), anything()))
//       .thenCall(() => simulateLongPoll(proposalsWrongPaymentPlatform))
//       .thenCall(() => simulateLongPoll([]));
//
//     await marketService.run(instance(mockPackage), instance(mockAllocation));
//
//     await logger.expectToMatch(/No common payment platform/, 100);
//     await marketService.end();
//   });
//
//   it("should reject initial proposal when debit note acceptance timeout too short", async () => {
//     const marketService = new MarketService(instance(mockAgreementPoolService), yagnaApi, {
//       logger,
//       minProposalsBatchSize: 1,
//       proposalsBatchReleaseTimeoutMs: 10,
//     });
//
//     when(mockMarket.collectOffers("demand-id", anything(), anything()))
//       .thenCall(() => simulateLongPoll(proposalsShortDebitNoteTimeout))
//       .thenCall(() => simulateLongPoll([]));
//
//     await marketService.run(instance(mockPackage), instance(mockAllocation));
//
//     await logger.expectToMatch(/Debit note acceptance timeout too short/, 100);
//     await marketService.end();
//   });
//
//   it("should reject when proposal rejected by any Proposal Filter", async () => {
//     const proposalAlwaysBanFilter = () => false;
//     const marketService = new MarketService(instance(mockAgreementPoolService), yagnaApi, {
//       logger,
//       proposalFilter: proposalAlwaysBanFilter,
//       minProposalsBatchSize: 1,
//       proposalsBatchReleaseTimeoutMs: 10,
//     });
//
//     when(mockMarket.collectOffers("demand-id", anything(), anything()))
//       .thenCall(() => simulateLongPoll(proposalsInitial))
//       .thenCall(() => simulateLongPoll([]));
//
//     await marketService.run(instance(mockPackage), instance(mockAllocation));
//
//     await logger.expectToMatch(/Proposal rejected by Proposal Filter/, 100);
//     await marketService.end();
//   });
// });
