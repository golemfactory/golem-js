import { ProposalDTO } from "./proposal";

export const AcceptAllProposalFilter = () => async () => true;

export const BlackListProposalIdsFilter = (blackListIds: string[]) => async (proposal: ProposalDTO) =>
  !blackListIds.includes(proposal.issuerId);

export const BlackListProposalNamesFilter = (blackListNames: string[]) => async (proposal: ProposalDTO) =>
  !blackListNames.includes(proposal.provider.name);
export const BlackListProposalRegexpFilter = (regexp: RegExp) => async (proposal: ProposalDTO) =>
  !proposal.provider.name.match(regexp);

export const WhiteListProposalIdsFilter = (whiteListIds: string[]) => async (proposal: ProposalDTO) =>
  whiteListIds.includes(proposal.issuerId);

export const WhiteListProposalNamesFilter = (whiteListNames: string[]) => async (proposal: ProposalDTO) =>
  whiteListNames.includes(proposal.provider.name);

export const WhiteListProposalRegexpFilter = (regexp: RegExp) => async (proposal: ProposalDTO) =>
  !!proposal.provider.name.match(regexp);
