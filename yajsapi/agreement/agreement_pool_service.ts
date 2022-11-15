import {Logger} from "../utils";
import {EventBus} from "../events/event_bus";
import {Agreement, AgreementState} from "./agreement";
import {ProposalForAgreementInterface} from "./interfaces";
import {RequestorApi} from "ya-ts-client/dist/ya-market/api";
import sleep from "../utils/sleep";

import {AgreementFactory} from "./factory";
import {AgreementConfigContainer} from "./agreement_config_container";

type AgreementsPool = Array<Agreement>;
type ProposalsPool = Array<ProposalForAgreementInterface>;

// TODO: This is now in rest/market - think about a better place
export type TerminationReason = { message: string; "golem.requestor.code"?: string };

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

  // TODO find better name - IT SHOULDN'T be avaliable as public
  private getAgreementById(id: string) {
    const index = this.agreements.findIndex((a) => a.getId() === id);
    if (index === -1) {
      throw new Error("Couldn't find agreement for ID=" + id )
    }
    const agreement = this.agreements[index];
    this.agreements.splice(index, 1);
    return agreement;
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
            this.processAgreementEvents(data);
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

  private sortAgreementsPool() {
    // 1. last should be Approved and not locked
    // 2. in the middle should be Approved and locked
    // 3. in the middle should be any others
    this.agreements.sort((a, b) => {
      const aScore = (a.getState() === AgreementState.Approved ? 10 : 0)
        + (!a.isLocked() ? 10 : 0);

      const bScore = (b.getState() === AgreementState.Approved ? 10 : 0)
          + (!b.isLocked() ? 10 : 0)

      if (aScore > bScore) {
        return -1;
      } else if (aScore < bScore) {
        return 1;
      }
      return 0;
    });
  }

  private getAvailableAgreement() {
    // Take the last agreement form the pool, agreements are sorted
    const agreement = this.agreements.pop();

    if (typeof agreement === "undefined" || agreement.getState() !== AgreementState.Approved) {
      throw new Error(`Could not find agreement to use`)
    }
    return agreement;
  }

  private getAvailableProposal() {
    // Take the last proposal form the pool, to be not available for others calls until it will be finished
    // - new proposals should be on the end
    const proposal = this.proposals.pop();

    if (typeof proposal === "undefined" || proposal.isUsed()) {
      throw new Error(`Could not find proposal to create agreement`)
    }
    return proposal;
  }

  private async createAgreementFromAvailableProposal() {
    const proposal = this.getAvailableProposal();

    // TODO Consider marking as used after successful creation of agreement, think about catching errors
    // push() or unshift() depends of the result of operation
    proposal.markAsUsed();
    this.proposals.unshift(proposal);

    this.logger?.info(`Creating agreement using proposal ID: ${proposal.getId()}`);
    try {
      const agreementFactory = new AgreementFactory(this.configContainer);
      const agreement = await agreementFactory.create(proposal);
      await agreement.refreshDetails();
      this.logger?.info(`Agreement ID: ${agreement.getId()} has been successfully created`);
      return agreement;
    } catch (e) {
      throw new Error(`Could not create agreement form available proposal: ${e.message}`)
    }
  }

  insertAgreementInPool(agreement) {
    // TODO: add check if the agreement will be not duplicated in pool

    this.agreements.push(agreement);
    this.sortAgreementsPool();
  }

  async get(): Promise<Agreement> {
    let availableAgreement;

    try {
      availableAgreement = this.getAvailableAgreement();
      this.logger?.info(`Reusing agreement. id: ${availableAgreement.getId()}`);
    } catch (e) {
      this.logger?.info(`Could not find available agreements`);
    }

    if (!availableAgreement) {
      availableAgreement = this.createAgreementFromAvailableProposal();
    }

    availableAgreement.lock();
    this.insertAgreementInPool(availableAgreement);

    return availableAgreement;
  }

  async releaseAgreementById(agreementId: string) {
    const agreement = this.getAgreementById(agreementId);
    await agreement.release();
    this.insertAgreementInPool(agreement);
  }

  async terminateAgreementById(agreementId: string, reason: TerminationReason) {
    try {
      const agreement = this.getAgreementById(agreementId);

      // TODO consider lock() and release() here or on in the agreement object
      await agreement.terminate() // TODO consider to pass the reason
      this.insertAgreementInPool(agreement);
    } catch (e) {
      throw new Error(`Failed to terminate agreement: ${e.message}`);
    }
  }

  async terminateAll(reason: TerminationReason) {
    return Promise.all(
        this.agreements.map(agreement => this.terminateAgreementById(agreement.getId(), reason))
    )
  }

  addProposal(proposal: ProposalForAgreementInterface) {
     this.proposals.push(proposal);
  }

  private processAgreementEvents(data: any) {
    // TODO: support events by changing the properties using eventtype, not by force refreshing Data
    // so this method should be rewrited in total
    Promise.all(data.map(async (row) => {
      try {
        this.logger?.info(`Processing event "${row.eventtype}" for agreement ID=${row.agreementId}`)
        const agreement = this.getAgreementById(row.agreementId);
        await agreement.refreshDetails();
        this.insertAgreementInPool(agreement);
      } catch (e) {
        this.logger?.error(`Error while process agreement event: ${e.message}`)
      }
    })).then((result) => {
      this.logger?.info(`processAgreementEvents, ${JSON.stringify(result)}`);
    })
  }

}

