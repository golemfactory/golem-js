export interface ProviderInfo {
  providerName: string;
  providerId: string;
}

export class Agreement {
  constructor(public readonly id: string) {}
  getProviderInfo(): ProviderInfo {
    // TODO:
    return {
      providerName: "todo",
      providerId: "todo",
    };
  }
}
