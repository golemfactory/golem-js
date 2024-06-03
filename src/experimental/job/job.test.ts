import { Job } from "./job";
import { WorkContext } from "../../activity/work";
import { anything, imock, instance, mock, reset, verify, when } from "@johanblumenberg/ts-mockito";
import { Logger } from "../../shared/utils";
import { GolemNetwork } from "../../golem-network";
import { LeaseProcess } from "../../lease-process";

const mockGlm = mock(GolemNetwork);
const mockLease = mock(LeaseProcess);
const mockWorkContext = mock(WorkContext);
describe("Job", () => {
  beforeEach(() => {
    reset(mockGlm);
    reset(mockLease);
    reset(mockWorkContext);
  });

  describe("cancel()", () => {
    it("stops the activity and releases the agreement when canceled", async () => {
      when(mockLease.getExeUnit()).thenResolve(instance(mockWorkContext));
      when(mockGlm.oneOf(anything())).thenResolve(instance(mockLease));
      const job = new Job(
        "test_id",
        instance(mockGlm),
        {
          demand: {
            workload: {
              imageTag: "test_image",
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
        },
        instance(imock<Logger>()),
      );

      job.startWork(() => {
        return new Promise((resolve) => setTimeout(resolve, 10000));
      });

      await job.cancel();

      await expect(job.waitForResult()).rejects.toThrow("Canceled");

      verify(mockLease.finalize()).once();
    });
  });
});
