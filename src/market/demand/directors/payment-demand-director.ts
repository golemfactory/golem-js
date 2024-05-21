import { DemandBodyBuilder } from "../demand-body-builder";
import { IDemandDirector } from "../../market.module";
import { PaymentDemandDirectorConfig } from "./payment-demand-director-config";
import { Allocation } from "../../../payment";
import { MarketApi } from "../../api";

export class PaymentDemandDirector implements IDemandDirector {
  constructor(
    private allocation: Allocation,
    private marketApiAdapter: MarketApi,
    private config: PaymentDemandDirectorConfig = new PaymentDemandDirectorConfig(),
  ) {}

  async apply(builder: DemandBodyBuilder) {
    // Configure mid-agreement payments
    builder
      .addProperty("golem.com.scheme.payu.debit-note.interval-sec?", this.config.midAgreementDebitNoteIntervalSec)
      .addProperty("golem.com.scheme.payu.payment-timeout-sec?", this.config.midAgreementPaymentTimeoutSec)
      .addProperty("golem.com.payment.debit-notes.accept-timeout?", this.config.debitNotesAcceptanceTimeoutSec);

    // Configure payment platform
    const { constraints, properties } = await this.marketApiAdapter.getPaymentRelatedDemandDecorations(
      this.allocation.id,
    );
    builder.mergePrototype({ constraints, properties });
  }
}
