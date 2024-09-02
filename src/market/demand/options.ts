import { RequireAtLeastOne } from "../../shared/utils/types";

/**
 * Specifies a set of options related to computation resources that will be used to form the demand
 */
export type ResourceDemandOptions = {
  /** Minimum required memory to execute application GB */
  minMemGib: number;
  /** Minimum required disk storage to execute tasks in GB */
  minStorageGib: number;
  /** Minimum required CPU threads */
  minCpuThreads: number;
  /** Minimum required CPU cores */
  minCpuCores: number;
};

/**
 * Specifies a set of options related to runtime configuration that will be used to form the demand
 */
export type RuntimeDemandOptions = {
  /** Type of engine required: vm, wasm, vm-nvidia, etc...
   * @deprecated This field is deprecated and will be removed in future versions. Please use the 'runtime.name' instead.
   */
  engine: string;

  runtime: Partial<{
    name: string;
    version: string;
  }>;

  /** Required providers capabilities to run application: example: ["vpn"] */
  capabilities: string[];
};

/**
 * Specifies a set of options related to computation manifest that can be used to form the demand
 */
export type ManifestDemandOptions = {
  manifest: string;
  /** Signature of base64 encoded Computation Payload Manifest **/
  manifestSig: string;
  /** Algorithm of manifest signature, e.g. "sha256" **/
  manifestSigAlgorithm: string;
  /** Certificate - base64 encoded public certificate (DER or PEM) matching key used to generate signature **/
  manifestCert: string;
};

/**
 * Specifies a set of options related to the Golem VM Image (GVMI) that will be used to form the demand
 */
export type ImageDemandOptions = {
  /**
   * If you want a provider to download the image from your local filesystem or
   * a different registry than the default one, you can provide the image url here.
   * Note that to use this option you need to also provide the image SHA3-224 hash.
   */
  imageUrl?: string;

  /**  finds package by its contents hash */
  imageHash?: string;

  /**  finds package by registry tag  */
  imageTag?: string;

  /**
   * Force the image download url that will be passed to the provider to use HTTPS.
   * This option is only relevant when you use `imageHash` or `imageTag` options.
   * Default is false
   */
  useHttps?: boolean;
};

export type WorkloadDemandDirectorConfigOptions = RuntimeDemandOptions &
  ResourceDemandOptions &
  RequireAtLeastOne<ImageDemandOptions & ManifestDemandOptions, "imageHash" | "imageTag" | "imageUrl" | "manifest">;
