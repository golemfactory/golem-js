import { Job } from "./job";
import { Agreement, AgreementPoolService, IActivityApi } from "../../agreement";
import { WorkContext } from "../../activity/work";
import { NetworkNode, NetworkService } from "../../network";
import { Activity } from "../../activity";
import { Package } from "../../market/package";
import { anything, imock, instance, mock, reset, verify, when } from "@johanblumenberg/ts-mockito";
import { YagnaApi } from "../../shared/utils";
import { IAgreementApi } from "../../agreement/agreement";

jest.mock("../../payment");
jest.mock("../../market");

const mockYagna = mock(YagnaApi);

const mockActivity = mock(Activity);
const mockActivityApi = imock<IActivityApi>();
const mockAgreementApi = imock<IAgreementApi>();

// TODO: Unskip tests and fix them
describe.skip("Job", () => {
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

      jest.spyOn(AgreementPoolService.prototype, "getAgreement").mockResolvedValue(mockAgreement);

      const activity = instance(mockActivity);
      when(mockActivityApi.createActivity(anything(), anything())).thenResolve(activity);

      const job = new Job("test_id", yagna, instance(mockActivityApi), instance(mockAgreementApi), {
        package: {
          imageTag: "test_image",
        },
      });

      job.startWork(() => {
        return new Promise((resolve) => setTimeout(resolve, 10000));
      });

      await job.cancel();

      await expect(job.waitForResult()).rejects.toThrow("Canceled");

      verify(mockActivityApi.destroyActivity(activity)).once();
      expect(AgreementPoolService.prototype.releaseAgreement).toHaveBeenCalledWith(mockAgreement.id, false);
    });
  });
});
