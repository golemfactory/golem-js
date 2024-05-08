import { Observable } from "rxjs";
import { Demand, DemandDetails, MarketApi, ProposalEvent, ProposalNew } from "../../../market";
import { YagnaApi } from "../yagnaApi";
import YaTsClient from "ya-ts-client";
import { GolemInternalError } from "../../error/golem-error";
import { Logger } from "../../utils";

export class MarketApiAdapter implements MarketApi {
  constructor(
    private readonly yagnaApi: YagnaApi,
    private readonly logger: Logger,
  ) {}

  async publishDemandSpecification(demand: DemandDetails): Promise<Demand> {
    const idOrError = await this.yagnaApi.market.subscribeDemand(demand.body);
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
        longPoll();
      };
      longPoll();
      return () => {
        isCancelled = true;
        proposalPromise.cancel();
      };
    });
  }

  async counterProposal(receivedProposal: ProposalNew, demand: DemandDetails): Promise<ProposalNew> {
    const bodyClone = structuredClone(demand.body);
    bodyClone.properties["golem.com.payment.chosen-platform"] = demand.paymentPlatform;
    const maybeNewId = await this.yagnaApi.market.counterProposalDemand(
      receivedProposal.demand.id,
      receivedProposal.id,
      bodyClone,
    );
    if (typeof maybeNewId !== "string") {
      throw new GolemInternalError(`Counter proposal failed ${maybeNewId.message}`);
    }
    const counterProposalDto = await this.yagnaApi.market.getProposalOffer(receivedProposal.demand.id, maybeNewId);
    return new ProposalNew(counterProposalDto, receivedProposal.demand);
  }
}
