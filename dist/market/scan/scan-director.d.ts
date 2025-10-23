import { DemandBodyBuilder } from "../demand";
import { ScanOptions } from "./types";
export declare class ScanDirector {
    private options;
    constructor(options: ScanOptions);
    apply(builder: DemandBodyBuilder): Promise<void>;
    private addPaymentDecorations;
    private addWorkloadDecorations;
    private addGenericDecorations;
}
