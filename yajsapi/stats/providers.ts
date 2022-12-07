export interface ProviderInfo {
  name: string;
  proposalsAll: string[];
  proposalsConfirmed: string[];
  proposalsRejected: string[];
  agreements: string[];
  agreementsApproved: string[];
  agreementsRejected: string[];
  activities: string[];
  invoicesAll: string[];
  invoicesPaid: string[];
  invoicesUnpaid: string[];
  debitNotes: string[];
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

  addProposal(providerId: string, id: string, confirmed?: boolean) {
    // todo
  }
  addAgreement(providerId: string, id: string, approved?: boolean) {
    // todo
  }
  addActivity(providerId: string, id: string) {
    // todo
  }
  addInvoice(providerId: string, id: string, paid?: boolean) {
    // todo
  }
  addDebitNote(providerId: string, id: string, paid?: boolean) {
    // todo
  }
}
