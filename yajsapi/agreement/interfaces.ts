export interface ProposalForAgreementInterface {
    getId(): string;
    getValidTo(): string;
    getScore(): number;
    isUsed(): boolean;
    markAsUsed(): void;
}