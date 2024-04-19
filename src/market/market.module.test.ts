import { _, deepEqual, imock, instance, mock, reset, verify, when } from "@johanblumenberg/ts-mockito";
import { YagnaApi } from "../shared/utils";
import { MarketModuleImpl } from "./market.module";
import * as YaTsClient from "ya-ts-client";
import { DemandNew } from "./demand";
import { from, of, take } from "rxjs";
import { ProposalNew } from "./proposal";

jest.useFakeTimers();

const mockYagna = mock(YagnaApi);
const mockMarket = mock(YaTsClient.MarketApi.RequestorService);
let marketModule: MarketModuleImpl;

beforeEach(() => {
  jest.resetAllMocks();
  reset(mockYagna);
  reset(mockMarket);
  when(mockYagna.market).thenReturn(instance(mockMarket));
  marketModule = new MarketModuleImpl(instance(mockYagna));
});

describe("Market module", () => {
  describe("publishDemand()", () => {
    it("should publish a demand", (done) => {
      const mockOffer = instance(imock<YaTsClient.MarketApi.DemandDTO>());
      when(mockMarket.subscribeDemand(_)).thenResolve("demand-id");
      when(mockMarket.unsubscribeDemand(_)).thenResolve({});

      const demand$ = marketModule.publishDemand(mockOffer);
      demand$.pipe(take(1)).subscribe((demand) => {
        try {
          expect(demand).toEqual(new DemandNew("demand-id", mockOffer));
          done();
        } catch (error) {
          done(error);
        }
      });
    });
    it("should emit a new demand every specified interval", (done) => {
      const mockOffer = instance(imock<YaTsClient.MarketApi.DemandDTO>());
      when(mockMarket.subscribeDemand(_))
        .thenResolve("demand-id-1")
        .thenResolve("demand-id-2")
        .thenResolve("demand-id-3");
      const mockUnsubscribe = jest.fn();
      when(mockMarket.unsubscribeDemand(_)).thenCall(mockUnsubscribe);

      const demand$ = marketModule.publishDemand(mockOffer, 10);
      const demands: DemandNew[] = [];
      demand$.pipe(take(3)).subscribe({
        next: (demand) => {
          demands.push(demand);
          jest.advanceTimersByTime(10);
        },
        complete: () => {
          try {
            expect(demands).toEqual([
              new DemandNew("demand-id-1", mockOffer),
              new DemandNew("demand-id-2", mockOffer),
              new DemandNew("demand-id-3", mockOffer),
            ]);
            expect(mockUnsubscribe).toHaveBeenCalledTimes(3);
            done();
          } catch (error) {
            done(error);
          }
        },
      });
    });
  });

  describe("subscribeForProposals()", () => {
    it("should long poll for proposals", (done) => {
      const mockDemand = instance(imock<DemandNew>());

      const mockProposal = {
        eventType: "ProposalEvent",
        eventDate: "0000-00-00",
        proposal: instance(imock<YaTsClient.MarketApi.ProposalEventDTO["proposal"]>()),
      };

      when(mockMarket.collectOffers(_)).thenResolve([mockProposal, mockProposal, mockProposal, mockProposal]);

      const proposal$ = marketModule.subscribeForProposals(mockDemand).pipe(take(8));

      let proposalsEmitted = 0;

      proposal$.subscribe({
        next: () => {
          proposalsEmitted++;
        },
        complete: () => {
          try {
            expect(proposalsEmitted).toBe(8);
            verify(mockMarket.collectOffers(_)).times(2);
            done();
          } catch (error) {
            done(error);
          }
        },
      });
    });
  });

  describe("negotiateProposal()", () => {
    it("should negotiate a proposal with the selected payment platform", async () => {
      const mockDemand = imock<DemandNew>();
      const mockOffer: YaTsClient.MarketApi.DemandOfferBaseDTO = {
        constraints: "constraints",
        properties: {
          "property-key-1": "property-value-1",
          "property-key-2": "property-value-2",
        },
      };
      const paymentPlatform = "my-selected-payment-platform";
      const mockReceivedProposal = imock<ProposalNew>();
      when(mockReceivedProposal.id).thenReturn("proposal-id");
      when(mockReceivedProposal.model).thenReturn({
        constraints: "",
        properties: {},
        proposalId: "",
        timestamp: "",
        issuerId: "issuer-id",
        state: "Initial",
      });
      when(mockReceivedProposal.demand).thenReturn(instance(mockDemand));
      when(mockDemand.id).thenReturn("demand-id");

      when(mockMarket.counterProposalDemand(_, _, _)).thenResolve("counter-id");

      when(mockMarket.getProposalOffer(_, "counter-id")).thenResolve(
        instance(imock<YaTsClient.MarketApi.ProposalEventDTO["proposal"]>()),
      );

      await marketModule.negotiateProposal(instance(mockReceivedProposal), mockOffer, paymentPlatform);

      verify(
        mockMarket.counterProposalDemand(
          "demand-id",
          "proposal-id",
          deepEqual({
            constraints: "constraints",
            properties: {
              "property-key-1": "property-value-1",
              "property-key-2": "property-value-2",
              "golem.com.payment.chosen-platform": "my-selected-payment-platform",
            },
          }),
        ),
      ).once();
    });
  });
  describe("startCollectingProposals()", () => {
    it("should negotiate any initial proposals", (done) => {
      const mockOffer = imock<YaTsClient.MarketApi.DemandDTO>();
      const proposal1 = {
        isInitial: () => true,
        isDraft: () => false,
        isValid: () => true,
      } as ProposalNew;
      const proposal2 = {
        isInitial: () => true,
        isDraft: () => false,
        isValid: () => true,
      } as ProposalNew;
      const proposal3 = {
        isInitial: () => false,
        isDraft: () => true,
        isValid: () => true,
      } as ProposalNew;
      const proposal4 = {
        isInitial: () => false,
        isDraft: () => true,
        isValid: () => true,
      } as ProposalNew;

      marketModule.publishDemand = jest.fn().mockReturnValue(of({ id: "demand-id" }));
      marketModule.negotiateProposal = jest.fn();
      marketModule.subscribeForProposals = jest
        .fn()
        .mockReturnValue(from([proposal1, proposal2, proposal3, proposal4]));

      const draftProposals: ProposalNew[] = [];
      marketModule
        .startCollectingProposals({
          demandOffer: mockOffer,
          paymentPlatform: "payment-platform",
          bufferSize: 1,
        })
        .pipe(take(2))
        .subscribe({
          next: (proposal) => {
            draftProposals.push(...proposal);
          },
          complete: () => {
            try {
              expect(draftProposals).toEqual([proposal3, proposal4]);
              expect(marketModule.negotiateProposal).toHaveBeenCalledTimes(2);
              expect(marketModule.negotiateProposal).toHaveBeenCalledWith(proposal1, mockOffer, "payment-platform");
              expect(marketModule.negotiateProposal).toHaveBeenCalledWith(proposal2, mockOffer, "payment-platform");
              done();
            } catch (error) {
              done(error);
            }
          },
        });
    });
  });
});
