import { LoggerMock, YagnaMock } from "../mock";
import { Agreement } from "../../src/agreement";
import { AgreementStateEnum } from "ya-ts-client/dist/ya-market/src/models/agreement";

const logger = new LoggerMock();
const yagnaApi = new YagnaMock().getApi();

describe("Agreement", () => {
  beforeEach(() => logger.clear());
  describe("create()", () => {
    it("should create agreement for given proposal Id", async () => {
      const agreement = await Agreement.create("test_proposal_id", yagnaApi, { logger });
      expect(agreement).toBeInstanceOf(Agreement);
      expect(agreement.id).toHaveLength(64);
      await logger.expectToInclude("Agreement created", { id: agreement.id });
    });
  });

  describe("provider", () => {
    it("should be a instance ProviderInfo with provider details", async () => {
      const agreement = await Agreement.create("test_proposal_id", yagnaApi, { logger });
      expect(agreement).toBeInstanceOf(Agreement);
      expect(agreement.provider.id).toEqual(expect.any(String));
      expect(agreement.provider.name).toEqual(expect.any(String));
    });
  });

  describe("getState()", () => {
    it("should return state of agreement", async () => {
      const agreement = await Agreement.create("test_proposal_id", yagnaApi, { logger });
      expect(await agreement.getState()).toEqual(AgreementStateEnum.Approved);
    });
  });

  describe("terminate()", () => {
    it("should terminate agreement", async () => {
      const agreement = await Agreement.create("test_proposal_id", yagnaApi, { logger });
      await agreement.terminate();
      await logger.expectToInclude("Agreement terminated", { id: agreement.id });
    });
  });

  describe("confirm()", () => {
    it("should confirm agreement", async () => {
      const agreement = await Agreement.create("test_proposal_id", yagnaApi, { logger });
      await agreement.confirm();
      await logger.expectToInclude("Agreement approved", { id: agreement.id });
    });
  });
});
