import { GolemConfigError } from "../../shared/error/golem-error";
import { GolemDeploymentBuilder } from "./builder";
import { GolemNetwork } from "../../golem-network";
import { imock, instance } from "@johanblumenberg/ts-mockito";
import { MarketModule } from "../../market";
import { ActivityModule } from "../../activity";

const mockGolemNetwork = imock<GolemNetwork>();
const mockMarketModule = imock<MarketModule>();
const mockActivityModule = imock<ActivityModule>();

describe("Deployment builder", () => {
  it("throws an error when creating an activity pool with the same name", () => {
    const builder = new GolemDeploymentBuilder(mockGolemNetwork);
    expect(() => {
      builder
        .createActivityPool("my-pool", {
          image: "image",
          marketModule: instance(mockMarketModule),
          activityModule: instance(mockActivityModule),
          demand: { paymentNetwork: "holesky" },
        })
        .createActivityPool("my-pool", {
          image: "image",
          marketModule: instance(mockMarketModule),
          activityModule: instance(mockActivityModule),
          demand: { paymentNetwork: "holesky" },
        });
    }).toThrow(new GolemConfigError(`Activity pool with name my-pool already exists`));
  });
  it("throws an error when creating a network with the same name", () => {
    const builder = new GolemDeploymentBuilder(mockGolemNetwork);
    expect(() => {
      builder
        .createNetwork("my-network", {
          networkOwnerId: "test",
        })
        .createNetwork("my-network", {
          networkOwnerId: "test",
        });
    }).toThrow(new GolemConfigError(`Network with name my-network already exists`));
  });
  it("throws an error when creating a deployment with an activity pool referencing a non-existing network", () => {
    const builder = new GolemDeploymentBuilder(mockGolemNetwork);
    expect(() => {
      builder
        .createNetwork("existing-network", {
          networkOwnerId: "test",
        })
        .createActivityPool("my-pool", {
          image: "image",
          network: "non-existing-network",
          marketModule: instance(mockMarketModule),
          activityModule: instance(mockActivityModule),
          demand: { paymentNetwork: "holesky" },
        })
        .getDeployment();
    }).toThrow(new GolemConfigError(`Activity pool my-pool references non-existing network non-existing-network`));
  });
});
