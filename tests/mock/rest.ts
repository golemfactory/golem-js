import { Net } from "../../yajsapi/rest";

export class NetMock extends Net {
  constructor() {
    // @ts-ignore
    super(null);
  }
  setExpected(function_name, result, error?) {
    this[function_name] = async () => new Promise((res, rej) => {
      if (error) rej(error);
      res(result);
      result = 'test';
    })
  }
  async create_network(ip: string, mask?: string, gateway?: string): Promise<string> { return 'test'; }
  async remove_network(id: string) { }
  async add_address(network_id: string, ip: string) { }
  async add_node(network_id: string, node_id: string, ip: string) { }
  get_url() { return 'http://127.0.0.1/test_url_api'; }
}
