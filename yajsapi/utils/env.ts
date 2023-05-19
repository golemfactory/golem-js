export class EnvUtils {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {

  }

  static getYagnaApiUrl(): string {
    return (typeof process !== "undefined" ? process.env.YAGNA_API_URL : "") || "http://127.0.0.1:7465";
  }

  static getYagnaAppKey(): string {
    return typeof process !== "undefined" ? process.env.YAGNA_APPKEY ?? "" : "";
  }
}
