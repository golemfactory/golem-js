export interface CostsInfoByProvider {
  providerId: string;
  totalPaid: number;
  totalUnpaid: number;
  invoicesPaid: string[];
  invoicesUnpaid: string[];
}

export interface CostsInfoByAgreement {
  agreementId: string;
  amount: number;
  invoices: number;
  debitNotes: number;
  paid: boolean;
}

export class Payments {
  private allocations = new Set<{ id: string; amount: number; platform: string }>();
  private proposals = new Map<string, string[]>();
  private invoices = new Set<{ id: string; providerId: string; agreementId: string; amount: number }>();
  private invoicesPaid = new Set<{ id: string; providerId: string; agreementId: string; amount: number }>();

  addAllocation(allocation) {
    this.allocations.add(allocation);
  }

  addProposal(id: string, providerId: string) {
    const proposals = this.proposals.get(providerId);
    if (!proposals) this.proposals.set(providerId, [id]);
    else proposals.push(id);
  }

  addInvoice(id: string, providerId: string, agreementId: string, amount: string) {
    this.invoices.add({ id, providerId, agreementId, amount: parseFloat(amount) });
  }

  addPayment(id: string, providerId: string, agreementId: string, amount: string) {
    this.invoicesPaid.add({ id, providerId, agreementId, amount: parseFloat(amount) });
  }

  getCostByProvider(providerId: string): CostsInfoByProvider {
    const invoices = [...this.invoices].filter((i) => i.providerId === providerId);
    const invoicesPaid = [...this.invoicesPaid].filter((i) => i.providerId === providerId);
    const invoicesIdsPaid = invoicesPaid.map((i) => i.id);
    const invoicesUnpaid = invoices.filter((i) => !invoicesIdsPaid.includes(i.id));
    const invoicesUnpaidIds = invoicesUnpaid.map((i) => i.id);
    const totalPaid = invoicesPaid.reduce((sum, i) => sum + i.amount, 0);
    const totalUnpaid = invoicesUnpaid.reduce((sum, i) => sum + i.amount, 0);
    return {
      providerId,
      totalPaid,
      totalUnpaid,
      invoicesPaid: invoicesIdsPaid,
      invoicesUnpaid: invoicesUnpaidIds,
    };
  }

  getAllProvidersCosts(): CostsInfoByProvider[] {
    return [...this.invoices].map((i) => this.getCostByProvider(i.providerId));
  }

  getCostsByAgreement(agreementId: string): CostsInfoByAgreement {
    const invoices = [...this.invoices].filter((i) => i.agreementId === agreementId);
    const paid = [...this.invoicesPaid].some((i) => i.agreementId === agreementId);
    return {
      agreementId,
      amount: invoices.reduce((sum, i) => sum + i.amount, 0),
      invoices: invoices.length,
      debitNotes: 0,
      paid,
    };
  }
}
