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
        .createResourceRentalPool("my-pool", {
          demand: {
            workload: {
              imageTag: "image",
              minCpuCores: 1,
              minMemGib: 1,
              minStorageGib: 1,
            },
          },
          market: {
            rentHours: 1,
            pricing: {
              model: "linear",
              maxStartPrice: 1,
              maxEnvPerHourPrice: 1,
              maxCpuPerHourPrice: 1,
            },
          },
          deployment: {
            replicas: 1,
          },
        })
        .createResourceRentalPool("my-pool", {
          demand: {
            workload: {
              imageTag: "image",
              minCpuCores: 1,
              minMemGib: 1,
              minStorageGib: 1,
            },
          },
          market: {
            rentHours: 1,
            pricing: {
              model: "linear",
              maxStartPrice: 1,
              maxEnvPerHourPrice: 1,
              maxCpuPerHourPrice: 1,
            },
          },
          deployment: {
            replicas: 1,
          },
        });
    }).toThrow(new GolemConfigError(`Resource Rental Pool with name my-pool already exists`));
  });
  it("throws an error when creating a network with the same name", () => {
    const builder = new GolemDeploymentBuilder(mockGolemNetwork);
    expect(() => {
      builder.createNetwork("my-network").createNetwork("my-network");
    }).toThrow(new GolemConfigError(`Network with name my-network already exists`));
  });
  it("throws an error when creating a deployment with an activity pool referencing a non-existing network", () => {
    const builder = new GolemDeploymentBuilder(mockGolemNetwork);
    expect(() => {
      builder
        .createNetwork("existing-network")
        .createResourceRentalPool("my-pool", {
          demand: {
            workload: { imageTag: "image", minCpuCores: 1, minMemGib: 1, minStorageGib: 1 },
          },
          market: {
            rentHours: 1,
            pricing: {
              model: "linear",
              maxStartPrice: 1,
              maxEnvPerHourPrice: 1,
              maxCpuPerHourPrice: 1,
            },
          },
          deployment: {
            network: "non-existing-network",
            replicas: 1,
          },
        })
        .getDeployment();
    }).toThrow(new GolemConfigError(`Activity pool my-pool references non-existing network non-existing-network`));
  });
});
