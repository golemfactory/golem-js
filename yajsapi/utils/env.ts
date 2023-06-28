// ? why those are functions ?
import { isNode } from "./runtimeContextChecker";

export const EnvUtils = {
  getYagnaApiUrl(): string {
    return (isNode ? process.env.YAGNA_API_URL : "") || "http://127.0.0.1:7465";
  },

  getYagnaAppKey(): string {
    return isNode ? process.env.YAGNA_APPKEY ?? "" : "";
  },

  getYagnaSubnet(): string {
    return isNode ? process.env.YAGNA_SUBNET ?? "public" : "public";
  },

  getRepoUrl(): string {
    return isNode ? process.env.YAJSAPI_REPO_URL ?? "https://registry.golem.network" : "https://registry.golem.network";
  },
};
