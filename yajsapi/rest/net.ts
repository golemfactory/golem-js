import { RequestorApi } from "ya-ts-client/dist/ya-net/api";
import { Configuration } from "ya-ts-client/dist/ya-net";

export class Net {
  private _api!: RequestorApi;
  private _cfg: Configuration;

  constructor(private cfg: Configuration) {
    this._cfg = cfg;
    this._api = new RequestorApi(cfg);
  }

  async create_network(ip: string, mask?: string, gateway?: string): Promise<string> {
    const { data: response } = await this._api.createNetwork({ ip, mask, gateway });
    return response.id!;
  }

  async remove_network(id: string) {
    await this._api.removeNetwork(id);
  }

  async add_address(network_id: string, ip: string) {
    await this._api.addAddress(network_id, { ip });
  }

  async add_node(network_id: string, node_id: string, ip: string) {
    await this._api.addNode(network_id, { id: node_id, ip });
  }

  get_url() {
    return this._cfg.basePath!;
  }
}
