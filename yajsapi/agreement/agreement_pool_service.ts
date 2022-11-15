import { Logger } from "../utils";
import { EventBus } from "../events/event_bus";
import { Agreement } from "./agreement";
import { ProposalForAgreementInterface } from "./interfaces";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import sleep from "../utils/sleep";

import {
  TerminationReason as MarketTerminationReason
} from "../rest/market";

import { AgreementFactory } from "./factory";
import { AgreementConfigContainer } from "./agreement_config_container";

type AgreementsPool = Array<Agreement>;
type ProposalsPool = Array<ProposalForAgreementInterface>;

export class AgreementPoolService {
  private logger?: Logger;
  private eventBus: EventBus;
  private api: RequestorApi;
  private eventPoolingInterval: number;
  private eventPoolingMaxEventsPerRequest: number;

  private proposals: ProposalsPool = [];
  private agreements: AgreementsPool = [];
  private serviceIsRunning = false;

  constructor(
      private readonly configContainer: AgreementConfigContainer
  ) {
    this.logger = configContainer.logger;
    this.api = configContainer.api;
    this.eventBus = configContainer.eventBus;
    this.eventPoolingInterval = configContainer.options?.eventPoolingInterval || 10000;
    this.eventPoolingMaxEventsPerRequest = configContainer.options?.eventPoolingMaxEventsPerRequest || 10;

  }

  run() {
    this.logger?.info("The Agreement Pool Service has started");
    this.serviceIsRunning = true;
    this.subscribeForAgreementEvents();
  }

  stop() {
    this.logger?.info("The Agreement Pool Service has been stopped");
    // TODO: 1. close agreements / terminate etc
    this.serviceIsRunning = false;
  }

  isServiceRunning(): boolean {
    return this.serviceIsRunning; // TODO: cancellation token
  }
  
  private subscribeForAgreementEvents() {
    this.logger?.info("Subscribe YAGNA for agreement events");

    // Convert microseconds to sec, and be sure that is higher or equal 1
    const eventPoolingInterval = Math.max(1, Math.floor(this.eventPoolingInterval / 1000));

    // On start service we initialize with current date,
    //   but after every each call we have take the latest event timestamp from
    //   response, in case if the maxEvents number will be exceeded
    let lastEventTimestamp = (new Date(Date.now()).toISOString()).toString();

    (async () => {
      while (this.isServiceRunning()) {
        try {
          const {data} = await this.api.collectAgreementEvents(
              eventPoolingInterval,
              lastEventTimestamp,
              this.eventPoolingMaxEventsPerRequest
          );
          if (data.length > 0) {
            lastEventTimestamp = data[data.length - 1].eventDate;
          }

          this.logger?.info(
              `call collectAgreementEvents() [timeout=${eventPoolingInterval}s, `
              + `afterTimestamp=${lastEventTimestamp}, `
              + `maxEvents=${this.eventPoolingMaxEventsPerRequest}]`
              + ` => Returns ${data.length} agreement events`);

        } catch (e) {
          this.logger?.error(
              `call collectAgreementEvents() [timeout=${eventPoolingInterval}s, `
              + `afterTimestamp=${lastEventTimestamp}, `
              + `maxEvents=${this.eventPoolingMaxEventsPerRequest}]`
              + ` => Returns error "${e.message}" . Next try in ${eventPoolingInterval}s`);

          await sleep(eventPoolingInterval)
        }
      }
    })()
  }
  //
  // private getAndLockAvailableAgreement() {
  //   const agreement = this.agreements.available.pop();
  //
  //   if(agreement) {
  //     this.agreements.inUse.push(agreement);
  //   }
  //
  //   return agreement;
  // }
  //
  // private getAndUseAvailableProposal() {
  //   const proposal = this.proposals.available.pop();
  //
  //   if(proposal) {
  //     this.proposals.used.push(proposal);
  //   }
  //
  //   return proposal;
  // }
  //
  // async get(): Promise<Agreement> {
  //   let availableAgreement = this.getAndLockAvailableAgreement();
  //   if (availableAgreement) {
  //     this.logger?.debug(`Reusing agreement. id: ${availableAgreement.getId()}`);
  //   } else {
  //     const proposal = this.getAndUseAvailableProposal();
  //     if (proposal) {
  //       const agreementFactory = new AgreementFactory(this.configContainer);
  //       availableAgreement = await agreementFactory.create(proposal);
  //     }
  //   }
  //
  //   return new Promise<Agreement>((resolve, reject) => {
  //     if(availableAgreement) {
  //       resolve(availableAgreement)
  //     } else {
  //       // type NoAvaliableAgreement
  //       reject();
  //     }
  //   });
  // }
  //
  // private findIndexById(id) {
  //   return (e) => e.getId() === id
  // }
  //
  // private takeAndRemoveElementFromArrayById<T>(array: Array<T>, id) : [T | undefined, Array<T>] {
  //   const index = array.findIndex(this.findIndexById(id));
  //   const element = array[index];
  //   if (index > -1) {
  //     array.splice(index, 1);
  //   }
  //   return [element, array];
  // }
  //
  // async releaseAgreementById(agreementId: string) {
  //   const [agreement, inUseAgreements] = this.takeAndRemoveElementFromArrayById(this.agreements.inUse, agreementId)
  //   this.agreements.inUse = inUseAgreements;
  //
  //   if (agreement) {
  //     this.agreements.available.push(agreement);
  //   }
  // }
  //
  // async terminateAgreementById(agreementId: string, reason: MarketTerminationReason) {
  //   const [agreement, inUseAgreements] = this.takeAndRemoveElementFromArrayById(this.agreements.inUse, agreementId)
  //   this.agreements.inUse = inUseAgreements;
  //
  //   if (agreement) {
  //     this.agreements.terminated.push(agreement);
  //   }
  //   //await this.agreementPoolOld.release_agreement(agreementId);
  // }
  //
  // async terminateAll(reason: MarketTerminationReason) {
  //   return Promise.all(this.agreements.available.map(agreement => this.terminateAgreementById(agreement.getId(), reason)))
  //   //await this.agreementPoolOld.terminate_all(reason);
  // }
  //
  // addProposal(proposal: ProposalForAgreementInterface) {
  //   this.proposals.available.push(proposal);
  // }

}

