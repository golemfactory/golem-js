import { ProposalDTO } from "./proposal";

/** Default Proposal filter that accept all proposal coming from the market */
export const acceptAllProposalFilter = () => async () => true;

/** Proposal filter blocking every offer coming from a provider whose id is in the array */
export const blackListProposalIdsFilter = (blackListIds: string[]) => async (proposal: ProposalDTO) =>
  !blackListIds.includes(proposal.issuerId);

/** Proposal filter blocking every offer coming from a provider whose name is in the array */
export const blackListProposalNamesFilter = (blackListNames: string[]) => async (proposal: ProposalDTO) =>
  !blackListNames.includes(proposal.provider.name);

/** Proposal filter blocking every offer coming from a provider whose name match to the regexp */
export const blackListProposalRegexpFilter = (regexp: RegExp) => async (proposal: ProposalDTO) =>
  !proposal.provider.name.match(regexp);

/** Proposal filter that only allows offers from a provider whose id is in the array */
export const whiteListProposalIdsFilter = (whiteListIds: string[]) => async (proposal: ProposalDTO) =>
  whiteListIds.includes(proposal.issuerId);

/** Proposal filter that only allows offers from a provider whose name is in the array */
export const whiteListProposalNamesFilter = (whiteListNames: string[]) => async (proposal: ProposalDTO) =>
  whiteListNames.includes(proposal.provider.name);

/** Proposal filter that only allows offers from a provider whose name match to the regexp */
export const whiteListProposalRegexpFilter = (regexp: RegExp) => async (proposal: ProposalDTO) =>
  !!proposal.provider.name.match(regexp);
