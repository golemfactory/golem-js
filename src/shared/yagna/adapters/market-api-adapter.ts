import { Observable } from "rxjs";
import {
  Demand,
  DemandSpecification,
  MarketApi,
  ProposalEvent,
  OfferProposal,
  GolemMarketError,
  MarketErrorCode,
} from "../../../market";
import { YagnaApi } from "../yagnaApi";
import YaTsClient from "ya-ts-client";
import { GolemInternalError } from "../../error/golem-error";
import { Logger } from "../../utils";
import { DemandBodyPrototype, DemandPropertyValue } from "../../../market/demand/demand-body-builder";
import { getMessageFromApiError } from "../../utils/apiErrorMessage";

/**
 * A bit more user-friendly type definition of DemandOfferBaseDTO from ya-ts-client
 *
 * That's probably one of the most confusing elements around Golem Protocol and the API specificiation:
 *
 * - Providers create Offers
 * - Requestors create Demands
 * - Demands are used to create a subscription for Proposals - Initial ones reflect the Offer that was matched with the Demand used to subscribe
 * - Once the proposal is countered, it's countered with a "counter proposal" which is no longer Offer + Demand,
 *   but rather a sketch of the agreement - here both parties try to agree on the values of certain properties that
 *   are interesting from their perspective. These "negotiated proposals (of) ...." are buit using DemandOffeBaseDTO
 *
 * #FIXME yagna - feedback in the note above
 */
export type DemandRequestBody = {
  properties: Record<string, string | number | boolean | string[] | number[]>;
  constraints: string;
};

export class MarketApiAdapter implements MarketApi {
  constructor(
    private readonly yagnaApi: YagnaApi,
    private readonly logger: Logger,
  ) {}

  async publishDemandSpecification(demand: DemandSpecification): Promise<Demand> {
    const idOrError = await this.yagnaApi.market.subscribeDemand(this.buildDemandRequestBody(demand.prototype));

    if (typeof idOrError !== "string") {
      throw new Error(`Failed to subscribe to demand: ${idOrError.message}`);
    }

    return new Demand(idOrError, demand);
  }

  async unpublishDemand(demand: Demand): Promise<void> {
    const result = await this.yagnaApi.market.unsubscribeDemand(demand.id);

    if (result?.message) {
      throw new Error(`Failed to unsubscribe from demand: ${result.message}`);
    }

    this.logger.info("Demand unsubscribed", { demand: demand.id });
  }

  observeProposalEvents(demand: Demand): Observable<ProposalEvent> {
    return new Observable<ProposalEvent>((subscriber) => {
      let proposalPromise: YaTsClient.MarketApi.CancelablePromise<ProposalEvent[]>;
      let isCancelled = false;
      const longPoll = async () => {
        if (isCancelled) {
          return;
        }
        try {
          proposalPromise = this.yagnaApi.market.collectOffers(demand.id) as YaTsClient.MarketApi.CancelablePromise<
            ProposalEvent[]
          >;
          const proposals = await proposalPromise;
          for (const proposal of proposals) {
            subscriber.next(proposal);
          }
        } catch (error) {
          if (error instanceof YaTsClient.MarketApi.CancelError) {
            return;
          }
          // when the demand is unsubscribed the long poll will reject with a 404
          if ("status" in error && error.status === 404) {
            return;
          }
          subscriber.error(error);
        }

        longPoll().catch((err) => subscriber.error(err));
      };

      longPoll().catch((err) => subscriber.error(err));

      return () => {
        isCancelled = true;
        proposalPromise.cancel();
      };
    });
  }

  async counterProposal(receivedProposal: OfferProposal, demand: DemandSpecification): Promise<void> {
    const bodyClone = structuredClone(this.buildDemandRequestBody(demand.prototype));

    bodyClone.properties["golem.com.payment.chosen-platform"] = demand.paymentPlatform;

    const maybeNewId = await this.yagnaApi.market.counterProposalDemand(
      receivedProposal.demand.id,
      receivedProposal.id,
      bodyClone,
    );
    this.logger.debug("Proposal counter result from yagna", { result: maybeNewId });

    if (typeof maybeNewId !== "string") {
      throw new GolemInternalError(`Counter proposal failed ${maybeNewId.message}`);
    }
  }

  async rejectProposal(receivedProposal: OfferProposal, reason: string): Promise<void> {
    try {
      const result = await this.yagnaApi.market.rejectProposalOffer(receivedProposal.demand.id, receivedProposal.id, {
        message: reason,
      });

      this.logger.debug("Proposal rejection result from yagna", { response: result });
    } catch (error) {
      const message = getMessageFromApiError(error);
      throw new GolemMarketError(
        `Failed to reject proposal. ${message}`,
        MarketErrorCode.ProposalRejectionFailed,
        error,
      );
    }
  }

  private buildDemandRequestBody(decorations: DemandBodyPrototype): DemandRequestBody {
    let constraints: string;

    if (!decorations.constraints.length) constraints = "(&)";
    else if (decorations.constraints.length == 1) constraints = decorations.constraints[0];
    else constraints = `(&${decorations.constraints.join("\n\t")})`;

    const properties: Record<string, DemandPropertyValue> = {};
    decorations.properties.forEach((prop) => (properties[prop.key] = prop.value));

    return { constraints, properties };
  }

  public async getPaymentRelatedDemandDecorations(allocationId: string): Promise<DemandBodyPrototype> {
    return this.yagnaApi.payment.getDemandDecorations([allocationId]);
  }
}
