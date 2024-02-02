import { isNode } from "./runtimeContextChecker";

export function getYagnaApiUrl(): string {
  return (isNode ? process?.env.YAGNA_API_URL : "") || "http://127.0.0.1:7465";
}

export function getYagnaAppKey(): string {
  return isNode ? process?.env.YAGNA_APPKEY ?? "" : "";
}

export function getYagnaSubnet(): string {
  return isNode ? process?.env.YAGNA_SUBNET ?? "public" : "public";
}

export function getRepoUrl(): string {
  return isNode
    ? process?.env.GOLEM_REGISTRY_URL ?? "https://registry.golem.network"
    : "https://registry.golem.network";
}

export function getPaymentNetwork(): string {
  return isNode ? process.env.PAYMENT_NETWORK ?? "holesky" : "holesky";
}

export function isDevMode(): boolean {
  return isNode ? process?.env.GOLEM_DEV_MODE === "true" : false;
}
