import { ComparisonOperator, DemandBodyBuilder } from "../demand";
import { ScanOptions } from "./types";

export class ScanDirector {
  constructor(private options: ScanOptions) {}

  public async apply(builder: DemandBodyBuilder) {
    this.addWorkloadDecorations(builder);
    this.addGenericDecorations(builder);
    this.addManifestDecorations(builder);
    this.addPaymentDecorations(builder);
  }

  private addPaymentDecorations(builder: DemandBodyBuilder): void {
    if (this.options.payment?.debitNotesAcceptanceTimeoutSec) {
      builder.addProperty(
        "golem.com.payment.debit-notes.accept-timeout?",
        this.options.payment?.debitNotesAcceptanceTimeoutSec,
      );
    }
    if (this.options.payment?.midAgreementDebitNoteIntervalSec) {
      builder.addProperty(
        "golem.com.scheme.payu.debit-note.interval-sec?",
        this.options.payment?.midAgreementDebitNoteIntervalSec,
      );
    }
    if (this.options.payment?.midAgreementPaymentTimeoutSec) {
      builder.addProperty(
        "golem.com.scheme.payu.payment-timeout-sec?",
        this.options.payment?.midAgreementPaymentTimeoutSec,
      );
    }
  }

  private addWorkloadDecorations(builder: DemandBodyBuilder): void {
    if (this.options.workload?.engine) {
      builder.addConstraint("golem.runtime.name", this.options.workload?.engine);
    }
    if (this.options.workload?.capabilities)
      this.options.workload?.capabilities.forEach((cap) => builder.addConstraint("golem.runtime.capabilities", cap));

    if (this.options.workload?.minMemGib) {
      builder.addConstraint("golem.inf.mem.gib", this.options.workload?.minMemGib, ComparisonOperator.GtEq);
    }
    if (this.options.workload?.minStorageGib) {
      builder.addConstraint("golem.inf.storage.gib", this.options.workload?.minStorageGib, ComparisonOperator.GtEq);
    }
    if (this.options.workload?.minCpuThreads) {
      builder.addConstraint("golem.inf.cpu.threads", this.options.workload?.minCpuThreads, ComparisonOperator.GtEq);
    }
    if (this.options.workload?.minCpuCores) {
      builder.addConstraint("golem.inf.cpu.cores", this.options.workload?.minCpuCores, ComparisonOperator.GtEq);
    }
  }

  private addGenericDecorations(builder: DemandBodyBuilder): void {
    if (this.options.subnetTag) {
      builder
        .addProperty("golem.node.debug.subnet", this.options.subnetTag)
        .addConstraint("golem.node.debug.subnet", this.options.subnetTag);
    }

    if (this.options.expirationSec) {
      builder.addProperty("golem.srv.comp.expiration", Date.now() + this.options.expirationSec * 1000);
    }
  }

  private addManifestDecorations(builder: DemandBodyBuilder): void {
    if (!this.options.workload?.manifest) return;
    builder.addProperty("golem.srv.comp.payload", this.options.workload?.manifest);
    if (this.options.workload?.manifestSig) {
      builder.addProperty("golem.srv.comp.payload.sig", this.options.workload?.manifestSig);
    }
    if (this.options.workload?.manifestSigAlgorithm) {
      builder.addProperty("golem.srv.comp.payload.sig.algorithm", this.options.workload?.manifestSigAlgorithm);
    }
    if (this.options.workload?.manifestCert) {
      builder.addProperty("golem.srv.comp.payload.cert", this.options.workload?.manifestCert);
    }
  }
}
