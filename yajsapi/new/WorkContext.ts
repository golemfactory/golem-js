import { StorageProvider } from "../storage";
import { Callable } from "../utils";
import { NetworkNode } from "../network";

export class WorkContext {
  constructor(
    private readonly id: string,
    private readonly storage: StorageProvider,
    private readonly emitter: Callable<[StorageEvent], void> | null = null,
    private readonly provider_info: { provider_id: string; provider_name: string },
    private readonly network_node?: NetworkNode
  ) {}

  send_file() {}
  send_json() {}
  download_file() {}
  run() {}
  commit() {}
  log() {}
}
