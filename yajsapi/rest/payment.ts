import dayjs, { Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import { ResourceCtx } from "./resource";
import * as yap from "ya-ts-client/dist/ya-payment/src/models";
import { Configuration } from "ya-ts-client/dist/ya-activity";
import { RequestorApi } from "ya-ts-client/dist/ya-payment/api";
import { logger, sleep } from "../utils";
import { is_intermittent_error, repeat_on_error, suppress_exceptions } from "./common";

dayjs.extend(utc);

class yInvoice implements yap.Invoice {
  invoiceId!: string;
  issuerId!: string;
  recipientId!: string;
  payeeAddr!: string;
  payerAddr!: string;
  paymentPlatform!: string;
  lastDebitNoteId?: string | undefined;
  timestamp!: string;
  agreementId!: string;
  activityIds?: string[] | undefined;
  amount!: string;
  paymentDueDate!: string;
  status!: yap.InvoiceStatus;
}

class yDebitNote implements yap.DebitNote {
  debitNoteId!: string;
  issuerId!: string;
  recipientId!: string;
  payeeAddr!: string;
  payerAddr!: string;
  paymentPlatform!: string;
  previousDebitNoteId?: string | undefined;
  timestamp!: string;
  agreementId!: string;
  activityId!: string;
  totalAmountDue!: string;
  usageCounterVector?: object;
  paymentDueDate?: string;
  status!: yap.InvoiceStatus;
}

export class Invoice extends yInvoice {
  private _api: RequestorApi;
  constructor(_api: RequestorApi, _base: yap.Invoice) {
    super();
    for (let [key, value] of Object.entries(_base)) {
      this[key] = value;
    }
    this._api = _api;
  }

  async accept(amount: number | string, allocation: Allocation) {
    let acceptance: yap.Acceptance = {
      totalAmountAccepted: amount.toString(),
      allocationId: allocation.id,
    };
    acceptance!.totalAmountAccepted = amount.toString();
    acceptance!.allocationId = allocation.id;
    await repeat_on_error(async () => {
      await this._api.acceptInvoice(this.invoiceId, acceptance!, 5, { timeout: 7000 });
    }, "acceptInvoice");
  }
}

export const InvoiceStatus = yap.InvoiceStatus;

export class DebitNote extends yDebitNote {
  private _api: RequestorApi;
  constructor(_api: RequestorApi, _base: yap.DebitNote) {
    super();
    for (let [key, value] of Object.entries(_base)) {
      this[key] = value;
    }
    this._api = _api;
  }

  async accept(amount: number | string, allocation: Allocation) {
    let acceptance: yap.Acceptance = {
      totalAmountAccepted: amount.toString(),
      allocationId: allocation.id,
    };
    acceptance!.totalAmountAccepted = amount.toString();
    acceptance!.allocationId = allocation.id;
    await repeat_on_error(async () => {
      await this._api.acceptDebitNote(this.debitNoteId, acceptance!, 5, { timeout: 7000 });
    }, "acceptDebitNote");
  }
}

class _Link {
  _api!: RequestorApi;
}

class AllocationDetails {
  spent_amount!: number;
  remaining_amount!: number;
}

export class Allocation extends _Link {
  //Payment reservation for task processing.

  id!: string;
  //Allocation object id

  amount!: number;
  //"Total amount allocated"

  payment_platform?: string;
  //"Payment platform, e.g. NGNT"

  payment_address?: string;
  //"Payment address, e.g. 0x123..."

  expires?: Date;
  //"Allocation expiration timestamp"

  async details(): Promise<AllocationDetails> {
    return await repeat_on_error(async () => {
      let allocationDetails = new AllocationDetails();
      let {
        data: details,
      }: { data: yap.Allocation } = await this._api.getAllocation(this.id, { timeout: 7000 });
      allocationDetails.spent_amount = parseFloat(details.spentAmount);
      allocationDetails.remaining_amount = parseFloat(details.remainingAmount);
      return allocationDetails;
    }, "getAllocation");
  }

  async delete() {
    try {
      await repeat_on_error(async () => {
        await this._api.releaseAllocation(this.id, { timeout: 7000 });
      }, "releaseAllocation");
    } catch(error) {
      logger.error(`Release allocation error: ${error}`);
    }
  }
}

class _AllocationTask extends ResourceCtx<Allocation> {
  _api!: RequestorApi;
  model!: yap.Allocation;
  _id!: string | null;

  constructor(api, model) {
    super();
    this._api = api;
    this.model = model;
  }

  async ready() {
    try {
      let {
        data: new_allocation,
      }: {
        data: yap.Allocation;
      } = await this._api.createAllocation(this.model, undefined, undefined, { timeout: 25000 });
      this._id = new_allocation.allocationId;
      let model = this.model;
      if (!model.totalAmount) throw "";
      if (!model.timeout) throw "";
      if (!this._id) throw "";

      let _allocation = new Allocation();
      _allocation.id = this._id;
      _allocation._api = this._api;
      _allocation.payment_platform = model.paymentPlatform;
      _allocation.payment_address = model.address;
      _allocation.amount = parseFloat(model.totalAmount);
      _allocation.expires = new Date(parseInt(model.timeout) * 1000);
      return _allocation;
    } catch (error) {
      const msg = error.response && error.response.data ? error.response.data.message : error.message;
      logger.error(`Payment allocation error (message: ${msg}). Please run "yagna payment status" to check your account.`);
      throw new Error(error);
    }
  }

  async done() {
    if (this._id) {
      try {
        await this._api.releaseAllocation(this._id, { timeout: 5000 });
      } catch(error) {
        logger.error(`Release allocation: ${error}`);
      }
    }
  }
}

class yAllocation implements yap.Allocation {
  allocationId: string = "";
  address?: string | undefined;
  paymentPlatform?: string | undefined;
  totalAmount!: string;
  spentAmount!: string;
  remainingAmount!: string;
  timeout?: string | undefined;
  makeDeposit!: boolean;
  timestamp!: string;
}

export class Payment {
  private _api!: RequestorApi;

  constructor(cfg: Configuration) {
    this._api = new RequestorApi(cfg);
  }

  new_allocation(
    amount: number,
    payment_platform: string,
    payment_address: string,
    expires: Date | null = null,
    make_deposit: boolean = false
  ): ResourceCtx<Allocation> {
    /*Creates new allocation.

         - `amount`:  Allocation amount.
         - `expires`: expiration timestamp. by default 30 minutes from now.
         - `make_deposit`: (unimplemented).

        */
    let allocation_timeout =
      expires || dayjs().add(30, "minute").utc().toDate();
    let _allocation: yap.Allocation = new yAllocation();
    _allocation.paymentPlatform = payment_platform;
    _allocation.address = payment_address;
    _allocation.totalAmount = amount.toString();
    _allocation!.timeout = allocation_timeout.toISOString();
    _allocation!.makeDeposit = make_deposit;
    _allocation!.spentAmount = "";
    _allocation!.remainingAmount = "";
    _allocation.timestamp = dayjs().utc().format("YYYY-MM-DDTHH:mm:ss.SSSSSSZ");
    return new _AllocationTask(this._api, _allocation!);
  }

  async *allocations(): AsyncGenerator<Allocation> {
    /*Lists all active allocations.*/
    try {
      let { data: result } = await this._api.getAllocations();
      for (let alloc_obj of result) {
        let _allocation = new Allocation();
        _allocation._api = this._api;
        _allocation.id = alloc_obj.allocationId;
        _allocation.amount = parseFloat(alloc_obj.totalAmount);
        _allocation.payment_platform = alloc_obj.paymentPlatform;
        _allocation.payment_address = alloc_obj.address;
        _allocation.expires = new Date(
          parseInt(alloc_obj.timeout as string) * 1000
        );
        yield _allocation;
      }
    } catch (error) {
      throw error;
    }
    return;
  }

  async allocation(allocation_id: string): Promise<Allocation> {
    try {
      let {
        data: result,
      }: { data: yap.Allocation } = await this._api.getAllocation(allocation_id);
      let allocation_obj = result;
      let _allocation = new Allocation();
      _allocation._api = this._api;
      _allocation.id = allocation_obj.allocationId;
      _allocation.amount = parseFloat(allocation_obj.totalAmount);
      _allocation.payment_platform = allocation_obj.paymentPlatform;
      _allocation.payment_address = allocation_obj.address;
      _allocation.expires = new Date(
        parseInt(allocation_obj.timeout as string) * 1000
      );
      return _allocation;
    } catch (error) {
      throw error;
    }
  }

  async *accounts(): AsyncGenerator<yap.Account> {
    let { data: _accounts } = await this._api.getRequestorAccounts();
    for (let account_obj of _accounts) {
      yield account_obj;
    }
  }

  async decorate_demand(ids: string[]): Promise<yap.MarketDecoration> {
    const { data: _decorate_demand } = await this._api.getDemandDecorations(
      ids
    );
    return _decorate_demand;
  }

  async debit_note(debit_note_id: string): Promise<DebitNote> {
    let debit_note_obj = await repeat_on_error(async () => {
      return (await this._api.getDebitNote(debit_note_id, { timeout: 5000 })).data;
    }, "getDebitNote");
    // TODO may need to check only requestor debit notes
    return new DebitNote(this._api, debit_note_obj)
  }


  async *invoices(): AsyncGenerator<Invoice> {
    let { data: result } = await this._api.getInvoices(undefined, undefined, { timeout: 5000 });
    // TODO may need to check only requestor invoices
    for (let invoice_obj of result) {
      yield new Invoice(this._api, invoice_obj);
    }
    return;
  }

  async invoice(invoice_id: string): Promise<Invoice> {
    let invoice_obj = await repeat_on_error(async () => {
      return (await this._api.getInvoice(invoice_id, { timeout: 5000 })).data;
    }, "getInvoice");
    // TODO may need to check only requestor invoices
    return new Invoice(this._api, invoice_obj);
  }

  incoming_invoices(cancellationToken): AsyncGenerator<Invoice> {
    let ts = dayjs().utc();
    let api = this._api;
    let self = this;

    async function* fetch(init_ts: Dayjs) {
      let ts = init_ts;
      while (true) {
        if (cancellationToken.cancelled) break;
        let events: any[] = [];
        await suppress_exceptions(is_intermittent_error, async () => {
          let { data } = await api.getInvoiceEvents(
            5,
            ts.format("YYYY-MM-DDTHH:mm:ss.SSSSSSZ"),
            undefined,
            undefined,
            { timeout: 7000 }
          );
          events = data;
        }, "getInvoiceEvents");
        for (let ev of events) {
          logger.debug(
            `Received invoice event: ${JSON.stringify(ev)}, ` +
            `type: ${JSON.stringify(Object.getPrototypeOf(ev))}`
          );
          ts = dayjs(ev.eventDate);
          if (ev.eventType === "InvoiceReceivedEvent") {
            let invoice = await self.invoice(ev["invoiceId"]);
            yield invoice;
          }
        }
        if (!events.length) {
          await sleep(1);
        }
      }
      return;
    }

    return fetch(ts);
  }

  incoming_debit_notes(cancellationToken): AsyncGenerator<DebitNote> {
    let ts = dayjs().utc();
    let api = this._api;
    let self = this;

    async function* fetch(init_ts: Dayjs) {
      let ts = init_ts;
      while (true) {
        if (cancellationToken.cancelled) break;
        let events: any[] = [];
        await suppress_exceptions(is_intermittent_error, async () => {
          let { data } = await api.getDebitNoteEvents(
            5,
            ts.format("YYYY-MM-DDTHH:mm:ss.SSSSSSZ"),
            undefined,
            undefined,
            { timeout: 7000 }
          );
          events = data;
        }, "getDebitNoteEvents");
        for (let ev of events) {
          logger.debug(
            `Received debit note event: ${JSON.stringify(ev)}, ` +
            `type: ${JSON.stringify(Object.getPrototypeOf(ev))}`
          );
          ts = dayjs(ev.eventDate);
          if (ev.eventType === "DebitNoteReceivedEvent") {
            let debit_note = await self.debit_note(ev["debitNoteId"]);
            yield debit_note;
          }
        }
        if (!events.length) {
          await sleep(1);
        }
      }
      return;
    }

    return fetch(ts);
  }
}
