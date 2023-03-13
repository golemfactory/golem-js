import { defineStore } from "pinia";

const parseAttributes = (offer) => {
  if (offer.storage) offer.storage = parseInt(offer.storage);
  if (offer.memory) offer.memory = parseInt(offer.memory);
  if (offer.cpuCores) offer.cpuCores = parseInt(offer.cpuCores);
  if (offer.cpuThreads) offer.cpuThreads = parseInt(offer.cpuThreads);
  if (offer.timestamp) offer.time = new Date(offer.timestamp).toLocaleTimeString();
  offer.isProcessing = false;
  return offer;
};

export const useOffersStore = defineStore("offers-store", {
  state: () => ({
    offers: [],
    drawerOfferId: false,
  }),
  actions: {
    add(newOffer) {
      if (newOffer.parentId) {
        const oldOffer = this.offers.find((offer) => offer.id === newOffer.parentId);
        if (!oldOffer) throw new Error(`There is no initial offer ${newOffer.parentId}`);
        Object.assign(oldOffer, parseAttributes(newOffer));
      } else {
        this.offers.push(parseAttributes(newOffer));
      }
    },
    setProcessingStatusById(id, isProcessing = true) {
      const offer = this.offers.find((offer) => offer.id === id);
      offer.isProcessing = isProcessing;
    },
    show(id) {
      this.drawerOfferId = id;
    },
    end() {
      this.offers.forEach((offer) => offer && (offer.isProcessing = false));
    },
    addFromEvent: (event) =>
      useOffersStore().add({
        ...event.detail,
        ...event.detail.details,
        timestamp: event.timestamp,
      }),
    addFromErrorEvent: (event, state) =>
      useOffersStore().add({
        ...event.detail,
        ...event.detail.details,
        timestamp: event.timestamp,
        state,
      }),
    addFromAgreementEvent: (event) => {
      useOffersStore().add({
        timestamp: event.timestamp,
        parentId: event.detail.proposalId,
        state: "Confirmed",
      });
    },
  },
  getters: {
    drawerOffer: (state) => state.offers.find((offer) => offer.id === state.drawerOfferId),
  },
});
