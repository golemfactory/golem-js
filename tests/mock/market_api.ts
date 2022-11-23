/* eslint @typescript-eslint/ban-ts-comment: 0 */
import { RequestorApi } from "ya-ts-client/dist/ya-market/src/api/requestor-api";
import { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import { v4 as uuidv4 } from "uuid";
import { DemandOfferBase, Event, ProposalEvent } from "ya-ts-client/dist/ya-market/src/models";

export class MarketApiMock extends RequestorApi {
  private expectedOffers: ProposalEvent[] = [];
  private mockedOffers: ProposalEvent[] = [];
  private expectedErrors: { message: string; status: number }[] = [];
  private mockedErrors: { message: string; status: number }[] = [];
  private exampleOffer = {};

  constructor() {
    super();
  }

  setExpectedOffers(offers) {
    return (this.expectedOffers = offers);
  }
  setExpectedErrors(errors) {
    this.expectedErrors = errors;
  }
  // @ts-ignore
  async subscribeDemand(
    demandOfferBase: DemandOfferBase,
    options?: AxiosRequestConfig
  ): Promise<import("axios").AxiosResponse<string>> {
    return new Promise((res) => res({ data: uuidv4() } as AxiosResponse));
  }
  // @ts-ignore
  async collectOffers(
    subscriptionId: string,
    timeout?: number,
    maxEvents?: number,
    options?: AxiosRequestConfig
  ): Promise<import("axios").AxiosResponse<Event[]>> {
    if (this.expectedErrors.length) {
      const mockError = this.expectedErrors.shift();
      const error = new Error(mockError!.message) as AxiosError;
      error.response = {
        data: { message: mockError!.message },
        status: mockError!.status,
      } as AxiosResponse;
      throw error;
    }
    if (this.expectedOffers?.length) {
      this.mockedOffers.push(this.expectedOffers?.shift() as ProposalEvent);
    }
    await new Promise((res) => setTimeout(res, 100));
    return new Promise((res) =>
      res({ data: this.mockedOffers.length ? this.mockedOffers : [this.exampleOffer] } as AxiosResponse)
    );
  }
}
