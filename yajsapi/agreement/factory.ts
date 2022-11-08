import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import { yaMarket } from "ya-ts-client";
import { Agreement, AgreementOptions } from "./agreement";
import { ProposalForAgreementInterface } from "./interfaces";

export class AgreementFactory {
    private readonly api: RequestorApi;
    private readonly apiKey?: string;
    private readonly basePath?: string;

    /**
     * Creating ActivityFactory
     * @param apiKey - Yagna Api Key
     * @param basePath - Yagna base path to Activity REST Api
     */
    constructor(apiKey?: string, basePath?: string) {
        this.apiKey = apiKey || process.env.YAGNA_APPKEY;
        this.basePath = basePath || process.env.YAGNA_API_BASEPATH || "http://127.0.0.1:7465/market-api/v1";
        this.api = new RequestorApi(
            new yaMarket.Configuration({
                apiKey: this.apiKey,
                basePath: this.basePath,
                accessToken: this.apiKey,
            })
        );
    }

    /**
     * Create Agreement for given proposal
     * @param proposal: ProposalForAgreementInterface
     * @param options - AgreementOptions
     * @param options.credentials.apiKey - Yagna Api Key
     * @param options.credentials.basePath - Yagna base path to Activity REST Api
     * @param options.requestTimeout - timeout for sending and creating batch
     * @param options.executeTimeout - timeout for executing batch
     * @param options.exeBatchResultsFetchInterval - interval for fetching batch results while polling
     * @param options.logger - logger module
     */
    public async create(proposal: ProposalForAgreementInterface, options?: AgreementOptions): Promise<Agreement> {
        try {
            const createAgreementFromProposalApiRequest = {
                proposalId: proposal.getId(),
                validTo: proposal.getValidTo()
            }
            const { data: agreementId } = await this.api.createAgreement(createAgreementFromProposalApiRequest, { timeout: 3000 });
            const agreement = new Agreement(
                agreementId, {
                credentials: {
                    apiKey: this.apiKey,
                    basePath: this.basePath,
                },
                ...options,
            });
            await agreement.refreshDetails();
            return agreement;
        } catch (error) {
            throw error?.response?.data?.message || error;
        }
    }
}
