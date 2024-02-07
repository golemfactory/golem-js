import { RequestorStateApi } from "ya-ts-client/dist/ya-activity";
import { GolemPlatformError } from "../../error/golem-error";
import { Agreement } from "ya-ts-client/dist/ya-market";

export class RequestorApi extends RequestorStateApi {
  async getActivityAgreementId(activityId: string): Promise<Agreement["agreementId"]> {
    try {
      const res = await fetch(this.basePath + "/activity/" + activityId + "/agreement", {
        headers: { authorization: `Bearer ${this.configuration?.apiKey}` },
      });

      if (!res.ok) {
        throw new GolemPlatformError(`Failed to get activity agreement: ${res.statusText}`);
      }

      return await res.json();
    } catch (e) {
      throw new GolemPlatformError(`Failed to get activity agreement: ${e}`, e);
    }
  }
}
