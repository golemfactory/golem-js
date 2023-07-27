import { LoggerMock } from "../mock";
import { NetworkService } from "../../yajsapi/network";
const logger = new LoggerMock();

describe("Network Service", () => {
  beforeEach(() => {
    logger.clear();
  });

  describe("Creating", () => {
    it("should start service and create network", async () => {
      const networkService = new NetworkService({ logger });
      await networkService.run("test_owner_id");
      await logger.expectToMatch(/Network created: ID: .*, IP: 192.168.0.0, Mask: 255.255.255.0/, 10);
      await logger.expectToInclude("Network Service has started");
      await networkService.end();
    });
  });

  describe("Nodes", () => {
    it("should add node to network", async () => {
      const networkService = new NetworkService({ logger });
      await networkService.run("test_owner_id");
      await networkService.addNode("provider_2");
      await logger.expectToInclude("Node has added to the network. ID: provider_2, IP: 192.168.0.2", 10);
      await networkService.end();
    });

    it("should not add node if the service is not started", async () => {
      const networkService = new NetworkService({ logger });
      const result = networkService.addNode("provider_2");
      await expect(result).rejects.toThrow("The service is not started and the network does not exist");
    });
  });

  describe("Removing", () => {
    it("should end service and remove network", async () => {
      const networkService = new NetworkService({ logger });
      await networkService.run("test_owner_id");
      await networkService.end();
      await logger.expectToInclude("Network has removed: ID", 60);
      await logger.expectToInclude("Network Service has been stopped");
      await networkService.end();
    });
  });
});
