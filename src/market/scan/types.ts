export type ScanOptions = {
  workload?: {
    /**
     * @deprecated This param is deprecated and will be removed in future versions. Please use the 'runtime.name' instead.
     */
    engine?: string;
    runtime?: {
      name?: string;
      version?: string;
    };
    capabilities?: string[];
    minMemGib?: number;
    maxMemGib?: number;
    minStorageGib?: number;
    maxStorageGib?: number;
    minCpuThreads?: number;
    maxCpuThreads?: number;
    minCpuCores?: number;
    maxCpuCores?: number;
  };
  subnetTag?: string;
  payment?: {
    network: string;
    /** @default erc20 */
    driver?: string;
    /** @default "glm" if network is mainnet or polygon, "tglm" otherwise */
    token?: string;
  };
};

export type ScanSpecification = {
  constraints: string[];
};
