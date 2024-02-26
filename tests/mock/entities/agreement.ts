import { Agreement } from "../../../src";
import { MarketApi } from "ya-ts-client";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export const agreement: Agreement = {
  id: "test_agreement_id",
  getProviderInfo() {
    return { id: "test_provider_id", name: "Test Provider", walletAddress: "test_wallet_address" };
  },
  async confirm(): Promise<void> {
    return Promise.resolve(undefined);
  },
  async getState(): Promise<MarketApi.AgreementDTO["state"]> {
    return Promise.resolve("Approved");
  },
  async isFinalState(): Promise<boolean> {
    return Promise.resolve(true);
  },
  async refreshDetails(): Promise<void> {
    return Promise.resolve(undefined);
  },
  async terminate(reason?: { [p: string]: string }): Promise<void> {
    return Promise.resolve(undefined);
  },
};
