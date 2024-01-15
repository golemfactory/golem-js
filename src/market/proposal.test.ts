import { Proposal as ProposalModel, ProposalAllOfStateEnum } from "ya-ts-client/dist/ya-market/src/models";
import { Proposal, ProposalProperties } from "./proposal";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api";

jest.mock("ya-ts-client/dist/ya-market/api");

const mockDemand = {
  properties: {},
  constraints: "",
};

const mockApi = new RequestorApi();

const mockCounteringProposalReference = jest.fn();

const buildTestProposal = (props: Partial<ProposalProperties>): Proposal => {
  const model: ProposalModel = {
    constraints: "",
    issuerId: "",
    proposalId: "",
    state: ProposalAllOfStateEnum.Initial,
    timestamp: "",
    properties: props,
  };

  const proposal = new Proposal(
    "example-subscriptionId",
    null,
    mockCounteringProposalReference,
    mockApi,
    model,
    mockDemand,
    "testPaymentPlatform",
  );

  return proposal;
};

describe("Proposal", () => {
  describe("Validation", () => {
    test("throws an error when linear pricing vector is missing", () => {
      expect(() =>
        buildTestProposal({
          "golem.com.usage.vector": ["golem.usage.cpu_sec", "golem.usage.duration_sec"],
        }),
      ).toThrow("Broken proposal: the `golem.com.pricing.model.linear.coeffs` does not contain pricing information");
    });

    test("throws an error when linear pricing vector is empty", () => {
      expect(() =>
        buildTestProposal({
          "golem.com.usage.vector": ["golem.usage.cpu_sec", "golem.usage.duration_sec"],
          "golem.com.pricing.model.linear.coeffs": [],
        }),
      ).toThrow("Broken proposal: the `golem.com.pricing.model.linear.coeffs` does not contain pricing information");
    });

    test("linear pricing vector has too few items", () => {
      expect(() =>
        buildTestProposal({
          "golem.com.usage.vector": ["golem.usage.cpu_sec", "golem.usage.duration_sec"],
          "golem.com.pricing.model.linear.coeffs": [1],
        }),
      ).toThrow("Broken proposal: the `golem.com.pricing.model.linear.coeffs` should contain 3 price values");
    });

    test("usage vector is empty", () => {
      expect(() =>
        buildTestProposal({
          "golem.com.usage.vector": [],
          "golem.com.pricing.model.linear.coeffs": [1, 2, 3],
        }),
      ).toThrow("Broken proposal: the `golem.com.usage.vector` does not contain price information");
    });

    test("usage vector is missing", () => {
      expect(() =>
        buildTestProposal({
          "golem.com.pricing.model.linear.coeffs": [1, 2, 3],
        }),
      ).toThrow("Broken proposal: the `golem.com.usage.vector` does not contain price information");
    });

    test("usage vector is has too few items", () => {
      expect(() =>
        buildTestProposal({
          "golem.com.usage.vector": ["golem.usage.cpu_sec"],
          "golem.com.pricing.model.linear.coeffs": [1, 2, 3],
        }),
      ).toThrow(
        "Broken proposal: the `golem.com.usage.vector` has less pricing information than `golem.com.pricing.model.linear.coeffs`",
      );
    });
  });

  describe("Extracting pricing information", () => {
    describe("positive cases", () => {
      test("it extracts the ENV and CPU prices based on the vector, and uses the last price value for START", () => {
        const proposal = buildTestProposal({
          "golem.com.usage.vector": ["golem.usage.duration_sec", "golem.usage.cpu_sec"],
          "golem.com.pricing.model.linear.coeffs": [0.01, 0.02, 0.03],
        });

        expect(proposal.pricing.envSec).toEqual(0.01);
        expect(proposal.pricing.cpuSec).toEqual(0.02);
        expect(proposal.pricing.start).toEqual(0.03);
      });

      test("flipping CPU and ENV in the vector still correctly matches to the prices on the pricing model", () => {
        const proposal = buildTestProposal({
          "golem.com.usage.vector": ["golem.usage.cpu_sec", "golem.usage.duration_sec"],
          "golem.com.pricing.model.linear.coeffs": [0.02, 0.01, 0.03],
        });

        expect(proposal.pricing.envSec).toEqual(0.01);
        expect(proposal.pricing.cpuSec).toEqual(0.02);
        expect(proposal.pricing.start).toEqual(0.03);
      });
    });
  });

  describe("Estimating cost", () => {
    test("it estimate cost based on CPU, Env and startup costs", () => {
      const proposal = buildTestProposal({
        "golem.inf.cpu.threads": 5,
        "golem.com.usage.vector": ["golem.usage.duration_sec", "golem.usage.cpu_sec"],
        "golem.com.pricing.model.linear.coeffs": [0.01, 0.02, 0.03],
      });
      expect(proposal.getEstimatedCost()).toEqual(0.14);
    });
    test("it estimate cost based on CPU, Env and startup costs if info about the number of threads is missing", () => {
      const proposal = buildTestProposal({
        "golem.com.usage.vector": ["golem.usage.duration_sec", "golem.usage.cpu_sec"],
        "golem.com.pricing.model.linear.coeffs": [0.1, 0.2, 0.3],
      });
      expect(proposal.getEstimatedCost()).toEqual(0.6);
    });
  });
});
