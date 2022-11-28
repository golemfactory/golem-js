// import chai from "chai";
// import chaiAsPromised from "chai-as-promised";
// chai.use(chaiAsPromised);
//
// const expect = chai.expect;
//
// import { Network } from "../../yajsapi/network";
// import { NetMock } from "../mock/rest";
// const netApiMock = new NetMock();
//
// describe("#Network()", () => {
//   it("create network", async () => {
//     netApiMock.setExpected("create_network", "1234");
//     const network = await Network.create(netApiMock, "192.168.0.0/24", "owner");
//     const { id, ip, mask, nodes } = network.get_network_info();
//     expect({ id, ip, mask }).to.deep.equal({ id: "1234", ip: "192.168.0.0", mask: "255.255.255.0" });
//     expect(nodes["192.168.0.1"]).to.equal("owner");
//     expect(Object.keys(nodes).length).to.equal(1);
//     expect(network.toString()).to.equal("{ id: 1234, ip: 192.168.0.0, mask: 255.255.255.0 }");
//   });
//
//   it("create network with 16 bit mask", async () => {
//     const network = await Network.create(netApiMock, "192.168.7.0/16", "1");
//     const { id, ip, mask } = network.get_network_info();
//     expect({ id, ip, mask }).to.deep.equal({ id: "mock-network-id", ip: "192.168.0.0", mask: "255.255.0.0" });
//   });
//
//   it("create network with 24 bit mask", async () => {
//     const network = await Network.create(netApiMock, "192.168.7.0/24", "1");
//     const { id, ip, mask } = network.get_network_info();
//     expect({ id, ip, mask }).to.deep.equal({ id: "mock-network-id", ip: "192.168.7.0", mask: "255.255.255.0" });
//   });
//
//   it("create network with 8 bit mask", async () => {
//     netApiMock.setExpected("create_network", "777");
//     const network = await Network.create(netApiMock, "10.11.12.13/8", "1");
//     const { id, ip, mask } = network.get_network_info();
//     expect({ id, ip, mask }).to.deep.equal({ id: "777", ip: "10.0.0.0", mask: "255.0.0.0" });
//   });
//
//   it("create network with invalid ip", async () => {
//     const shouldFail = Network.create(netApiMock, "123.1.2", "1");
//     await expect(shouldFail).to.be.rejectedWith(Error, "Cidr notation should be in the form [ip number]/[range]");
//   });
//
//   it("create network without mask", async () => {
//     const shouldFail = Network.create(netApiMock, "1.1.1.1", "1");
//     await expect(shouldFail).to.be.rejectedWith(Error, "Cidr notation should be in the form [ip number]/[range]");
//   });
//
//   it("create network with custom parameters", async () => {
//     netApiMock.setExpected("create_network", "77");
//     const network = await Network.create(
//       netApiMock,
//       "192.168.0.1",
//       "owner_1",
//       undefined,
//       "192.168.0.7",
//       "27",
//       "192.168.0.2"
//     );
//     const { id, ip, mask, nodes } = network.get_network_info();
//     expect({ id, ip, mask }).to.deep.equal({ id: "77", ip: "192.168.0.0", mask: "255.255.255.224" });
//     expect(nodes["192.168.0.7"]).to.equal("owner_1");
//   });
//
//   it("add node", async () => {
//     const network = await Network.create(netApiMock, "192.168.0.0/24", "1");
//     const { node_id, ip } = await network.add_node("7", "192.168.0.7");
//     expect({ node_id, ip: ip.toString() }).to.deep.equal({ node_id: "7", ip: "192.168.0.7" });
//   });
//
//   it("add a few nodes", async () => {
//     const network = await Network.create(netApiMock, "192.168.0.0/24", "1");
//     const node2 = await network.add_node("2", "192.168.0.3");
//     const node3 = await network.add_node("3");
//     const node4 = await network.add_node("4");
//     expect({ node_id: node2.node_id, ip: node2.ip.toString() }).to.deep.equal({ node_id: "2", ip: "192.168.0.3" });
//     expect({ node_id: node3.node_id, ip: node3.ip.toString() }).to.deep.equal({ node_id: "3", ip: "192.168.0.2" });
//     expect({ node_id: node4.node_id, ip: node4.ip.toString() }).to.deep.equal({ node_id: "4", ip: "192.168.0.4" });
//   });
//
//   it("add node with an existing ID", async () => {
//     const network = await Network.create(netApiMock, "192.168.0.0/24", "1");
//     await expect(network.add_node("1"))
//         .to.be.rejectedWith(Error, "ID '1' has already been assigned in this network.");
//   });
//
//   it("add node with an existing IP", async () => {
//     const network = await Network.create(netApiMock, "192.168.0.0/24", "1");
//     await network.add_node("2", "192.168.0.3");
//     await expect(network.add_node("3", "192.168.0.3"))
//         .to.be.rejectedWith(Error, "IP '192.168.0.3' has already been assigned in this network.");
//   });
//
//   it("add node with address outside the network range", async () => {
//     const network = await Network.create(netApiMock, "192.168.0.0/24", "1");
//     await expect(network.add_node("2", "192.168.2.2"))
//         .to.be.rejectedWith(Error, "The given IP ('192.168.2.2') address must belong to the network ('192.168.0.0/24').");
//   });
//
//   it("add too many nodes", async () => {
//     const network = await Network.create(netApiMock, "192.168.0.0/30", "1");
//     await network.add_node("2");
//     await network.add_node("3");
//     await expect(network.add_node("4"))
//         .to.be.rejectedWith("No more addresses available in 192.168.0.0/30");
//   });
//
//   it("remove network", async () => {
//     const network = await Network.create(netApiMock, "192.168.0.0/24", "owner");
//     expect(await network.remove()).to.be.true;
//   });
//
//   it("remove network that doesn't exist", async () => {
//     const network = await Network.create(netApiMock, "192.168.0.0/24", "owner");
//     netApiMock.setExpected("remove_network", null, { status: 404 });
//     expect(await network.remove()).to.be.false;
//   });
//
//   it("get node deploy args", async () => {
//     const network = await Network.create(netApiMock, "192.168.0.0/24", "1");
//     const node = await network.add_node("2");
//     expect(node.get_deploy_args()).to.deep.equal({
//       net: [
//         {
//           id: "mock-network-id",
//           ip: "192.168.0.0",
//           mask: "255.255.255.0",
//           nodeIp: "192.168.0.2",
//           nodes: {
//             "192.168.0.1": "1",
//             "192.168.0.2": "2",
//           },
//         },
//       ],
//     });
//   });
//
//   it("get node websocket uri", async () => {
//     netApiMock.setExpected("create_network", "network_test_id");
//     const network = await Network.create(netApiMock, "192.168.0.0/24", "1");
//     const node = await network.add_node("2");
//     expect(node.get_websocket_uri(22)).to.deep.equal("ws://127.0.0.1/test_url_api/net/network_test_id/tcp/192.168.0.2/22");
//   });
// })
