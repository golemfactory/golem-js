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
  private agreements = new Map<string, { providerId: string; providerName: string; approved: boolean }>();

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
  addAgreement(id: string, providerId: string, providerName: string) {
    this.agreements.set(id, { providerId, providerName, approved: false });
  }
  confirmAgreement(id) {
    const agreement = this.agreements.get(id);
    agreement && (agreement.approved = true);
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

  getAllAgreements(): Array<{ providerId: string; providerName: string; approved: boolean; id: string }> {
    return [...this.agreements].map(([id, data]) => ({ ...data, id }));
  }

  getProviderName(agreementId: string): string | undefined {
    return this.agreements.get(agreementId)?.providerName;
  }
}
