// TODO: replace with a proper REST API client once ya-client and ya-ts-client are updated
// https://github.com/golemfactory/golem-js/issues/290
import axios from "axios";
import { YagnaOptions } from "../executor";
import { EnvUtils } from "../utils";

/**
 * A helper function to get the requestor's ID
 * @param options
 * @return requestorId
 */
export const getIdentity = async (options?: { yagnaOptions?: YagnaOptions }): Promise<string> => {
  const apiKey = options?.yagnaOptions?.apiKey || EnvUtils.getYagnaAppKey();
  if (!apiKey) throw new Error("Api key not defined");
  const basePath = options?.yagnaOptions?.basePath || EnvUtils.getYagnaApiUrl();
  const apiUrl = `${basePath}/me`;
  const {
    data: { identity },
  } = await axios.get(apiUrl, {
    headers: { authorization: `Bearer ${apiKey}` },
  });
  return identity;
};
