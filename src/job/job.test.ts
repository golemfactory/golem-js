import { Job } from "./job";
import { YagnaMock } from "../../tests/mock/";
import { Agreement, AgreementPoolService } from "../agreement";
import { TaskService, WorkContext } from "../task";
import { NetworkNode, NetworkService } from "../network";
import { Activity } from "../activity";
import { Package } from "../package";

jest.mock("../payment");
jest.mock("../market");

afterEach(() => {
  jest.clearAllMocks();
});

describe("Job", () => {
  describe("cancel()", () => {
    it("stops the activity and releases the agreement when canceled", async () => {
      jest.spyOn(AgreementPoolService.prototype, "run").mockResolvedValue();
      jest.spyOn(TaskService.prototype, "run").mockResolvedValue();
      jest.spyOn(NetworkService.prototype, "run").mockResolvedValue();
      jest.spyOn(Package, "create").mockReturnValue({} as unknown as Package);
      jest.spyOn(WorkContext.prototype, "before").mockResolvedValue();
      jest.spyOn(AgreementPoolService.prototype, "releaseAgreement").mockResolvedValue();
      jest.spyOn(NetworkService.prototype, "addNode").mockResolvedValue({} as unknown as NetworkNode);

      const mockAgreement = {
        id: "test_agreement_id",
        provider: {
          id: "test_provider_id",
        },
      } as Agreement;
      const mockActivity = {
        stop: jest.fn(),
      } as unknown as Activity;

      jest.spyOn(AgreementPoolService.prototype, "getAgreement").mockResolvedValue(mockAgreement);
      jest.spyOn(Activity, "create").mockResolvedValue(mockActivity);

      const yagna = new YagnaMock().getApi();
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
