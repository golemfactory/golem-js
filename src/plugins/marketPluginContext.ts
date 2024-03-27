import { PluginContext } from "./pluginContext";
import { MarketApi } from "ya-ts-client";
type DemandDTO = MarketApi.DemandDTO;
type ProposalDTO = MarketApi.ProposalDTO;

type OkOrNot = { isAccepted: true } | { isAccepted: false; reason: string };
export type MarketHooks = {
  beforeDemandPublished: (demand: DemandDTO) => DemandDTO | Promise<DemandDTO>;
  filterInitialProposal: (proposal: ProposalDTO) => OkOrNot | Promise<OkOrNot>;
};

export type MarketEvents = {
  demandPublished: (demand: DemandDTO) => void;
  initialProposalReceived: (proposal: ProposalDTO) => void;
};

export class MarketPluginContext extends PluginContext<MarketHooks, MarketEvents> {}
