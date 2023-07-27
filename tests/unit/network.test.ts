import { expect } from "chai";
import { Network } from "../../yajsapi/network";

describe("Network", () => {
  describe("Creating", () => {
    it("should create network", async () => {
      const network = await Network.create({ networkOwnerId: "test_owner_id" });
      const { ip, mask, nodes } = network.getNetworkInfo();
      expect(nodes["192.168.0.1"]).to.equal("test_owner_id");
      expect(Object.keys(nodes).length).to.equal(1);
      expect(ip).to.equal("192.168.0.0");
      expect(mask).to.equal("255.255.255.0");
    });

    it("should create network with 16 bit mask", async () => {
      const network = await Network.create({ networkOwnerId: "1", networkIp: "192.168.7.0/16" });
      const { ip, mask } = network.getNetworkInfo();
      expect({ ip, mask }).to.deep.equal({ ip: "192.168.0.0", mask: "255.255.0.0" });
    });

    it("should create network with 24 bit mask", async () => {
      const network = await Network.create({ networkOwnerId: "1", networkIp: "192.168.7.0/24" });
      const { ip, mask } = network.getNetworkInfo();
      expect({ ip, mask }).to.deep.equal({ ip: "192.168.7.0", mask: "255.255.255.0" });
    });

    it("should create network with 8 bit mask", async () => {
      const network = await Network.create({ networkOwnerId: "1", networkIp: "192.168.7.0/8" });
      const { ip, mask } = network.getNetworkInfo();
      expect({ ip, mask }).to.deep.equal({ ip: "192.0.0.0", mask: "255.0.0.0" });
    });

    it("should not create network with invalid ip", async () => {
      const shouldFail = Network.create({ networkOwnerId: "1", networkIp: "123.1.2" });
      await expect(shouldFail).to.be.rejectedWith(Error, "Cidr notation should be in the form [ip number]/[range]");
    });

    it("should not create network without mask", async () => {
      const shouldFail = Network.create({ networkOwnerId: "1", networkIp: "1.1.1.1" });
      await expect(shouldFail).to.be.rejectedWith(Error, "Cidr notation should be in the form [ip number]/[range]");
    });

    it("should create network with custom options", async () => {
      const network = await Network.create({
        networkIp: "192.168.0.1",
        networkOwnerId: "owner_1",
        networkOwnerIp: "192.168.0.7",
        networkMask: "27",
        networkGateway: "192.168.0.2",
      });
      const { ip, mask, nodes } = network.getNetworkInfo();
      expect({ ip, mask }).to.deep.equal({ ip: "192.168.0.0", mask: "255.255.255.224" });
      expect(nodes["192.168.0.7"]).to.equal("owner_1");
    });
  });

  describe("Nodes", () => {
    it("should add node", async () => {
      const network = await Network.create({ networkOwnerId: "1", networkIp: "192.168.0.0/24" });
      const { id, ip } = await network.addNode("7", "192.168.0.7");
      expect({ id, ip: ip.toString() }).to.deep.equal({ id: "7", ip: "192.168.0.7" });
    });

    it("should add a few nodes", async () => {
      const network = await Network.create({ networkOwnerId: "1", networkIp: "192.168.0.0/24" });
      const node2 = await network.addNode("2", "192.168.0.3");
      const node3 = await network.addNode("3");
      const node4 = await network.addNode("4");
      expect({ id: node2.id, ip: node2.ip.toString() }).to.deep.equal({ id: "2", ip: "192.168.0.3" });
      expect({ id: node3.id, ip: node3.ip.toString() }).to.deep.equal({ id: "3", ip: "192.168.0.2" });
      expect({ id: node4.id, ip: node4.ip.toString() }).to.deep.equal({ id: "4", ip: "192.168.0.4" });
    });

    it("should not add node with an existing ID", async () => {
      const network = await Network.create({ networkOwnerId: "1", networkIp: "192.168.0.0/24" });
      await expect(network.addNode("1")).to.be.rejectedWith("ID '1' has already been assigned in this network");
    });

    it("should not add node with an existing IP", async () => {
      const network = await Network.create({ networkOwnerId: "1", networkIp: "192.168.0.0/24" });
      await network.addNode("2", "192.168.0.3");
      await expect(network.addNode("3", "192.168.0.3")).to.be.rejectedWith(
        "IP '192.168.0.3' has already been assigned in this network"
      );
    });

    it("should not add node with address outside the network range", async () => {
      const network = await Network.create({ networkOwnerId: "1", networkIp: "192.168.0.0/24" });
      await expect(network.addNode("2", "192.168.2.2")).to.be.rejectedWith(
        "The given IP ('192.168.2.2') address must belong to the network ('192.168.0.0/24')"
      );
    });

    it("should not add too many nodes", async () => {
      const network = await Network.create({ networkOwnerId: "1", networkIp: "192.168.0.0/30" });
      await network.addNode("2");
      await network.addNode("3");
      await expect(network.addNode("4")).to.be.rejectedWith("No more addresses available in 192.168.0.0/30");
    });

    it("should get node network config", async () => {
      const network = await Network.create({ networkOwnerId: "1", networkIp: "192.168.0.0/24" });
      const node = await network.addNode("2");
      expect(node.getNetworkConfig()).to.deep.equal({
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
      const network = await Network.create({ networkOwnerId: "1", networkIp: "192.168.0.0/24" });
      const node = await network.addNode("2");
      expect(node.getWebsocketUri(22)).to.deep.equal(
        `ws://${process.env?.YAGNA_API_URL?.substring(7) || "127.0.0.1:7465"}/net-api/v1/net/${
          network.id
        }/tcp/192.168.0.2/22`
      );
    });
  });

  describe("Removing", () => {
    it("should remove network", async () => {
      const network = await Network.create({ networkOwnerId: "1", networkIp: "192.168.0.0/24" });
      expect(await network.remove()).to.be.true;
    });

    it("should not remove network that doesn't exist", async () => {
      const network = await Network.create({ networkOwnerId: "1", networkIp: "192.168.0.0/24" });
      network["config"]["api"]["setExpectedError"]({ status: 404 });
      expect(await network.remove()).to.be.false;
    });
  });
});
