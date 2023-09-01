import { TEST_IDENTITY } from "../fixtures";
import { IdentityModel, RequestorApi } from "../../../src/utils/yagna/identity";
import { AxiosResponse } from "axios";

export class IdentityApiMock extends RequestorApi {
  async getIdentity(): Promise<AxiosResponse<IdentityModel>> {
    return new Promise((res) => res({ data: { identity: TEST_IDENTITY } } as AxiosResponse));
  }
}
