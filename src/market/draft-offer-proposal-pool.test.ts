import { DraftOfferProposalPool } from "./draft-offer-proposal-pool";
import { instance, mock, when } from "@johanblumenberg/ts-mockito";
import { OfferProposal } from "./index";

describe("Draft Offer Proposal Pool", () => {
  // GIVEN
  const mockProposal = mock(OfferProposal);
  // Most of the time we're testing the case when the Proposal is in `Draft` status
  when(mockProposal.isDraft()).thenReturn(true);

  // NOTE: ts-mockito instance + JS Set.add() doesn't play along, 2x instance(mockProposal) produces "the same" value for (Set.add)

  const secondMockProposal = mock(OfferProposal);
  // Most of the time we're testing the case when the Proposal is in `Draft` status
  when(secondMockProposal.isDraft()).thenReturn(true);

  describe("Adding proposals", () => {
    describe("Positive cases", () => {
      it("It's not possible to add the same proposal twice to the pool", () => {
        const pool = new DraftOfferProposalPool();

        const proposal = instance(mockProposal);

        pool.add(proposal);
        pool.add(proposal);

        expect(pool.count()).toEqual(1);
      });

      it("It's possible to add different proposals to the pool", () => {
        const pool = new DraftOfferProposalPool();

        pool.add(instance(mockProposal));
        pool.add(instance(secondMockProposal));

        expect(pool.count()).toEqual(2);
      });
    });

    describe("Negative cases", () => {
      it("Will throw an error if the proposal is not in Draft state", async () => {
        const pool = new DraftOfferProposalPool();

        const proposalMock = mock(OfferProposal);
        when(proposalMock.isDraft()).thenReturn(false);

        expect(() => pool.add(instance(proposalMock))).toThrow("Cannot add a non-draft proposal to the pool");
      });
    });
  });

  describe("Acquiring proposals", () => {
    describe("Positive cases", () => {
      it("Acquire does not change the size of the pool", async () => {
        const pool = new DraftOfferProposalPool();

        pool.add(instance(mockProposal));
        pool.add(instance(secondMockProposal));

        expect(pool.count()).toEqual(2);
        const leased = await pool.acquire();
        expect(pool.count()).toEqual(2);
        await pool.release(leased);
        expect(pool.count()).toEqual(2);
      });

      it("Is not possible to acquire the same instance twice", async () => {
        const pool = new DraftOfferProposalPool();

        pool.add(instance(mockProposal));
        pool.add(instance(secondMockProposal));

        const a = await pool.acquire();
        const b = await pool.acquire();

        expect(a).not.toBe(b);
      });

      it("ascquire a proposal using offerProposalSelector", async () => {
        when(mockProposal.provider).thenReturn({
          name: "provider-1",
          walletAddress: "1",
          id: "1",
        });
        when(secondMockProposal.provider).thenReturn({
          name: "provider-2",
          walletAddress: "2",
          id: "2",
        });
        const proposal1 = instance(mockProposal);
        const proposal2 = instance(secondMockProposal);
        const scores = {
          "provider-2": 100,
          "provider-1": 50,
        };
        const bestProviderSelector = (scores: { [providerName: string]: number }) => (proposals: OfferProposal[]) => {
          proposals.sort((a, b) => ((scores?.[a.provider.name] || 0) >= (scores?.[b.provider.name] || 0) ? -1 : 1));
          return proposals[0];
        };
        const pool = new DraftOfferProposalPool({ selectOfferProposal: bestProviderSelector(scores) });

        pool.add(proposal1);
        pool.add(proposal2);

        const a = await pool.acquire();

        expect(a).toBe(proposal2);
      });
    });
    describe("Negative cases", () => {
      it("should abort the acquiring proposal by timeout", async () => {
        const pool = new DraftOfferProposalPool();
        await expect(pool.acquire(1)).rejects.toThrow("The operation was aborted due to timeout");
      });
      it("should abort the acquiring proposal by signal", async () => {
        const pool = new DraftOfferProposalPool();
        const ac = new AbortController();
        ac.abort();
        await expect(pool.acquire(ac.signal)).rejects.toThrow("This operation was aborted");
      });
    });
  });

  describe("Is ready", () => {
    it("Returns true when the min number of elements is available in the pool, false otherwise", async () => {
      const pool = new DraftOfferProposalPool({ minCount: 1 });
      expect(pool.isReady()).toEqual(false);

      pool.add(instance(mockProposal));
      expect(pool.isReady()).toEqual(true);
    });
  });

  describe("Clearing the pool", () => {
    it("should remove all the items from the pool, triggering respective events", async () => {
      const pool = new DraftOfferProposalPool();

      const addedCallback = jest.fn();
      const removedCallback = jest.fn();
      const clearedCallback = jest.fn();

      pool.events.on("added", addedCallback);
      pool.events.on("removed", removedCallback);
      pool.events.on("cleared", clearedCallback);

      const p1 = instance(mockProposal);
      const p2 = instance(secondMockProposal);

      pool.add(p1);
      pool.add(p2);

      expect(addedCallback).toHaveBeenCalledTimes(2);
      expect(pool.count()).toEqual(2);

      await pool.clear();

      expect(clearedCallback).toHaveBeenCalled();
      expect(removedCallback).toHaveBeenCalledTimes(2);
      expect(pool.count()).toEqual(0);
    });
  });
});
