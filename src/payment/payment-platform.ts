export class PaymentPlatform {
  public readonly token: string = "tglm";

  constructor(
    public readonly network: string = "holesky",
    public readonly driver: string = "erc20",
  ) {
    const mainnets = ["polygon", "mainnet"];

    this.token = mainnets.includes(this.network) ? "glm" : "tglm";
  }

  toString() {
    return `${this.driver}-${this.network}-${this.token}`;
  }
}
