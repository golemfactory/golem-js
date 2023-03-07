import { defineStore } from "pinia";

const parseAttributes = (offer) => {
  if (offer.memory) offer.memory = parseInt(offer.memory);
  if (offer.storage) offer.storage = parseInt(offer.storage);
  if (offer.cpuCores) offer.cpuCores = parseInt(offer.cpuCores);
  if (offer.cpuThreads) offer.cpuThreads = parseInt(offer.cpuThreads);
  if (offer.timestamp) offer.time = new Date(offer.timestamp).toLocaleTimeString();
  offer.isProcessing = false;
  return offer;
};

export const useOffersStore = defineStore("offers-store", {
  state: () => ({
    offers: new Map(),
    drawerOfferId: false,
  }),
  actions: {
    add(newOffer) {
      const parentId = newOffer.parentId ? newOffer.parentId : newOffer.id;
      const offer = this.offers.get(parentId) || {};
      this.offers.set(parentId, Object.assign(offer, parseAttributes(newOffer)));
    },
    setProcessingStatusById(id, isProcessing = true) {
      const offer = this.offers.get(id);
      offer.isProcessing = isProcessing;
    },
    show(id) {
      this.drawerOfferId = id;
    },
    addFromEvent: (event) =>
      useOffersStore().add({
        ...event.detail,
        ...event.detail.details,
        detail: undefined,
        timestamp: event.timestamp,
      }),
    addFromErrorEvent: (event, state) =>
      useOffersStore().add({
        ...event.detail,
        ...event.detail.details,
        timestamp: event.timestamp,
        state,
      }),
    addFromAgreementEvent: (event) =>
      useOffersStore().add({
        timestamp: event.timestamp,
        parentId: event.detail.proposalId,
        state: "Confirmed",
      }),
  },
  getters: {
    drawer: (state) => state.offers.get(state.drawerOfferId),
    getAll: (state) => [...state.offers].map(([, v]) => v),
  },
});
