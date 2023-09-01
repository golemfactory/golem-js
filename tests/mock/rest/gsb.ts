import { GftpFileInfo, RequestorApi, ServiceModel } from "../../../src/utils/yagna/gsb";
import { AxiosResponse } from "axios";

export class GsbApiMock extends RequestorApi {
  async createService(fileInfo: GftpFileInfo, components: string[]): Promise<AxiosResponse<ServiceModel>> {
    return new Promise((res) => res({ data: { serviceId: "test_id" } } as AxiosResponse));
  }

  async deleteService(id: string): Promise<AxiosResponse<void>> {
    return new Promise((res) => res({ data: true } as AxiosResponse));
  }
}
