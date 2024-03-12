import { instance, mock, reset, when } from "@johanblumenberg/ts-mockito";
import { Proposal } from "./proposal";
import {
  acceptAll,
  allowProvidersById,
  allowProvidersByNameRegex,
  disallowProvidersById,
  disallowProvidersByNameRegex,
} from "./strategy";

const mockProposal = mock(Proposal);

describe("SDK provided proposal filters", () => {
  beforeEach(() => {
    reset(mockProposal);
  });

  describe("acceptAll", () => {
    test("Accepts proposals from any provider", () => {
      when(mockProposal.provider)
        .thenReturn({
          id: "provider-1",
          name: "provider-name-1",
          walletAddress: "operator-1",
        })
        .thenReturn({
          id: "provider-2",
          name: "provider-name-2",
          walletAddress: "operator-2",
        });

      const p1 = instance(mockProposal);
      const p2 = instance(mockProposal);

      const accepted = [p1, p2].filter(acceptAll());

      expect(accepted.length).toEqual(2);
    });
  });

  describe("disallowProvidersById", () => {
    test("Accepts only the providers with the name not listed on the blacklist", () => {
      const p1 = mock(Proposal);
      const p2 = mock(Proposal);

      when(p1.provider).thenReturn({
        id: "provider-1",
        name: "provider-name-1",
        walletAddress: "operator-1",
      });

      when(p2.provider).thenReturn({
        id: "provider-2",
        name: "provider-name-2",
        walletAddress: "operator-2",
      });

      const accepted = [instance(p1), instance(p2)].filter(disallowProvidersById(["provider-1"]));

      expect(accepted.length).toEqual(1);
      expect(accepted[0].provider.id).toEqual("provider-2");
    });
  });

  describe("disallowProvidersByNameRegex", () => {
    test("Accepts only the providers which name doesn't match the specified regex", () => {
      const p1 = mock(Proposal);
      const p2 = mock(Proposal);

      when(p1.provider).thenReturn({
        id: "provider-1",
        name: "provider-name-1",
        walletAddress: "operator-1",
      });

      when(p2.provider).thenReturn({
        id: "provider-2",
        name: "golem2004",
        walletAddress: "operator-2",
      });

      const accepted = [instance(p1), instance(p2)].filter(disallowProvidersByNameRegex(/golem2004/));

      expect(accepted.length).toEqual(1);
      expect(accepted[0].provider.id).toEqual("provider-1");
    });
  });

  describe("allowProvidersById", () => {
    test("Accepts only the providers who's ID's are on the list", () => {
      const p1 = mock(Proposal);
      const p2 = mock(Proposal);

      when(p1.provider).thenReturn({
        id: "provider-1",
        name: "provider-name-1",
        walletAddress: "operator-1",
      });

      when(p2.provider).thenReturn({
        id: "provider-2",
        name: "provider-name-2",
        walletAddress: "operator-2",
      });

      const accepted = [instance(p1), instance(p2)].filter(allowProvidersById(["provider-1"]));

      expect(accepted.length).toEqual(1);
      expect(accepted[0].provider.id).toEqual("provider-1");
    });

    describe("allowProvidersByNameRegex", () => {
      test("Accepts only the providers who's names match the provided regex", () => {
        const p1 = mock(Proposal);
        const p2 = mock(Proposal);

        when(p1.provider).thenReturn({
          id: "provider-1",
          name: "provider-name-1",
          walletAddress: "operator-1",
        });

        when(p2.provider).thenReturn({
          id: "provider-2",
          name: "provider-name-2",
          walletAddress: "operator-2",
        });

        const accepted = [instance(p1), instance(p2)].filter(allowProvidersByNameRegex(/-1$/));

        expect(accepted.length).toEqual(1);
        expect(accepted[0].provider.id).toEqual("provider-1");
      });
    });
  });
});
