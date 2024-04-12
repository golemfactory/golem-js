import { GolemConfigError } from "../../shared/error/golem-error";
import { GolemDeploymentBuilder } from "./builder";
import { GolemNetwork } from "../../golem-network";
import { imock } from "@johanblumenberg/ts-mockito";

const mockGolemNetwork = imock<GolemNetwork>();

describe("Deployment builder", () => {
  it("throws an error when creating an activity pool with the same name", () => {
    const builder = new GolemDeploymentBuilder(mockGolemNetwork);
    expect(() => {
      builder
        .createActivityPool("my-pool", {
          image: "image",
          market: {},
        })
        .createActivityPool("my-pool", {
          image: "image",
          market: {},
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
          market: {},
        })
        .getDeployment();
    }).toThrow(new GolemConfigError(`Activity pool my-pool references non-existing network non-existing-network`));
  });
});
