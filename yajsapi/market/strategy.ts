import { ProposalDTO } from "./proposal";

/** Default Proposal filter that accept all proposal coming from the market */
export const AcceptAllProposalFilter = () => async () => true;

/** Proposal filter blocking every offer coming from a provider whose id is in the array */
export const BlackListProposalIdsFilter = (blackListIds: string[]) => async (proposal: ProposalDTO) =>
  !blackListIds.includes(proposal.issuerId);

/** Proposal filter blocking every offer coming from a provider whose name is in the array */
export const BlackListProposalNamesFilter = (blackListNames: string[]) => async (proposal: ProposalDTO) =>
  !blackListNames.includes(proposal.provider.name);

/** Proposal filter blocking every offer coming from a provider whose name match to the regexp */
export const BlackListProposalRegexpFilter = (regexp: RegExp) => async (proposal: ProposalDTO) =>
  !proposal.provider.name.match(regexp);

/** Proposal filter that only allows offers from a provider whose id is in the array */
export const WhiteListProposalIdsFilter = (whiteListIds: string[]) => async (proposal: ProposalDTO) =>
  whiteListIds.includes(proposal.issuerId);

/** Proposal filter that only allows offers from a provider whose name is in the array */
export const WhiteListProposalNamesFilter = (whiteListNames: string[]) => async (proposal: ProposalDTO) =>
  whiteListNames.includes(proposal.provider.name);

/** Proposal filter that only allows offers from a provider whose name match to the regexp */
export const WhiteListProposalRegexpFilter = (regexp: RegExp) => async (proposal: ProposalDTO) =>
  !!proposal.provider.name.match(regexp);
