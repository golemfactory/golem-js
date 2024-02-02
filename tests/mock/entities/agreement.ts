import { Agreement } from "../../../src/agreement";
import { AgreementStateEnum } from "ya-ts-client/dist/ya-market/src/models";

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
  async getState(): Promise<AgreementStateEnum> {
    return Promise.resolve(AgreementStateEnum.Approved);
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
