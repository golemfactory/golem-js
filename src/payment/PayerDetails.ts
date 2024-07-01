export class PayerDetails {
  constructor(
    public readonly network: string,
    public readonly driver: string,
    public readonly address: string,
    // eslint-disable-next-line @typescript-eslint/ban-types -- keep the autocomplete for "glm" and "tglm" but allow any string
    public readonly token: "glm" | "tglm" | (string & {}),
  ) {}

  getPaymentPlatform() {
    return `${this.driver}-${this.network}-${this.token}`;
  }
}
