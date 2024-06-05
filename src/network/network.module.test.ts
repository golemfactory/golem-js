import {
  GolemNetworkError,
  Logger,
  Network,
  NetworkErrorCode,
  NetworkInfo,
  NetworkModuleImpl,
  NetworkNode,
} from "../index";
import { mock, anything, capture, imock, instance, reset, verify, when } from "@johanblumenberg/ts-mockito";
import { INetworkApi } from "./api";
import { IPv4 } from "ip-num";

const mockNetworkApi = imock<INetworkApi>();
const mockNetwork = mock(Network);

let networkModule: NetworkModuleImpl;

describe("Network", () => {
  beforeEach(() => {
    reset(mockNetworkApi);
    reset(mockNetwork);
    networkModule = new NetworkModuleImpl({
      networkApi: instance(mockNetworkApi),
      logger: instance(imock<Logger>()),
    });
    when(mockNetworkApi.createNetwork(anything())).thenResolve(instance(mockNetwork));
    when(mockNetwork.getNetworkInfo()).thenReturn({
      id: "test-id-1",
      ip: "192.168.0.0",
      mask: "255.255.255.0",
    } as NetworkInfo);
    when(mockNetwork.isIpInNetwork(anything())).thenReturn(true);
    when(mockNetwork.isNodeIpUnique(anything())).thenReturn(true);
    when(mockNetwork.isNodeIdUnique(anything())).thenReturn(true);
    when(mockNetwork.getFirstAvailableIpAddress()).thenReturn(IPv4.fromString("192.168.0.1"));
  });

  describe("Creating", () => {
    it("should create network with default ip and mask", async () => {
      await networkModule.createNetwork();
      expect(capture(mockNetworkApi.createNetwork).last()).toEqual([
        {
          ip: "192.168.0.0",
          mask: "255.255.255.0",
        },
      ]);
    });

    it("should create network with 16 bit mask", async () => {
      await networkModule.createNetwork({ ip: "192.168.7.0/16" });
      expect(capture(mockNetworkApi.createNetwork).last()).toEqual([
        {
          ip: "192.168.0.0",
          mask: "255.255.0.0",
        },
      ]);
    });

    it("should create network with 24 bit mask", async () => {
      await networkModule.createNetwork({ ip: "192.168.7.0/24" });
      expect(capture(mockNetworkApi.createNetwork).last()).toEqual([
        {
          ip: "192.168.7.0",
          mask: "255.255.255.0",
        },
      ]);
    });

    it("should create network with 8 bit mask", async () => {
      await networkModule.createNetwork({ ip: "192.168.7.0/8" });
      expect(capture(mockNetworkApi.createNetwork).last()).toEqual([
        {
          ip: "192.0.0.0",
          mask: "255.0.0.0",
        },
      ]);
    });

    it("should not create network with invalid ip", async () => {
      const shouldFail = networkModule.createNetwork({ ip: "123.1.2" });
      await expect(shouldFail).rejects.toMatchError(
        new GolemNetworkError(
          "Unable to create network. Error: An IP4 number cannot have less or greater than 4 octets",
          NetworkErrorCode.NetworkCreationFailed,
          undefined,
          new Error("An IP4 number cannot have less or greater than 4 octets"),
        ),
      );
    });

    it("should create network with custom gateway", async () => {
      await networkModule.createNetwork({
        ip: "192.168.0.1/27",
        gateway: "192.168.0.2",
      });
      expect(capture(mockNetworkApi.createNetwork).last()).toEqual([
        {
          ip: "192.168.0.0",
          mask: "255.255.255.224",
          gateway: "192.168.0.2",
        },
      ]);
    });
  });
  describe("Nodes", () => {
    it("should create a new node", async () => {
      const network = instance(mockNetwork);
      await networkModule.createNetworkNode(network, "7", "192.168.0.7");
      expect(capture(mockNetworkApi.createNetworkNode).last()).toEqual([network, "7", "192.168.0.7"]);
    });

    it("should create a few nodes", async () => {
      const network = instance(mockNetwork);
      await networkModule.createNetworkNode(network, "2", "192.168.0.3");
      await networkModule.createNetworkNode(network, "3", "192.168.0.7");
      expect(capture(mockNetworkApi.createNetworkNode).first()).toEqual([network, "2", "192.168.0.3"]);
      expect(capture(mockNetworkApi.createNetworkNode).last()).toEqual([network, "3", "192.168.0.7"]);
    });

    it("should not create a node with an existing ID", async () => {
      const network = instance(mockNetwork);
      when(mockNetwork.isNodeIdUnique("2")).thenReturn(false);
      await expect(networkModule.createNetworkNode(network, "2", "192.168.0.7")).rejects.toMatchError(
        new GolemNetworkError(
          `Network ID '2' has already been assigned in this network.`,
          NetworkErrorCode.AddressAlreadyAssigned,
        ),
      );
    });

    it("should not create a node with an existing IP", async () => {
      when(mockNetwork.isNodeIpUnique(anything())).thenReturn(false);
      const network = instance(mockNetwork);
      await expect(networkModule.createNetworkNode(network, "3", "192.168.0.3")).rejects.toMatchError(
        new GolemNetworkError(
          "IP '192.168.0.3' has already been assigned in this network.",
          NetworkErrorCode.AddressAlreadyAssigned,
        ),
      );
    });

    it("should not add a node with address outside the network range", async () => {
      const network = instance(mockNetwork);
      when(mockNetwork.isIpInNetwork(anything())).thenReturn(false);
      await expect(networkModule.createNetworkNode(network, "3", "192.168.2.2")).rejects.toMatchError(
        new GolemNetworkError(
          "The given IP ('192.168.2.2') address must belong to the network ('192.168.0.0').",
          NetworkErrorCode.AddressOutOfRange,
        ),
      );
    });

    it("should not add too many nodes", async () => {
      const network = instance(mockNetwork);
      const mockError = new GolemNetworkError(
        "No more addresses available in 192.168.0.0/30",
        NetworkErrorCode.NoAddressesAvailable,
      );
      when(mockNetwork.getFirstAvailableIpAddress()).thenThrow(mockError);
      await expect(networkModule.createNetworkNode(network, "next-id")).rejects.toMatchError(mockError);
    });

    it("should not remove node from the network if it does not belong to the network", async () => {
      const network = instance(mockNetwork);
      const mockNode = mock(NetworkNode);
      const node = instance(mockNode);
      when(mockNode.id).thenReturn("88");
      when(mockNetwork.hasNode(node)).thenReturn(false);
      await expect(networkModule.removeNetworkNode(network, node)).rejects.toMatchError(
        new GolemNetworkError(`The network node 88 does not belong to the network`, NetworkErrorCode.NodeRemovalFailed),
      );
    });

    it("should ignore the removal of the node if the network has been removed", async () => {
      const network = instance(mockNetwork);
      const mockNode = mock(NetworkNode);
      const node = instance(mockNode);
      when(mockNode.id).thenReturn("88");
      when(mockNetwork.hasNode(node)).thenReturn(true);
      when(mockNetwork.isRemoved()).thenReturn(true);
      await networkModule.removeNetworkNode(network, node);
      verify(mockNetworkApi.removeNetworkNode(anything(), anything())).never();
    });
  });

  describe("Removing", () => {
    it("should remove network", async () => {
      const network = instance(mockNetwork);
      await networkModule.removeNetwork(network);
      verify(mockNetworkApi.removeNetwork(network)).once();
    });

    it("should not remove network that doesn't exist", async () => {
      const network = instance(mockNetwork);
      const mockError = new Error("404");
      when(mockNetworkApi.removeNetwork(network)).thenReject(mockError);
      await expect(networkModule.removeNetwork(network)).rejects.toMatchError(mockError);
    });
  });
});
