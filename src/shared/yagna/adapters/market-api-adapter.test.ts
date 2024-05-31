import { _, deepEqual, imock, instance, mock, reset, verify, when } from "@johanblumenberg/ts-mockito";
import * as YaTsClient from "ya-ts-client";
import { YagnaAgreementOperationEvent, YagnaApi } from "../yagnaApi";
import { DemandRequestBody, MarketApiAdapter } from "./market-api-adapter";
import { Demand, DemandSpecification, OfferProposal } from "../../../market";
import { Subject, take } from "rxjs";
import { Logger } from "../../utils";
import { DemandBodyPrototype } from "../../../market/demand";
import { IAgreementRepository } from "../../../market/agreement/agreement";
import { IProposalRepository } from "../../../market/offer-proposal";

const mockLogger = imock<Logger>();
const mockMarket = mock(YaTsClient.MarketApi.RequestorService);
const mockYagna = mock(YagnaApi);
const mockAgreementRepo = imock<IAgreementRepository>();
const mockProposalRepo = imock<IProposalRepository>();

/** Test subject mocking the one exposed by YagnaApi */
const agreementEvents$ = new Subject<YagnaAgreementOperationEvent>();

/** Global instance of the system under test */
let api: MarketApiAdapter;

jest.useFakeTimers();

beforeEach(() => {
  reset(mockYagna);
  reset(mockMarket);

  when(mockYagna.market).thenReturn(instance(mockMarket));
  when(mockYagna.agreementEvents$).thenReturn(agreementEvents$);

  api = new MarketApiAdapter(
    instance(mockYagna),
    instance(mockAgreementRepo),
    instance(mockProposalRepo),
    instance(mockLogger),
  );
});

describe("Market API Adapter", () => {
  const samplePrototype: DemandBodyPrototype = {
    constraints: ["constraints"],
    properties: [
      {
        key: "golem.com.usage.vector",
        value: ["golem.usage.duration_sec", "golem.usage.cpu_sec"],
      },
      {
        key: "golem.com.pricing.model.linear.coeffs",
        value: [0.1, 0.1],
      },
      {
        key: "property-key-1",
        value: "property-value-1",
      },
      {
        key: "property-key-2",
        value: "property-value-2",
      },
    ],
  };

  const expectedBody: DemandRequestBody = {
    constraints: "constraints",
    properties: {
      "golem.com.usage.vector": ["golem.usage.duration_sec", "golem.usage.cpu_sec"],
      "golem.com.pricing.model.linear.coeffs": [0.1, 0.1],
      "property-key-1": "property-value-1",
      "property-key-2": "property-value-2",
    },
  };

  describe("publishDemandSpecification()", () => {
    it("should publish a demand", async () => {
      const specification = new DemandSpecification(samplePrototype, "my-selected-payment-platform", 60 * 60 * 1000);

      when(mockMarket.subscribeDemand(deepEqual(expectedBody))).thenResolve("demand-id");

      const demand = await api.publishDemandSpecification(specification);

      verify(mockMarket.subscribeDemand(deepEqual(expectedBody))).once();
      expect(demand).toBeInstanceOf(Demand);
      expect(demand.id).toBe("demand-id");
      expect(demand.details).toBe(specification);
    });

    it("should throw an error if the demand is not published", async () => {
      const specification = new DemandSpecification(samplePrototype, "my-selected-payment-platform", 60 * 60 * 1000);

      when(mockMarket.subscribeDemand(deepEqual(expectedBody))).thenResolve({
        message: "error publishing demand",
      });

      await expect(api.publishDemandSpecification(specification)).rejects.toThrow(
        "Failed to subscribe to demand: error publishing demand",
      );
    });
  });

  describe("unpublishDemand()", () => {
    it("should unpublish a demand", async () => {
      const demand = new Demand(
        "demand-id",
        new DemandSpecification(samplePrototype, "my-selected-payment-platform", 60 * 60 * 1000),
      );

      when(mockMarket.unsubscribeDemand("demand-id")).thenResolve({});

      await api.unpublishDemand(demand);

      verify(mockMarket.unsubscribeDemand("demand-id")).once();
    });

    it("should throw an error if the demand is not unpublished", async () => {
      const demand = new Demand(
        "demand-id",
        new DemandSpecification(samplePrototype, "my-selected-payment-platform", 60 * 60 * 1000),
      );

      when(mockMarket.unsubscribeDemand("demand-id")).thenResolve({
        message: "error unpublishing demand",
      });

      await expect(api.unpublishDemand(demand)).rejects.toThrow(
        "Failed to unsubscribe from demand: error unpublishing demand",
      );
    });
  });

  describe("counterProposal()", () => {
    it("should negotiate a proposal with the selected payment platform", async () => {
      const specification = new DemandSpecification(samplePrototype, "my-selected-payment-platform", 60 * 60 * 1000);

      const receivedProposal = new OfferProposal(
        {
          ...expectedBody,
          proposalId: "proposal-id",
          timestamp: "0000-00-00",
          issuerId: "issuer-id",
          state: "Initial",
        },
        "Provider",
        new Demand("demand-id", specification),
      );

      when(mockMarket.counterProposalDemand(_, _, _)).thenResolve("counter-id");

      when(mockMarket.getProposalOffer("demand-id", "counter-id")).thenResolve({
        ...expectedBody,
        proposalId: "counter-id",
        timestamp: "0000-00-00",
        issuerId: "issuer-id",
        state: "Draft",
      });

      await api.counterProposal(receivedProposal, specification);

      verify(
        mockMarket.counterProposalDemand(
          "demand-id",
          "proposal-id",
          deepEqual({
            constraints: expectedBody.constraints,
            properties: {
              ...expectedBody.properties,
              "golem.com.payment.chosen-platform": "my-selected-payment-platform",
            },
          }),
        ),
      ).once();
    });
    it("should throw an error if the counter proposal fails", async () => {
      const specification = new DemandSpecification(samplePrototype, "my-selected-payment-platform", 60 * 60 * 1000);
      const receivedProposal = new OfferProposal(
        {
          ...expectedBody,
          proposalId: "proposal-id",
          timestamp: "0000-00-00",
          issuerId: "issuer-id",
          state: "Initial",
        },
        "Provider",
        new Demand("demand-id", specification),
      );

      when(mockMarket.counterProposalDemand(_, _, _)).thenResolve({
        message: "error counter proposing",
      });

      await expect(api.counterProposal(receivedProposal, specification)).rejects.toThrow(
        "Counter proposal failed error counter proposing",
      );
    });
  });

  describe("observeDemandResponse()", () => {
    it("should long poll for proposals", (done) => {
      const mockDemand = mock(Demand);
      when(mockDemand.id).thenReturn("demand-id");
      const mockProposalDTO = imock<YaTsClient.MarketApi.ProposalEventDTO["proposal"]>();
      when(mockProposalDTO.issuerId).thenReturn("issuer-id");
      when(mockProposalDTO.properties).thenReturn({
        "golem.com.usage.vector": ["golem.usage.cpu_sec", "golem.usage.duration_sec"],
        "golem.com.pricing.model.linear.coeffs": [0.0001, 0.00005, 0],
      });
      const mockProposalEvent: YaTsClient.MarketApi.ProposalEventDTO = {
        eventType: "ProposalEvent",
        eventDate: "0000-00-00",
        proposal: instance(mockProposalDTO),
      };

      when(mockMarket.collectOffers("demand-id")).thenResolve([mockProposalEvent, mockProposalEvent]);

      const proposal$ = api.observeDemandResponse(instance(mockDemand)).pipe(take(4));

      let proposalsEmitted = 0;

      proposal$.subscribe({
        error: (error) => {
          done(error);
        },
        next: () => {
          proposalsEmitted++;
        },
        complete: () => {
          try {
            expect(proposalsEmitted).toBe(4);
            verify(mockMarket.collectOffers("demand-id")).twice();
            done();
          } catch (error) {
            done(error);
          }
        },
      });
    });
  });
});
