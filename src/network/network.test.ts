import { Network } from "./network";
import { instance, mock, when } from "@johanblumenberg/ts-mockito";
import { NetworkNode } from "./node";
import { GolemNetworkError, NetworkErrorCode } from "./error";
import { IPv4 } from "ip-num";

const mockNetworkNode = mock(NetworkNode);
when(mockNetworkNode.id).thenReturn("network-node-id");
when(mockNetworkNode.ip).thenReturn("192.168.0.2");

describe("Network", () => {
  describe("Creating", () => {
    test("should create a network from the ip given in Cidr notation", () => {
      const network = new Network("network-id", "192.168.0.0/24");
      const networkInfo = network.getNetworkInfo();
      expect(networkInfo.id).toEqual("network-id");
      expect(networkInfo.ip).toEqual("192.168.0.0");
      expect(networkInfo.mask).toEqual("255.255.255.0");
    });
    test("should create a network from the ip and mask given in decimal dotted noatation", () => {
      const network = new Network("network-id", "192.168.0.0", "255.255.255.0");
      const networkInfo = network.getNetworkInfo();
      expect(networkInfo.id).toEqual("network-id");
      expect(networkInfo.ip).toEqual("192.168.0.0");
      expect(networkInfo.mask).toEqual("255.255.255.0");
    });
    test("should not create a network with invalid ip", () => {
      expect(() => new Network("network-id", "192.168.0")).toThrow(
        new Error("Cidr notation should be in the form [ip number]/[range]"),
      );
    });
    test("should not create a network with invalid mask", () => {
      expect(() => new Network("network-id", "192.168.0.0", "255.0")).toThrow(
        new Error("An IP4 number cannot have less or greater than 4 octets"),
      );
    });
    test("should not create a network with invalid gatewey", () => {
      expect(() => new Network("network-id", "192.168.0.0", "255.255.255.0", "234")).toThrow(
        new Error("An IP4 number cannot have less or greater than 4 octets"),
      );
    });
  });
  describe("Adding nodes", () => {
    test("should add a node to the network", () => {
      const network = new Network("network-id", "192.168.0.0/24");
      network.addNode(instance(mockNetworkNode));
      const networkInfo = network.getNetworkInfo();
      expect(networkInfo.nodes).toEqual({ "192.168.0.2": "network-node-id" });
    });
    test("should not add a node with the existing id", () => {
      const network = new Network("network-id", "192.168.0.0/24");
      network.addNode(instance(mockNetworkNode));
      expect(() => network.addNode(instance(mockNetworkNode))).toThrow(
        new GolemNetworkError(
          `Node network-node-id has already been added to this network`,
          NetworkErrorCode.AddressAlreadyAssigned,
        ),
      );
    });
    test("should not add a node to removed network", () => {
      const network = new Network("network-id", "192.168.0.0/24");
      network.remove();
      expect(() => network.addNode(instance(mockNetworkNode))).toThrow(
        new GolemNetworkError(`Unable to add node network-node-id to removed network`, NetworkErrorCode.NetworkRemoved),
      );
    });
    test("should get first avialble ip adrress", () => {
      const network = new Network("network-id", "192.168.0.0/24");
      expect(network.getFirstAvailableIpAddress().toString()).toEqual("192.168.0.1");
    });
  });
  describe("Remove nodes", () => {
    test("should remove a node from the network", () => {
      const network = new Network("network-id", "192.168.0.0/24");
      const networkNode = instance(mockNetworkNode);
      network.addNode(networkNode);
      network.removeNode(networkNode);
      expect(network.getNetworkInfo().nodes).toEqual({});
    });
    test("should not remove a node if it does not belong to the network", () => {
      const network = new Network("network-id", "192.168.0.0/24");
      const networkNode = instance(mockNetworkNode);
      network.addNode(networkNode);
      when(mockNetworkNode.id).thenReturn("test-id-2");
      expect(() => network.removeNode(instance(mockNetworkNode))).toThrow(
        new GolemNetworkError(`There is no node test-id-2 in the network`, NetworkErrorCode.NodeRemovalFailed),
      );
    });
    test("should not remove a node if network has been removed", () => {
      const network = new Network("network-id", "192.168.0.0/24");
      const networkNode = instance(mockNetworkNode);
      when(mockNetworkNode.id).thenReturn("test-id-1");
      network.addNode(networkNode);
      network.remove();
      expect(() => network.removeNode(networkNode)).toThrow(
        new GolemNetworkError(`Unable to remove node test-id-1 from removed network`, NetworkErrorCode.NetworkRemoved),
      );
    });
  });
  describe("Validating", () => {
    test("should check if node id is unique", () => {
      const network = new Network("network-id", "192.168.0.0/24");
      when(mockNetworkNode.id).thenReturn("test-id");
      network.addNode(instance(mockNetworkNode));
      expect(network.isNodeIdUnique("test-id")).toBe(false);
      expect(network.isNodeIdUnique("test-id-2")).toBe(true);
    });
    test("should check if node ip is unique", () => {
      const network = new Network("network-id", "192.168.0.0/24");
      when(mockNetworkNode.ip).thenReturn("192.168.0.2");
      network.addNode(instance(mockNetworkNode));
      expect(network.isNodeIpUnique(IPv4.fromDecimalDottedString("192.168.0.2"))).toBe(false);
      expect(network.isNodeIpUnique(IPv4.fromDecimalDottedString("192.168.0.3"))).toBe(true);
    });
    test("should check if node ip belongs to the network", () => {
      const network = new Network("network-id", "192.168.0.0/24");
      expect(network.isIpInNetwork(IPv4.fromDecimalDottedString("192.168.0.2"))).toBe(true);
      expect(network.isIpInNetwork(IPv4.fromDecimalDottedString("195.168.0.3"))).toBe(false);
      expect(network.isIpInNetwork(IPv4.fromDecimalDottedString("192.169.0.3"))).toBe(false);
      expect(network.isIpInNetwork(IPv4.fromDecimalDottedString("192.168.1.3"))).toBe(false);
    });
  });
});
