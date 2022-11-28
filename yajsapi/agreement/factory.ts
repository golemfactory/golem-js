import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import { Agreement, AgreementOptions } from "./agreement";
import { Logger, dayjs } from "../utils";
import { Configuration } from "ya-ts-client/dist/ya-market";
import { YagnaOptions } from "../executor";

const DEFAULT_OPTIONS = {
  REQUEST_TIMEOUT: 30000,
  EXECUTE_TIMEOUT: 30000,
  EVENT_POOLING_INT: 5,
  EVENT_POOLING_MAX_EVENTS: 100,
  SUBNET_TAG: "devnet-beta",
};

export class AgreementFactory {
  private logger?: Logger;
  private yagnaOptions?: YagnaOptions;
  private subnetTag?: string;
  private requestTimeout?: number;
  private executeTimeout?: number;
  private eventPoolingInterval?: number;
  private eventPoolingMaxEventsPerRequest?: number;

  constructor({ subnetTag, requestTimeout, executeTimeout, eventPoolingInterval, eventPoolingMaxEventsPerRequest, yagnaOptions, logger }: AgreementOptions) {
    this.requestTimeout = requestTimeout || DEFAULT_OPTIONS.REQUEST_TIMEOUT;
    this.executeTimeout = executeTimeout || DEFAULT_OPTIONS.EXECUTE_TIMEOUT;
    this.eventPoolingInterval = eventPoolingInterval || DEFAULT_OPTIONS.EVENT_POOLING_INT;
    this.eventPoolingMaxEventsPerRequest = eventPoolingMaxEventsPerRequest || DEFAULT_OPTIONS.EVENT_POOLING_MAX_EVENTS;
    this.subnetTag = subnetTag || DEFAULT_OPTIONS.SUBNET_TAG;
    this.yagnaOptions = yagnaOptions;
    this.logger = logger;
  }

  async create(proposalId: string): Promise<Agreement> {
    const api = new RequestorApi(
        new Configuration({
          apiKey: this.yagnaOptions?.apiKey || process.env.YAGNA_APPKEY,
          basePath: (this.yagnaOptions?.basePath || process.env.YAGNA_URL) + "/market-api/v1",
          accessToken: this.yagnaOptions?.apiKey || process.env.YAGNA_APPKEY,
        })
    );
    try {
      const agreementProposalRequest = {
        proposalId,
        validTo: dayjs().add(3600, "second").toISOString(),
      };
      const { data: agreementId } = await api.createAgreement(agreementProposalRequest, {
        timeout: 3000,
      });
      const { data } = await api.getAgreement(agreementId, { timeout: 3000 });
      const providerName = data?.offer.properties["golem.node.id.name"] ?? null;
      const providerId = data?.offer.providerId ?? null;

      return new Agreement(agreementId, { id: providerId, name: providerName }, api);
    } catch (error) {
      throw error?.response?.data?.message || error;
    }
  }
}
