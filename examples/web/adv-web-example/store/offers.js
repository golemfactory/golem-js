import { defineStore } from "pinia";

export const useOffersStore = defineStore({
  id: "offers-store",
  state: () => {
    return {
      offers: [],
    };
  },
  actions: {
    addOffer(offer) {
      let prefix = "_";
      if (offer.state === "Draft") prefix = "b";
      if (offer.state === "Confirmed") prefix = "c";
      offer.time = prefix + new Date(offer.timestamp).toISOString().substring(11, 19);
      if (offer.parent) {
        const old = this.offers.find((item) => item.id === offer.parent);
        Object.assign(old, offer);
      } else this.offers.push(offer);
    },
  },
  getters: {
    allOffers: (state) => state.offers,
    offer: (state, id) => state.offers.find((offer) => offer.id === id),
  },
});
