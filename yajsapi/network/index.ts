import { RequestorApi } from "ya-ts-client/dist/ya-net/api";
import { logger } from "../utils";

class Node {
  private network: Network;
  private node_id: string;
  private ip: string;

  get_deploy_args() {

  }

  get_websocket_uri(port: number) {

  }
}

export enum NetworkStates {
  INITIALIZED = "initialize",
  CREATING = "create",
  READY = "ready",
  REMOVING = "removing",
  REMOVED = "removed",
}

export class Network {
  private _state: NetworkStates;
  private _network_id: string;
  private _network_ip: string;

  constructor(private net_api: RequestorApi,
              private ip: string,
              private owner_id?: string,
              private owner_ip?: string,
              private mask?: string,
              private gateway?: string) {

    this._state = NetworkStates.CREATING;
    this._network_ip = mask ? ``

  }
  get state() {
    return this._state;
  }

  static async create(net_api: RequestorApi, ip: string, owner_id?: string, owner_ip?: string, mask?: string, gateway?: string): Promise<Network> {
    const network = new Network(net_api, ip, owner_id, owner_ip, mask, gateway);
    // TODO:
    // state
    // network_id
    const net = await net_api.createNetwork(network.network_address, network.netmask, network.gateway)

    return network;
  }
}
