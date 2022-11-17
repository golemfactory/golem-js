import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import { Agreement } from "./agreement";
import { ProposalForAgreementInterface } from "./interfaces";
import { AgreementConfigContainer } from "./agreement_config_container";
import { Logger } from "../utils";

export class AgreementFactory {
    private readonly api: RequestorApi;
    private logger?: Logger;

    constructor(private readonly configContainer: AgreementConfigContainer) {
        this.logger = configContainer.logger;
        this.api = configContainer.api;
    }

    public async create(proposal: ProposalForAgreementInterface): Promise<Agreement> {
        try {
            const createAgreementFromProposalApiRequest = {
                proposalId: proposal.getId(),
                validTo: proposal.getValidTo()
            }
            const { data: agreementId } = await this.api.createAgreement(createAgreementFromProposalApiRequest, { timeout: 3000 });
            const agreement = new Agreement(agreementId, this.configContainer);
            await agreement.refreshDetails();
            return agreement;
        } catch (error) {
            throw error?.response?.data?.message || error;
        }
    }
}
