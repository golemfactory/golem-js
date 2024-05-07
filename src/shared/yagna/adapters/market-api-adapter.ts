import { Observable } from "rxjs";
import { DemandNew, DemandSpecification, MarketApi, ProposalEvent, ProposalNew } from "../../../market";
import { YagnaApi } from "../yagnaApi";
import YaTsClient from "ya-ts-client";
import { GolemInternalError } from "../../error/golem-error";
import { Logger } from "../../utils";

export class MarketApiAdapter implements MarketApi {
  constructor(
    private readonly yagnaApi: YagnaApi,
    private readonly logger: Logger,
  ) {}

  async publishDemandSpecification(specification: DemandSpecification): Promise<DemandNew> {
    const idOrError = await this.yagnaApi.market.subscribeDemand(specification.decoration);
    if (typeof idOrError !== "string") {
      throw new Error(`Failed to subscribe to demand: ${idOrError.message}`);
    }
    return new DemandNew(idOrError, specification);
  }

  async unpublishDemand(demand: DemandNew): Promise<void> {
    const result = await this.yagnaApi.market.unsubscribeDemand(demand.id);
    if (result?.message) {
      throw new Error(`Failed to unsubscribe from demand: ${result.message}`);
    }
    this.logger.info("Demand unsubscribed", { demand: demand.id });
  }

  observeProposalEvents(demand: DemandNew): Observable<ProposalEvent> {
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
            this.logger.debug("Received proposal event from Yagna", { event: proposal });
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

  async counterProposal(receivedProposal: ProposalNew, specification: DemandSpecification): Promise<ProposalNew> {
    const decorationClone = structuredClone(specification.decoration);
    decorationClone.properties["golem.com.payment.chosen-platform"] = specification.paymentPlatform;
    const maybeNewId = await this.yagnaApi.market.counterProposalDemand(
      receivedProposal.demand.id,
      receivedProposal.id,
      decorationClone,
    );
    if (typeof maybeNewId !== "string") {
      throw new GolemInternalError(`Counter proposal failed ${maybeNewId.message}`);
    }
    const counterProposalDto = await this.yagnaApi.market.getProposalOffer(receivedProposal.demand.id, maybeNewId);
    return new ProposalNew(counterProposalDto, receivedProposal.demand);
  }
}
