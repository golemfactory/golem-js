import { Agreement, IAgreementRepository } from "../../../market/agreement/agreement";
import { MarketApi } from "ya-ts-client";
import { GolemInternalError } from "../../error/golem-error";
import { IDemandRepository } from "../../../market/demand/demand";
import { getMessageFromApiError } from "../../utils/apiErrorMessage";
import { GolemMarketError, MarketErrorCode } from "../../../market";

export class AgreementRepository implements IAgreementRepository {
  constructor(
    private readonly api: MarketApi.RequestorService,
    private readonly demandRepo: IDemandRepository,
  ) {}

  async getById(id: string): Promise<Agreement> {
    let dto;
    try {
      dto = await this.api.getAgreement(id);
    } catch (error) {
      const message = getMessageFromApiError(error);
      throw new GolemMarketError(`Failed to get agreement: ${message}`, MarketErrorCode.CouldNotGetAgreement, error);
    }
    const { demandId } = dto.demand;
    const demand = this.demandRepo.getById(demandId);

    if (!demand) {
      throw new GolemInternalError(`Could not find information for demand ${demandId} of agreement ${id}`);
    }
    const agreement = new Agreement(id, dto, demand);
    return agreement;
  }
}
