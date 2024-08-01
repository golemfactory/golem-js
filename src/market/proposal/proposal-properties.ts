/**
 * Describes the type representing properties from the perspective of Golem Market Protocol
 *
 * Golem Protocol defines "properties" as a flat list of key/value pairs.
 *
 * The protocol itself does not dictate what properties should or shouldn't be defined. Such details
 * are left for the Provider and Requestor to agree upon outside the protocol.
 *
 * The mentioned agreements can be done in a P2P manner between the involved entities, or both parties
 * can decide to adhere to a specific "standard" which determines which properties are "mandatory".
 *
 * Specific property definitions and requirements were provided in Golem _standards_ and _architecture proposals_.
 *
 * @link https://github.com/golemfactory/golem-architecture/tree/master/standards Golem standards
 * @link https://github.com/golemfactory/golem-architecture/tree/master/gaps Golem Architecture Proposals
 */
export type GenericGolemProtocolPropertyType = Record<string, string | number | string[] | number[] | boolean>;
/**
 * Properties defined by GAP-3
 *
 * @link https://github.com/golemfactory/golem-architecture/blob/master/gaps/gap-3_mid_agreement_payments/gap-3_mid_agreement_payments.md
 */
export type Gap3MidAgreementPaymentProps = Partial<{
  "golem.com.scheme.payu.debit-note.interval-sec?": number;
  "golem.com.scheme.payu.payment-timeout-sec?": number;
}>;

/**
 * Properties defined by GAP-35
 *
 * @link https://github.com/golemfactory/golem-architecture/blob/master/gaps/gap-35_gpu_pci_capability/gap-35_gpu_pci_capability.md
 */
export type Gap35GpuSupportProps = Partial<{
  "golem.!exp.gap-35.v1.inf.gpu.model": string;
  "golem.!exp.gap-35.v1.inf.gpu.clocks.graphics.mhz": number;
  "golem.!exp.gap-35.v1.inf.gpu.clocks.memory.mhz": number;
  "golem.!exp.gap-35.v1.inf.gpu.clocks.sm.mhz": number;
  "golem.!exp.gap-35.v1.inf.gpu.clocks.video.mhz": number;
  "golem.!exp.gap-35.v1.inf.gpu.cuda.cores": number;
  "golem.!exp.gap-35.v1.inf.gpu.cuda.enabled": boolean;
  "golem.!exp.gap-35.v1.inf.gpu.cuda.version": string;
  "golem.!exp.gap-35.v1.inf.gpu.memory.bandwidth.gib": number;
  "golem.!exp.gap-35.v1.inf.gpu.memory.total.gib": number;
}>;
/**
 * @link https://github.com/golemfactory/golem-architecture/tree/master/standards/0-commons
 */
export type StandardCommonProps = {
  "golem.activity.caps.transfer.protocol": ("http" | "https" | "gftp")[];
  "golem.inf.cpu.architecture": string;
  "golem.inf.cpu.brand": string;
  "golem.inf.cpu.capabilities": string[];
  "golem.inf.cpu.cores": number;
  "golem.inf.cpu.model": string;
  "golem.inf.cpu.threads": number;
  "golem.inf.cpu.vendor": string;
  "golem.inf.mem.gib": number;
  "golem.inf.storage.gib": number;
  "golem.runtime.capabilities": string[];
  "golem.runtime.name": string;
  "golem.runtime.version": string;
};

/**
 * https://github.com/golemfactory/golem-architecture/blob/master/standards/2-service/srv.md
 */
export type StandardNodeProps = {
  "golem.node.id.name": string;
  /** @deprecated Do not rely on this, it's mentioned in the standard, but not implemented FIXME #yagna */
  "golem.node.geo.country_code"?: string;
};

/**
 * @link https://github.com/golemfactory/golem-architecture/blob/master/standards/3-commercial/com.md
 */
export type StandardCommercialProps = {
  "golem.com.payment.debit-notes.accept-timeout?": number;
  /** @example "erc20-polygon-glm" */
  "golem.com.payment.chosen-platform": string;
  "golem.com.payment.platform.erc20-polygon-glm.address"?: string;
  "golem.com.payment.platform.erc20-holesky-tglm.address"?: string;
  "golem.com.payment.platform.erc20-mumbai-tglm.address"?: string;
  "golem.com.payment.protocol.version": number;
  /** @example payu */
  "golem.com.scheme": string;
  /** @deprecated replaced by `golem.com.scheme.payu.debit-note.interval-sec?` in GAP-3 */
  "golem.com.scheme.payu.interval_sec"?: number;
  "golem.com.pricing.model": "linear";
  "golem.com.pricing.model.linear.coeffs": number[];
  "golem.com.usage.vector": string[];
};

/**
 * @link https://github.com/golemfactory/golem-architecture/blob/master/standards/2-service/srv.md
 */
export type StandardServiceProps = {
  "golem.srv.caps.multi-activity": boolean;
};

/**
 * @link https://github.com/golemfactory/golem-architecture/blob/master/standards/2-service/srv/comp.md
 */
export type StandardComputationPlatformProps = {
  "golem.srv.comp.expiration": number;
  "golem.srv.comp.task_package": string;
};

export type ProposalProperties =
  // Start from most generic definition of what a property is
  GenericGolemProtocolPropertyType &
    // Attach standard specific property sets
    StandardCommonProps &
    StandardNodeProps &
    StandardCommercialProps &
    StandardServiceProps &
    StandardComputationPlatformProps &
    // Attach GAP specific property sets
    Gap3MidAgreementPaymentProps &
    Gap35GpuSupportProps &
    /**
     * These are around byt not really specified in any standard
     * FIXME #yagna - Standardize?
     */
    Partial<{
      "golem.node.debug.subnet": string;
      "golem.node.net.is-public": boolean;
      "golem.srv.caps.payload-manifest": boolean;
    }>;
