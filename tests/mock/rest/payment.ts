/* eslint @typescript-eslint/ban-ts-comment: 0 */
import { RequestorApi } from "ya-ts-client/dist/ya-payment/src/api/requestor-api";
import { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import {
  Account,
  Allocation,
  DebitNoteEvent,
  InvoiceEvent,
  Invoice,
  DebitNote,
  Acceptance,
} from "ya-ts-client/dist/ya-payment/src/models";
import { allocations, accounts, debitNotesEvents, debitNotes, invoiceEvents, invoices } from "../fixtures";
import { Rejection } from "ya-ts-client/dist/ya-payment/src/models";
import { sleep } from "../../../src/utils";

global.expectedEvents = [];
global.expectedInvoices = [];
global.expectedDebitNotes = [];

export const setExpectedEvents = (events) => (global.expectedEvents = events);
export const setExpectedInvoices = (invoices) => (global.expectedInvoices = invoices);
export const setExpectedDebitNotes = (debitNotes) => (global.expectedDebitNotes = debitNotes);

global.expectedError;
export const setExpectedError = (error) => (global.expectedError = error);

export const clear = () => {
  global.expectedEvents = [];
  global.expectedInvoices = [];
  global.expectedDebitNotes = [];
};

export class PaymentApiMock extends RequestorApi {
  constructor() {
    super();
  }

  // @ts-ignore
  createAllocation(
    allocation: Allocation,
    afterTimestamp?: string,
    maxItems?: number,
    options?: AxiosRequestConfig,
  ): Promise<import("axios").AxiosResponse<Allocation>> {
    return new Promise((res) => res({ data: { ...allocations[0], ...allocation } } as AxiosResponse));
  }
  // @ts-ignore
  getRequestorAccounts(options?: AxiosRequestConfig): Promise<import("axios").AxiosResponse<Account[]>> {
    return new Promise((res) => res({ data: accounts } as AxiosResponse));
  }
  // @ts-ignore
  releaseAllocation(allocationId: string, options?: AxiosRequestConfig): Promise<import("axios").AxiosResponse<void>> {
    return Promise.resolve({} as AxiosResponse);
  }

  // @ts-ignore
  getInvoiceEvents(
    timeout?: number,
    afterTimestamp?: string,
    maxEvents?: number,
    appSessionId?: string,
    options?: AxiosRequestConfig,
  ): Promise<import("axios").AxiosResponse<InvoiceEvent[]>> {
    return new Promise(async (res) => {
      await sleep(100, true);
      res({ data: global.expectedEvents } as AxiosResponse);
    });
  }

  // @ts-ignore
  getInvoice(invoiceId: string, options?: AxiosRequestConfig): Promise<import("axios").AxiosResponse<Invoice>> {
    return new Promise((res) => res({ data: global.expectedInvoices[0] } as AxiosResponse));
  }

  // @ts-ignore
  getDebitNoteEvents(
    timeout?: number,
    afterTimestamp?: string,
    maxEvents?: number,
    appSessionId?: string,
    options?: AxiosRequestConfig,
  ): Promise<import("axios").AxiosResponse<DebitNoteEvent[]>> {
    return new Promise(async (res) => {
      await sleep(100, true);
      res({ data: global.expectedEvents } as AxiosResponse);
    });
  }

  // @ts-ignore
  getDebitNote(debitNoteId: string, options?: AxiosRequestConfig): Promise<import("axios").AxiosResponse<DebitNote>> {
    return new Promise((res) => res({ data: global.expectedDebitNotes[0] } as AxiosResponse));
  }
  // @ts-ignore
  acceptInvoice(
    invoiceId: string,
    acceptance: Acceptance,
    timeout?: number,
    options?: AxiosRequestConfig,
  ): Promise<import("axios").AxiosResponse<void>> {
    return new Promise((res) => res({} as AxiosResponse));
  }
  // @ts-ignore
  acceptDebitNote(
    debitNoteId: string,
    acceptance: Acceptance,
    timeout?: number,
    options?: AxiosRequestConfig,
  ): Promise<import("axios").AxiosResponse<void>> {
    return new Promise((res) => res({} as AxiosResponse));
  }
  // @ts-ignore
  rejectDebitNote(
    debitNoteId: string,
    rejection: Rejection,
    timeout?: number,
    options?: AxiosRequestConfig,
  ): Promise<import("axios").AxiosResponse<void>> {
    return new Promise((res) => res({} as AxiosResponse));
  }

  // @ts-ignore
  rejectInvoice(
    invoiceId: string,
    rejection: Rejection,
    timeout?: number,
    options?: AxiosRequestConfig,
  ): Promise<import("axios").AxiosResponse<void>> {
    return new Promise((res) => res({} as AxiosResponse));
  }
}
