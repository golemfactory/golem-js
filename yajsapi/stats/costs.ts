import { ProviderInfo } from "./providers";

interface CostsInfo {
  totalPaid: number;
  totalUnpaid: number;
  invoicesPaid: string[];
  invoicesUnpaid: string[];
}

export class Costs {
  constructor(private getProvidersInfo: () => Map<string, ProviderInfo>) {}

  getAllCosts(): CostsInfo {
    const costs: CostsInfo = { invoicesPaid: [], invoicesUnpaid: [], totalPaid: 0, totalUnpaid: 0 };
    this.getProvidersInfo().forEach((info, providerId) => {
      // todo
    });
    return costs;
  }
}
