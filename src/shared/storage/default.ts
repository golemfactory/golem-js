import { WebSocketStorageProvider } from "./ws";
import { Logger, YagnaApi } from "../utils";

export function createDefaultStorageProvider(yagnaApi: YagnaApi, logger?: Logger) {
  return new WebSocketStorageProvider(yagnaApi, {
    logger: logger?.child("storage"),
  });
}
