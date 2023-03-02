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
      console.log(offer);
      this.offers.push(offer);
    },
    update(offer) {
      // todo
    },
  },
  getters: {
    offers: (state) => state.offers,
    offer: (state, id) => state.offers.find((offer) => offer.id === id),
  },
});
