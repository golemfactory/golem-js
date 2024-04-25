import { Agreement, IAgreementRepository } from "../../../agreement/agreement";
import { MarketApi } from "ya-ts-client";
import { GolemInternalError } from "../../error/golem-error";
import { IDemandRepository } from "../../../market/demand";

export class AgreementRepository implements IAgreementRepository {
  constructor(
    private readonly api: MarketApi.RequestorService,
    private readonly demandRepo: IDemandRepository,
  ) {}

  async getById(id: string): Promise<Agreement> {
    const agreement = await this.api.getAgreement(id);

    const { demandId } = agreement.demand;
    const demand = this.demandRepo.getById(demandId);

    if (!demand) {
      throw new GolemInternalError(`Could not find information for demand ${demandId} of agreement ${id}`);
    }

    return new Agreement(id, agreement, demand.paymentPlatform);
  }
}
