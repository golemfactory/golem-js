import { PayerDetails } from "../../../payment/PayerDetails";
import { ComparisonOperator, DemandDetailsBuilder } from "../demand-details-builder";
import { IDemandDirector } from "../../market.module";
import { PaymentDemandDirectorConfig } from "./payment-demand-director-config";

export class PaymentDemandDirector implements IDemandDirector {
  constructor(
    private payerDetails: PayerDetails,
    private config: PaymentDemandDirectorConfig = new PaymentDemandDirectorConfig(),
  ) {}

  apply(builder: DemandDetailsBuilder) {
    // Configure mid-agreement payments
    builder
      .addProperty("golem.com.scheme.payu.debit-note.interval-sec?", this.config.midAgreementDebitNoteIntervalSec)
      .addProperty("golem.com.scheme.payu.payment-timeout-sec?", this.config.midAgreementPaymentTimeoutSec)
      .addProperty("golem.com.payment.debit-notes.accept-timeout?", this.config.debitNotesAcceptanceTimeoutSec);

    // Configure payment platform
    builder
      .addProperty(
        `golem.com.payment.platform.${this.payerDetails.getPaymentPlatform()}.address`,
        this.payerDetails.address,
      )
      .addConstraint(`golem.com.payment.platform.${this.payerDetails.getPaymentPlatform()}.address`, "*")
      .addProperty("golem.com.payment.protocol.version", "2")
      .addConstraint("golem.com.payment.protocol.version", "1", ComparisonOperator.Gt);
  }
}
