import { GolemNetworkError, Logger, NetworkErrorCode, YagnaApi } from "../../../index";
import { anything, capture, imock, instance, mock, reset, verify, when } from "@johanblumenberg/ts-mockito";
import { NetworkApiAdapter } from "./network-api-adapter";
import * as YaTsClient from "ya-ts-client";

const mockNetworkApiAdapter = mock(NetworkApiAdapter);
const mockYagna = mock(YagnaApi);
const mockNet = mock(YaTsClient.NetApi.RequestorService);

let networkApi: NetworkApiAdapter;

describe("Network", () => {
  beforeEach(() => {
    reset(mockYagna);
    reset(mockNetworkApiAdapter);
    networkApi = new NetworkApiAdapter(instance(mockYagna), instance(imock<Logger>()));
    when(mockYagna.net).thenReturn(instance(mockNet));
    when(mockNet.createNetwork(anything())).thenResolve({
      id: "network-id",
      ip: "192.168.0.0",
      mask: "255.255.255.0",
    });
  });
  describe("Creating", () => {
    it("should create network", async () => {
      const network = await networkApi.createNetwork({ id: "test-id" });
      const { ip, mask, nodes } = network.getNetworkInfo();
      expect(ip).toEqual("192.168.0.0");
      expect(mask).toEqual("255.255.255.0");
    });

    it("should create network with 16 bit mask", async () => {
      await networkApi.createNetwork({ id: "1", ip: "192.168.7.0/16" });
      expect(capture(mockNet.createNetwork).last()).toEqual([
        {
          id: "1",
          ip: "192.168.7.0",
          mask: "255.255.0.0",
        },
      ]);
    });

    it("should create network with 24 bit mask", async () => {
      const network = await networkApi.createNetwork({ id: "1", ip: "192.168.7.0/24" });
      const { ip, mask } = network.getNetworkInfo();
      expect({ ip, mask }).toEqual({ ip: "192.168.7.0", mask: "255.255.255.0" });
    });

    it("should create network with 8 bit mask", async () => {
      const network = await networkApi.createNetwork({ id: "1", ip: "192.168.7.0/8" });
      const { ip, mask } = network.getNetworkInfo();
      expect({ ip, mask }).toEqual({ ip: "192.0.0.0", mask: "255.0.0.0" });
    });

    it("should not create network with invalid ip", async () => {
      const shouldFail = await networkApi.createNetwork({ id: "1", ip: "123.1.2" });
      await expect(shouldFail).rejects.toMatchError(
        new GolemNetworkError(
          "Unable to create network. Error: Cidr notation should be in the form [ip number]/[range]",
          NetworkErrorCode.NetworkCreationFailed,
          undefined,
          new Error("Cidr notation should be in the form [ip number]/[range]"),
        ),
      );
    });

    it("should not create network without mask", async () => {
      const shouldFail = await networkApi.createNetwork({ id: "1", ip: "1.1.1.1" });
      await expect(shouldFail).rejects.toMatchError(
        new GolemNetworkError(
          "Unable to create network. Error: Cidr notation should be in the form [ip number]/[range]",
          NetworkErrorCode.NetworkCreationFailed,
          undefined,
          new Error("Cidr notation should be in the form [ip number]/[range]"),
        ),
      );
    });

    it("should create network with custom options", async () => {
      const network = await networkApi.createNetwork({
        ip: "192.168.0.1",
        id: "owner_1",
        mask: "27",
        gateway: "192.168.0.2",
      });
      const { ip, mask, nodes } = network.getNetworkInfo();
      expect({ ip, mask }).toEqual({ ip: "192.168.0.0", mask: "255.255.255.224" });
      expect(nodes["192.168.0.7"]).toEqual("owner_1");
    });
  });

  describe("Nodes", () => {
    it("should add node", async () => {
      const network = await networkApi.createNetwork({ id: "1", ip: "192.168.0.0/24" });
      const { id, ip } = await networkApi.addNetworkNode(network, "7", "192.168.0.7");
      expect({ id, ip: ip.toString() }).toEqual({ id: "7", ip: "192.168.0.7" });
    });

    it("should add a few nodes", async () => {
      const network = await networkApi.createNetwork({ id: "1", ip: "192.168.0.0/24" });
      const node2 = await networkApi.addNetworkNode(network, "2", "192.168.0.3");
      const node3 = await networkApi.addNetworkNode(network, "3");
      const node4 = await networkApi.addNetworkNode(network, "4");
      expect({ id: node2.id, ip: node2.ip.toString() }).toEqual({ id: "2", ip: "192.168.0.3" });
      expect({ id: node3.id, ip: node3.ip.toString() }).toEqual({ id: "3", ip: "192.168.0.2" });
      expect({ id: node4.id, ip: node4.ip.toString() }).toEqual({ id: "4", ip: "192.168.0.4" });
    });

    it("should not add node with an existing ID", async () => {
      const network = await networkApi.createNetwork({ id: "1", ip: "192.168.0.0/24" });
      await expect(networkApi.addNetworkNode(network, "1")).rejects.toMatchError(
        new GolemNetworkError(
          "Network ID '1' has already been assigned in this network.",
          NetworkErrorCode.AddressAlreadyAssigned,
          network.getNetworkInfo(),
        ),
      );
    });

    it("should not add node with an existing IP", async () => {
      const network = await networkApi.createNetwork({ id: "1", ip: "192.168.0.0/24" });
      await networkApi.addNetworkNode(network, "2", "192.168.0.3");
      await expect(networkApi.addNetworkNode(network, "3", "192.168.0.3")).rejects.toMatchError(
        new GolemNetworkError(
          "IP '192.168.0.3' has already been assigned in this network.",
          NetworkErrorCode.AddressAlreadyAssigned,
          network.getNetworkInfo(),
        ),
      );
    });

    it("should not add node with address outside the network range", async () => {
      const network = await networkApi.createNetwork({ id: "1", ip: "192.168.0.0/24" });
      await expect(networkApi.addNetworkNode(network, "2", "192.168.2.2")).rejects.toMatchError(
        new GolemNetworkError(
          "The given IP ('192.168.2.2') address must belong to the network ('192.168.0.0/24').",
          NetworkErrorCode.AddressOutOfRange,
          network.getNetworkInfo(),
        ),
      );
    });

    it("should not add too many nodes", async () => {
      const network = await networkApi.createNetwork({ id: "1", ip: "192.168.0.0/30" });
      await networkApi.addNetworkNode(network, "2");
      await networkApi.addNetworkNode(network, "3");
      await expect(networkApi.addNetworkNode(network, "4")).rejects.toMatchError(
        new GolemNetworkError(
          "No more addresses available in 192.168.0.0/30",
          NetworkErrorCode.NoAddressesAvailable,
          network.getNetworkInfo(),
        ),
      );
    });

    it("should throw an error when there are no free IPs available", async () => {
      const network = await networkApi.createNetwork({ id: "1", ip: "192.168.0.0/30" });
      await networkApi.addNetworkNode(network, "2");
      await networkApi.addNetworkNode(network, "3");
      await networkApi.removeNetworkNode(network, "2");
      await expect(networkApi.addNetworkNode(network, "4")).rejects.toMatchError(
        new GolemNetworkError(
          "No more addresses available in 192.168.0.0/30",
          NetworkErrorCode.NoAddressesAvailable,
          network.getNetworkInfo(),
        ),
      );
    });

    it("should return true if node belongs to the network", async () => {
      const network = await networkApi.createNetwork({ id: "1", ip: "192.168.0.0/30" });
      await networkApi.addNetworkNode(network, "2");
      expect(network.hasNode("2")).toEqual(true);
    });

    it("should return false if node does not belong to the network", async () => {
      const network = await networkApi.createNetwork({ id: "1", ip: "192.168.0.0/30" });
      await networkApi.addNetworkNode(network, "2");
      expect(network.hasNode("77")).toEqual(false);
    });

    it("should get node network config", async () => {
      const network = await networkApi.createNetwork({ id: "1", ip: "192.168.0.0/24" });
      const node = await networkApi.addNetworkNode(network, "2");
      expect(node.getNetworkConfig()).toEqual({
        net: [
          {
            id: network.id,
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

    it("should get node websocket uri", async () => {
      const network = await networkApi.createNetwork({ id: "1", ip: "192.168.0.0/24" });
      const node = await networkApi.addNetworkNode(network, "2");
      expect(networkApi.getWebsocketUri(node, 22)).toEqual(
        `ws://${process.env?.YAGNA_API_URL?.substring(7) || "localhost"}/net-api/v1/net/${
          network.id
        }/tcp/192.168.0.2/22`,
      );
    });

    it("should remove node from the network", async () => {
      const network = await networkApi.createNetwork({ id: "1", ip: "192.168.0.0/24" });
      const node = await networkApi.addNetworkNode(network, "7");
      await networkApi.removeNetworkNode(network, node.id);
      verify(mockNet.removeNode(network.id, node.id)).once();
    });

    it("should not remove node from the network if it does not exist", async () => {
      const network = await networkApi.createNetwork({ id: "1", ip: "192.168.0.0/24" });
      await networkApi.addNetworkNode(network, "7");
      await expect(networkApi.removeNetworkNode(network, "88")).rejects.toMatchError(
        new GolemNetworkError(
          "Unable to remove node 88. There is no such node in the network",
          NetworkErrorCode.NodeRemovalFailed,
          network.getNetworkInfo(),
        ),
      );
    });
  });

  describe("Removing", () => {
    it("should remove network", async () => {
      const network = await networkApi.createNetwork({ id: "1", ip: "192.168.0.0/24" });
      await networkApi.removeNetwork(network.id);
      verify(mockNet.removeNetwork(anything())).once();
    });

    it("should not remove network that doesn't exist", async () => {
      const network = await networkApi.createNetwork({ id: "1", ip: "192.168.0.0/24" });

      when(mockNet.removeNetwork(anything())).thenReject(new Error("404"));

      await expect(networkApi.removeNetwork(network.id)).rejects.toMatchError(
        new GolemNetworkError(
          `Unable to remove network. Error: 404`,
          NetworkErrorCode.NetworkRemovalFailed,
          network.getNetworkInfo(),
          new Error("404"),
        ),
      );
    });
  });
});
