import { RequestorApi } from "ya-ts-client/dist/ya-net/api";
import * as models from "ya-ts-client/dist/ya-net/src/models";

export class Net {
  constructor(private _api: RequestorApi) { }

  async create_network(ip: string, mask?: string, gateway?: string): Promise<models.Network> {
    const network = await this._api.createNetwork({ ip, mask, gateway });
    return network.data;
  }

  async remove_network(id: string) {
    await this._api.removeNetwork(id);
  }

  async add_address(network_id: string, ip: string) {
    await this._api.addAddress(network_id, { ip });
  }

  async add_node_node(network_id: string, node_id: string, ip: string) {
    await this._api.addNode(network_id, { id: node_id, ip });
  }
}
