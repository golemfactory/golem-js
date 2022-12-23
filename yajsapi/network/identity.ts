// TODO: replace with a proper REST API client once ya-client and ya-ts-client are updated
// https://github.com/golemfactory/yajsapi/issues/290
import axios from "axios";
import { YagnaOptions } from "../executor";

export const getIdentity = async (options?: { yagnaOptions?: YagnaOptions }): Promise<string> => {
  const apiKey = options?.yagnaOptions?.apiKey || process.env.YAGNA_APPKEY;
  if (!apiKey) throw new Error("Api key not defined");
  const basePath = options?.yagnaOptions?.basePath || process.env.YAGNA_API_URL || "http://127.0.0.1:7465";
  const apiUrl = `${basePath}/me`;
  const {
    data: { identity },
  } = await axios.get(apiUrl, {
    headers: { authorization: `Bearer ${apiKey}` },
  });
  return identity;
};
