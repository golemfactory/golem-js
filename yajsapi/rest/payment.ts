import dayjs, { Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import { ResourceCtx } from "./resource";
import * as yap from "ya-ts-client/dist/ya-payment/src/models";
import { Configuration } from "ya-ts-client/dist/ya-activity";
import { RequestorApi } from "ya-ts-client/dist/ya-payment/api";
import { logger } from "../utils";

dayjs.extend(utc);

class yInvoice implements yap.Invoice {
  invoiceId!: string;
  issuerId!: string;
  recipientId!: string;
  payeeAddr?: string | undefined;
  payerAddr?: string | undefined;
  paymentPlatform?: string | undefined;
  lastDebitNoteId?: string | undefined;
  timestamp!: string;
  agreementId!: string;
  activityIds?: string[] | undefined;
  amount!: string;
  paymentDueDate!: string;
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
      allocationId: allocation.id
    };
    acceptance!.totalAmountAccepted = amount.toString();
    acceptance!.allocationId = allocation.id;
    await this._api.acceptInvoice(this.invoiceId, acceptance!);
  }
}

export const InvoiceStatus = yap.InvoiceStatus;

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
    let allocationDetails = new AllocationDetails();

    try {
      let {
        data: details,
      }: { data: yap.Allocation } = await this._api.getAllocation(this.id);
      allocationDetails.spent_amount = parseFloat(details.spentAmount);
      allocationDetails.remaining_amount = parseFloat(details.remainingAmount);
    } catch (error) {
      logger.error(error);
      throw new Error(error);
    }

    return allocationDetails;
  }

  async delete() {
    await this._api.releaseAllocation(this.id);
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
      } = await this._api.createAllocation(this.model);
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
      logger.error(error);
      throw new Error(error);
    }
  }

  async done() {
    if (this._id) {
      await this._api.releaseAllocation(this._id);
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
    return new _AllocationTask(this._api, _allocation!);
  }

  async *allocations(): AsyncGenerator<Allocation> {
    /*Lists all active allocations.*/
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
    return;
  }

  async allocation(allocation_id: string): Promise<Allocation> {
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
  }

  async *accounts(): AsyncGenerator<yap.Account> {
    let { data: _accounts } = await this._api.getSendAccounts();
    for (let account_obj of _accounts) {
      yield account_obj;
    }
  }

  async decorate_demand(ids: string[]): Promise<yap.MarketDecoration> {
    const { data: _decorate_demand } = await this._api.decorateDemand(ids);
    return _decorate_demand;
  }

  async *invoices(): AsyncGenerator<Invoice> {
    let { data: result } = await this._api.getReceivedInvoices();
    for (let invoice_obj of result) {
      yield new Invoice(this._api, invoice_obj);
    }
    return;
  }

  async invoice(invoice_id: string): Promise<Invoice> {
    let { data: invoice_obj } = await this._api.getReceivedInvoice(invoice_id);
    // logger.log("debug", `got=${JSON.stringify(invoice_obj)}`);
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
        let { data: items } = await api.getRequestorInvoiceEvents(
          5,
          ts.format("YYYY-MM-DD HH:mm:ss.SSSSSSZ")
        );
        for (let ev of items) {
          ts = dayjs(new Date(parseInt(ev.timestamp as string) * 1000));
          if (ev.eventType == yap.EventType.RECEIVED) {
            let invoice = await self.invoice(ev.invoiceId);
            yield invoice;
          }
        }
      }
      return;
    }

    return fetch(ts);
  }
}
