import { ComparisonOperator, DemandBodyBuilder } from "../demand";
import { ScanOptions } from "./types";
import { GolemConfigError } from "../../shared/error/golem-error";

export class ScanDirector {
  constructor(private options: ScanOptions) {}

  public async apply(builder: DemandBodyBuilder) {
    this.addWorkloadDecorations(builder);
    this.addGenericDecorations(builder);
    this.addPaymentDecorations(builder);
  }

  private addPaymentDecorations(builder: DemandBodyBuilder): void {
    if (!this.options.payment) return;
    const network = this.options.payment.network;
    const driver = this.options.payment.driver || "erc20";
    const token = this.options.payment.token || ["mainnet", "polygon"].includes(network) ? "glm" : "tglm";
    builder.addConstraint(`golem.com.payment.platform.${driver}-${network}-${token}.address`, "*");
  }

  private addWorkloadDecorations(builder: DemandBodyBuilder): void {
    if (this.options.workload?.engine && this.options.workload?.runtime) {
      throw new GolemConfigError(
        "The engine parameter is deprecated and cannot be used with the runtime parameter. Use the runtime parameter only",
      );
    }
    /** @deprecated  */
    if (this.options.workload?.engine) {
      builder.addConstraint("golem.runtime.name", this.options.workload?.engine);
    }
    if (this.options.workload?.runtime?.name) {
      builder.addConstraint("golem.runtime.name", this.options.workload.runtime.name);
    }
    if (this.options.workload?.runtime?.version) {
      builder.addConstraint("golem.runtime.version", this.options.workload.runtime.version);
    }
    if (this.options.workload?.capabilities)
      this.options.workload?.capabilities.forEach((cap) => builder.addConstraint("golem.runtime.capabilities", cap));

    if (this.options.workload?.minMemGib) {
      builder.addConstraint("golem.inf.mem.gib", this.options.workload?.minMemGib, ComparisonOperator.GtEq);
    }
    if (this.options.workload?.maxMemGib) {
      builder.addConstraint("golem.inf.mem.gib", this.options.workload?.maxMemGib, ComparisonOperator.LtEq);
    }
    if (this.options.workload?.minStorageGib) {
      builder.addConstraint("golem.inf.storage.gib", this.options.workload?.minStorageGib, ComparisonOperator.GtEq);
    }
    if (this.options.workload?.maxStorageGib) {
      builder.addConstraint("golem.inf.storage.gib", this.options.workload?.maxStorageGib, ComparisonOperator.LtEq);
    }
    if (this.options.workload?.minCpuThreads) {
      builder.addConstraint("golem.inf.cpu.threads", this.options.workload?.minCpuThreads, ComparisonOperator.GtEq);
    }
    if (this.options.workload?.maxCpuThreads) {
      builder.addConstraint("golem.inf.cpu.threads", this.options.workload?.maxCpuThreads, ComparisonOperator.LtEq);
    }
    if (this.options.workload?.minCpuCores) {
      builder.addConstraint("golem.inf.cpu.cores", this.options.workload?.minCpuCores, ComparisonOperator.GtEq);
    }
    if (this.options.workload?.maxCpuCores) {
      builder.addConstraint("golem.inf.cpu.cores", this.options.workload?.maxCpuCores, ComparisonOperator.LtEq);
    }
  }

  private addGenericDecorations(builder: DemandBodyBuilder): void {
    if (this.options.subnetTag) {
      builder.addConstraint("golem.node.debug.subnet", this.options.subnetTag);
    }
  }
}
