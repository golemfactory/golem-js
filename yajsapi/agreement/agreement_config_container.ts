import { AgreementOptions } from "./agreement";
import { EventBus } from "../events/event_bus";
import { Logger } from "../utils";
import { yaMarket } from "ya-ts-client";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api";

export class AgreementConfigContainer {
    readonly api: RequestorApi;

    constructor(
        readonly options: AgreementOptions,
        readonly eventBus: EventBus,
        readonly logger?: Logger
    ) {
        const apiKey = this.options?.credentials?.apiKey || process.env.YAGNA_APPKEY;
        const basePath = this.options?.credentials?.basePath || process.env.YAGNA_API_BASEPATH;
        if (!apiKey) throw new Error("Api key not defined");
        if (!basePath) throw new Error("Api base path not defined");
        const apiConfig = new yaMarket.Configuration({ apiKey, basePath, accessToken: apiKey });
        this.api = new RequestorApi(apiConfig);
    }
}