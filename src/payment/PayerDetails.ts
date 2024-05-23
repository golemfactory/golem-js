export class PayerDetails {
  constructor(
    public readonly network: string,
    public readonly driver: string,
    public readonly address: string,
    public readonly token: "glm" | "tglm",
  ) {}

  getPaymentPlatform() {
    return `${this.driver}-${this.network}-${this.token}`;
  }
}
