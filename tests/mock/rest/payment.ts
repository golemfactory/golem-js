/* eslint @typescript-eslint/ban-ts-comment: 0 */
import { RequestorApi } from "ya-ts-client/dist/ya-payment/src/api/requestor-api";
import { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import { v4 as uuidv4 } from "uuid";
import { Allocation } from "ya-ts-client/dist/ya-payment/src/models";
import { allocations } from "../fixtures";

let expectedError: AxiosError;
export const setExpectedError = (error) => (expectedError = error);

export class PaymentApiMock extends RequestorApi {
  constructor() {
    super();
  }

  // @ts-ignore
  createAllocation(
    allocation: Allocation,
    afterTimestamp?: string,
    maxItems?: number,
    options?: AxiosRequestConfig
  ): Promise<import("axios").AxiosResponse<Allocation>> {
    return new Promise((res) => res({ data: { ...allocations[0], ...allocation } } as AxiosResponse));
  }
}
