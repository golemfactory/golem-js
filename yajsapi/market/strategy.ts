import { ProposalDTO } from "./proposal";

export const AcceptAllProposalFilter = () => async () => true;

export const BlackListProposalIdsFilter = (blackListIds: string[]) => async (proposal: ProposalDTO) =>
  !blackListIds.includes(proposal.issuerId);

export const BlackListProposalNamesFilter = (regexp: RegExp) => async (proposal: ProposalDTO) =>
  !proposal.provider.name.match(regexp);

export const WhiteListProposalIdsFilter = (whiteListIds: string[]) => async (proposal: ProposalDTO) =>
  whiteListIds.includes(proposal.issuerId);

export const WhiteListProposalNamesFilter = (regexp: RegExp) => async (proposal: ProposalDTO) =>
  proposal.provider.name.match(regexp);
