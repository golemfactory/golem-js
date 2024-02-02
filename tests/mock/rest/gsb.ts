import { GftpFileInfo, RequestorApi, ServiceModel } from "../../../src/utils/yagna/gsb";

export class GsbApiMock extends RequestorApi {
  async createService(fileInfo: GftpFileInfo, components: string[]): Promise<ServiceModel> {
    return new Promise((res) => res({ servicesId: "test_id" }));
  }

  async deleteService(id: string): Promise<void> {
    return new Promise((res) => res());
  }
}
