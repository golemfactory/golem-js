import { GftpStorageProvider } from "./gftp";
import { WebSocketBrowserStorageProvider } from "./ws-browser";
import { NullStorageProvider } from "./null";
import { Logger, YagnaApi, isNode, isBrowser } from "../utils";

export function createDefaultStorageProvider(yagnaApi: YagnaApi, logger?: Logger) {
  if (isNode) {
    return new GftpStorageProvider(logger?.child("storage"));
  }
  if (isBrowser) {
    return new WebSocketBrowserStorageProvider(yagnaApi, {
      logger: logger?.child("storage"),
    });
  }
  return new NullStorageProvider();
}
