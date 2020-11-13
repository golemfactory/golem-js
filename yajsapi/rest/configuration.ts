import { yaActivity, yaMarket, yaPayment } from "ya-ts-client";
import { Agent as HttpAgent } from "http";
import { Agent as HttpsAgent } from "https";

const DEFAULT_API_URL: string = "http://127.0.0.1:7465";

class MissingConfiguration extends Error {
  constructor(key: string, description: string) {
    super(description);
    this.name = key;
  }
}

function env_or_fail(key: string, description: string): string {
  let val = process.env[key];
  if (!val) throw new MissingConfiguration(key, description);
  return val;
}

export class Configuration {
  private __app_key: string | null;
  private __url;
  private __market_url!: string;
  private __payment_url!: string;
  private __activity_url!: string;
  private __axios_opts!: object;

  constructor(
    app_key = null,
    url?: string,
    market_url?: string,
    payment_url?: string,
    activity_url?: string
  ) {
    this.__app_key =
      app_key || env_or_fail("YAGNA_APPKEY", "API authentication token");
    this.__url = url || DEFAULT_API_URL;

    const resolve_url = (
      given_url?: string,
      env_val?: string,
      prefix?: string
    ): string => {
      return (
        given_url || process.env[env_val as string] || `${this.__url}${prefix}`
      );
    };

    this.__market_url = resolve_url(
      market_url,
      "YAGNA_MARKET_URL",
      "/market-api/v1"
    );
    this.__payment_url = resolve_url(
      payment_url,
      "YAGNA_PAYMENT_URL",
      "/payment-api/v1"
    );
    this.__activity_url = resolve_url(
      activity_url,
      "YAGNA_ACTIVITY_URL",
      "/activity-api/v1"
    );

    this.__axios_opts = {
      httpAgent: new HttpAgent({
        keepAlive: true,
      }),
      httpsAgent: new HttpsAgent({
        keepAlive: true,
      }),
    };
  }

  app_key(): string | null {
    return this.__app_key;
  }

  market_url(): string | null {
    return this.__market_url;
  }

  payment_url(): string {
    return this.__payment_url;
  }

  activity_url(): string {
    return this.__activity_url;
  }

  market(): yaMarket.Configuration {
    let cfg = new yaMarket.Configuration({
      apiKey: this.app_key() as string,
      basePath: this.__market_url,
      accessToken: this.app_key() as string,
      baseOptions: this.__axios_opts,
    });
    return cfg;
  }

  payment(): yaPayment.Configuration {
    let cfg = new yaPayment.Configuration({
      apiKey: this.app_key() as string,
      basePath: this.__payment_url,
      accessToken: this.app_key() as string,
      baseOptions: this.__axios_opts,
    });
    return cfg;
  }

  activity(): yaActivity.Configuration {
    let cfg = new yaActivity.Configuration({
      apiKey: this.app_key() as string,
      basePath: this.__activity_url,
      accessToken: this.app_key() as string,
      baseOptions: this.__axios_opts,
    });
    return cfg;
  }
}
