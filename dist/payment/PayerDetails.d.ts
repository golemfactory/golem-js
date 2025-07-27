export declare class PayerDetails {
    readonly network: string;
    readonly driver: string;
    readonly address: string;
    readonly token: "glm" | "tglm" | (string & {});
    constructor(network: string, driver: string, address: string, token: "glm" | "tglm" | (string & {}));
    getPaymentPlatform(): string;
}
