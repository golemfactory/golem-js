import { Job } from "./job";
import { Agreement, AgreementPoolService } from "../../agreement";
import { WorkContext } from "../../activity/work";
import { NetworkNode, NetworkService } from "../../network";
import { Activity } from "../../activity";
import { Package } from "../../market/package";
import { instance, mock, reset } from "@johanblumenberg/ts-mockito";
import { YagnaApi } from "../../shared/utils";

jest.mock("../../payment");
jest.mock("../../market");

const mockYagna = mock(YagnaApi);

describe("Job", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    reset(mockYagna);
  });

  const yagna = instance(mockYagna);

  describe("cancel()", () => {
    it("stops the activity and releases the agreement when canceled", async () => {
      jest.spyOn(AgreementPoolService.prototype, "run").mockResolvedValue();
      jest.spyOn(NetworkService.prototype, "run").mockResolvedValue();
      jest.spyOn(Package, "create").mockReturnValue({} as unknown as Package);
      jest.spyOn(WorkContext.prototype, "before").mockResolvedValue();
      jest.spyOn(AgreementPoolService.prototype, "releaseAgreement").mockResolvedValue();
      jest.spyOn(NetworkService.prototype, "addNode").mockResolvedValue({} as unknown as NetworkNode);

      const mockAgreement = {
        id: "test_agreement_id",
        getProviderInfo: () => ({
          id: "test_provider_id",
        }),
      } as Agreement;
      const mockActivity = {
        stop: jest.fn(),
        agreement: mockAgreement,
      } as unknown as Activity;

      jest.spyOn(AgreementPoolService.prototype, "getAgreement").mockResolvedValue(mockAgreement);
      jest.spyOn(Activity, "create").mockResolvedValue(mockActivity);

      const job = new Job("test_id", yagna, {
        package: {
          imageTag: "test_image",
        },
      });

      job.startWork(() => {
        return new Promise((resolve) => setTimeout(resolve, 10000));
      });
      await job.cancel();

      await expect(job.waitForResult()).rejects.toThrow("Canceled");

      expect(mockActivity.stop).toHaveBeenCalled();
      expect(AgreementPoolService.prototype.releaseAgreement).toHaveBeenCalledWith(mockAgreement.id, false);
    });
  });
});
