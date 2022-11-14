export interface ProviderInfo {
  providerName: string;
  providerId: string;
}

export class Agreement {
  constructor(public readonly id: string, public readonly providerInfo: ProviderInfo) {}
}
