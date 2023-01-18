import test from "ava";
import { Network } from "../../yajsapi/network";
import { NetMock } from "../mock/rest";
import logger from "../../yajsapi/utils/log";

logger.transports.forEach((t) => (t.silent = true));

const netApiMock = new NetMock();

test("create network", async (t) => {
  netApiMock.setExpected("create_network", "1234");
  const network = await Network.create(netApiMock, "192.168.0.0/24", "owner");
  const { id, ip, mask, nodes } = network.get_network_info();
  t.deepEqual({ id, ip, mask }, { id: "1234", ip: "192.168.0.0", mask: "255.255.255.0" });
  t.is(nodes["192.168.0.1"], "owner");
  t.is(Object.keys(nodes).length, 1);
  t.is(network.toString(), "{ id: 1234, ip: 192.168.0.0, mask: 255.255.255.0 }");
});

test("create network with 16 bit mask", async (t) => {
  const network = await Network.create(netApiMock, "192.168.7.0/16", "1");
  const { id, ip, mask } = network.get_network_info();
  t.deepEqual({ id, ip, mask }, { id: "mock-network-id", ip: "192.168.0.0", mask: "255.255.0.0" });
});

test("create network with 24 bit mask", async (t) => {
  const network = await Network.create(netApiMock, "192.168.7.0/24", "1");
  const { id, ip, mask } = network.get_network_info();
  t.deepEqual({ id, ip, mask }, { id: "mock-network-id", ip: "192.168.7.0", mask: "255.255.255.0" });
});

test("create network with 8 bit mask", async (t) => {
  netApiMock.setExpected("create_network", "777");
  const network = await Network.create(netApiMock, "10.11.12.13/8", "1");
  const { id, ip, mask } = network.get_network_info();
  t.deepEqual({ id, ip, mask }, { id: "777", ip: "10.0.0.0", mask: "255.0.0.0" });
});

test("create network with invalid ip", async (t) => {
  await t.throwsAsync(Network.create(netApiMock, "123.1.2", "1"), {
    message: "Cidr notation should be in the form [ip number]/[range]",
  });
});

test("create network without mask", async (t) => {
  await t.throwsAsync(Network.create(netApiMock, "1.1.1.1", "1"), {
    message: "Cidr notation should be in the form [ip number]/[range]",
  });
});

test("create network with custom parameters", async (t) => {
  netApiMock.setExpected("create_network", "77");
  const network = await Network.create(netApiMock, "192.168.0.1", "owner_1", "192.168.0.7", "27", "192.168.0.2");
  const { id, ip, mask, nodes } = network.get_network_info();
  t.deepEqual({ id, ip, mask }, { id: "77", ip: "192.168.0.0", mask: "255.255.255.224" });
  t.is(nodes["192.168.0.7"], "owner_1");
});

test("add node", async (t) => {
  const network = await Network.create(netApiMock, "192.168.0.0/24", "1");
  const { node_id, ip } = await network.add_node("7", "192.168.0.7");
  t.deepEqual({ node_id, ip: ip.toString() }, { node_id: "7", ip: "192.168.0.7" });
});

test("add a few nodes", async (t) => {
  const network = await Network.create(netApiMock, "192.168.0.0/24", "1");
  const node2 = await network.add_node("2", "192.168.0.3");
  const node3 = await network.add_node("3");
  const node4 = await network.add_node("4");
  t.deepEqual({ node_id: node2.node_id, ip: node2.ip.toString() }, { node_id: "2", ip: "192.168.0.3" });
  t.deepEqual({ node_id: node3.node_id, ip: node3.ip.toString() }, { node_id: "3", ip: "192.168.0.2" });
  t.deepEqual({ node_id: node4.node_id, ip: node4.ip.toString() }, { node_id: "4", ip: "192.168.0.4" });
});

test("add node with an existing id", async (t) => {
  const network = await Network.create(netApiMock, "192.168.0.0/24", "1");
  await t.throwsAsync(network.add_node("1"), {
    message: "ID '1' has already been assigned in this network.",
  });
});

test("add node with an existing ip", async (t) => {
  const network = await Network.create(netApiMock, "192.168.0.0/24", "1");
  await network.add_node("2", "192.168.0.3");
  await t.throwsAsync(network.add_node("3", "192.168.0.3"), {
    message: "IP '192.168.0.3' has already been assigned in this network.",
  });
});

test("add node with address outside the network range", async (t) => {
  const network = await Network.create(netApiMock, "192.168.0.0/24", "1");
  await t.throwsAsync(network.add_node("2", "192.168.2.2"), {
    message: "The given IP ('192.168.2.2') address must belong to the network ('192.168.0.0/24').",
  });
});

test("add too many nodes", async (t) => {
  const network = await Network.create(netApiMock, "192.168.0.0/30", "1");
  await network.add_node("2");
  await network.add_node("3");
  await t.throwsAsync(network.add_node("4"), {
    message: "No more addresses available in 192.168.0.0/30",
  });
});

test("remove network", async (t) => {
  const network = await Network.create(netApiMock, "192.168.0.0/24", "owner");
  t.is(await network.remove(), true);
});

test("remove network that doesn't exist", async (t) => {
  const network = await Network.create(netApiMock, "192.168.0.0/24", "owner");
  netApiMock.setExpected("remove_network", null, { status: 404 });
  t.is(await network.remove(), false);
});

test("get node deploy args", async (t) => {
  const network = await Network.create(netApiMock, "192.168.0.0/24", "1");
  const node = await network.add_node("2");
  t.deepEqual(node.get_deploy_args(), {
    net: [
      {
        id: "mock-network-id",
        ip: "192.168.0.0",
        mask: "255.255.255.0",
        nodeIp: "192.168.0.2",
        nodes: {
          "192.168.0.1": "1",
          "192.168.0.2": "2",
        },
      },
    ],
  });
});

test("get node websocket uri", async (t) => {
  netApiMock.setExpected("create_network", "network_test_id");
  const network = await Network.create(netApiMock, "192.168.0.0/24", "1");
  const node = await network.add_node("2");
  t.deepEqual(node.get_websocket_uri(22), "ws://127.0.0.1/test_url_api/net/network_test_id/tcp/192.168.0.2/22");
});
