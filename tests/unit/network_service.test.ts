import { LoggerMock, YagnaMock } from "../mock";
import { GolemNetworkError, NetworkService } from "../../src/network";
import { NetworkErrorCode } from "../../src/network/error";

const logger = new LoggerMock();
const yagnaApi = new YagnaMock().getApi();
describe("Network Service", () => {
  beforeEach(() => {
    logger.clear();
  });

  describe("Creating", () => {
    it("should start service and create network", async () => {
      const networkService = new NetworkService(yagnaApi, { logger });
      await networkService.run("test_owner_id");
      await logger.expectToInclude(
        "Network created",
        {
          id: expect.anything(),
          ip: "192.168.0.0",
          mask: "255.255.255.0",
        },
        10,
      );
      await logger.expectToInclude("Network Service has started");
      await networkService.end();
    });
  });

  describe("Nodes", () => {
    describe("adding", () => {
      it("should add node to network", async () => {
        const networkService = new NetworkService(yagnaApi, { logger });
        await networkService.run("test_owner_id");
        await networkService.addNode("provider_2");
        await logger.expectToInclude(
          "Node has added to the network.",
          {
            id: "provider_2",
            ip: "192.168.0.2",
          },
          10,
        );
        await networkService.end();
      });

      it("should not add node if the service is not started", async () => {
        const networkService = new NetworkService(yagnaApi, { logger });
        const result = networkService.addNode("provider_2");
        await expect(result).rejects.toMatchError(
          new GolemNetworkError(
            "The service is not started and the network does not exist",
            NetworkErrorCode.NetworkSetupMissing,
          ),
        );
      });
      describe("removing", () => {
        it("should remove node from the network", async () => {
          const networkService = new NetworkService(yagnaApi, { logger });
          await networkService.run("test_owner_id");
          await networkService.addNode("provider_2");
          const removeNetworkApiSpy = jest.spyOn(yagnaApi.net, "removeNode");
          await networkService.removeNode("provider_2");
          expect(removeNetworkApiSpy).toHaveBeenCalled();
          await networkService.end();
        });
        it("should not remove node from the network", async () => {
          const networkService = new NetworkService(yagnaApi, { logger });
          await networkService.run("test_owner_id");
          await networkService.addNode("provider_2");
          await expect(networkService.removeNode("provider_777")).rejects.toMatchError(
            new GolemNetworkError(
              "Unable to remove node provider_777. There is no such node in the network",
              NetworkErrorCode.NodeRemovalFailed,
              networkService["network"]?.getNetworkInfo(),
            ),
          );
          await networkService.end();
        });
      });
    });

    describe("Removing", () => {
      it("should end service and remove network", async () => {
        const networkService = new NetworkService(yagnaApi, { logger });
        await networkService.run("test_owner_id");
        await networkService.end();
        await logger.expectToInclude(
          "Network has removed:",
          {
            id: expect.anything(),
            ip: expect.anything(),
          },
          60,
        );
        await logger.expectToInclude("Network Service has been stopped");
        await networkService.end();
      });
    });
  });
});
