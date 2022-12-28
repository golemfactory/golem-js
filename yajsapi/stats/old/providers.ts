export interface ProviderInfo {
  name: string;
  proposalsAll: string[];
  proposalsConfirmed: string[];
  proposalsRejected: string[];
  agreementsAll: string[];
  agreementsApproved: string[];
  agreementsRejected: string[];
  activitiesAll: string[];
  invoicesAll: string[];
  invoicesPaid: string[];
  invoicesUnpaid: string[];
  debitNotesAll: string[];
}

export class Providers {
  private providers = new Map<string, ProviderInfo>();

  getInfo(providerId: string): ProviderInfo {
    const info = this.providers.get(providerId);
    if (!info) throw new Error(`There is no info for provider ${providerId}`);
    return info;
  }

  getAllProvidersInfo() {
    return this.providers;
  }

  addProposal(providerId: string, id: string) {
    const providerInfo = this.providers.get(providerId);
    if (providerInfo) {
      providerInfo.proposalsAll.push(id);
    }
  }

  addAgreement(id: string, providerId: string, providerName: string) {
    const providerInfo = this.providers.get(providerId);
    if (!providerInfo) {
      this.providers.set(providerId, {
        name: providerName,
        proposalsAll: [],
        proposalsConfirmed: [],
        proposalsRejected: [],
        agreementsAll: [id],
        agreementsApproved: [],
        agreementsRejected: [],
        activitiesAll: [],
        invoicesAll: [],
        invoicesPaid: [],
        invoicesUnpaid: [],
        debitNotesAll: [],
      });
    } else {
      providerInfo.agreementsAll.push(id);
    }
  }

  getKeyByValue(map, field, searchValue) {
    for (const [key, values] of map.entries()) {
      if (values.inArray(searchValue)) return key;
    }
  }

  confirmAgreement(id) {
    const providerId = this.getKeyByValue(this.providers, "agreementsAll", id);
    if (providerId) {
      const providerInfo = this.providers.get(providerId);
      if (providerInfo) {
        providerInfo.agreementsApproved.push(id);
      }
    }
  }

  rejectAgreement(id) {
    const providerId = this.getKeyByValue(this.providers, "agreementsAll", id);
    if (providerId) {
      const providerInfo = this.providers.get(providerId);
      if (providerInfo) {
        providerInfo.agreementsRejected.push(id);
      }
    }
  }

  addActivity(providerId: string, id: string) {
    const providerInfo = this.providers.get(providerId);
    if (providerInfo) {
      providerInfo.activitiesAll.push(id);
    }
  }

  addInvoice(providerId: string, id: string) {
    const providerInfo = this.providers.get(providerId);
    if (providerInfo) {
      providerInfo.invoicesAll.push(id);
    }
  }

  addDebitNote(providerId: string, id: string) {
    const providerInfo = this.providers.get(providerId);
    if (providerInfo) {
      providerInfo.debitNotesAll.push(id);
    }
  }

  getAllAgreements(): Array<{ providerId: string; providerName: string; approved: boolean; id: string }> {
    return [...this.agreements].map(([id, data]) => ({ ...data, id }));
  }

  getProviderName(agreementId: string): string | undefined {
    return this.agreements.get(agreementId)?.providerName;
  }
}
