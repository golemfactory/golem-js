export class PayerDetails {
  public readonly token: "glm" | "tglm";

  constructor(
    public readonly network: string,
    public readonly driver: string,
    public readonly address: string,
  ) {
    const mainnets = ["polygon", "mainnet"];

    this.token = mainnets.includes(this.network) ? "glm" : "tglm";
  }

  getPaymentPlatform() {
    return `${this.driver}-${this.network}-${this.token}`;
  }
}
