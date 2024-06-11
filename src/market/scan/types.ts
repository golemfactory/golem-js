import { BuildDemandOptions, DemandProperty } from "../demand";

// recursively make all properties optional (but not array members)
type DeepPartial<T> = T extends object
  ? T extends Array<unknown>
    ? T
    : {
        [P in keyof T]?: DeepPartial<T[P]>;
      }
  : T;

export type ScanOptions = DeepPartial<BuildDemandOptions>;

export type ScanSpecification = {
  properties: DemandProperty[];
  constraints: string[];
};
