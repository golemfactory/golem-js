import { TEST_IDENTITY } from "../fixtures";
import { IdentityModel, RequestorApi } from "../../../src/utils/yagna/identity";

export class IdentityApiMock extends RequestorApi {
  async getIdentity(): Promise<IdentityModel> {
    return new Promise((res) => res({ identity: TEST_IDENTITY } as IdentityModel));
  }
}
