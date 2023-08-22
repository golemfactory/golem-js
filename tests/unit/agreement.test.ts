import { LoggerMock } from "../mock";
import { Agreement } from "../../src/agreement";
import { AgreementStateEnum } from "ya-ts-client/dist/ya-market/src/models/agreement";
import { YagnaMock } from "../mock/rest/yagna";

const logger = new LoggerMock();
const yagnaApi = new YagnaMock().getApi();

describe("Agreement", () => {
  beforeEach(() => logger.clear());
  describe("create()", () => {
    it("should create agreement for given proposal Id", async () => {
      const agreement = await Agreement.create("test_proposal_id", yagnaApi, { logger });
      expect(agreement).toBeInstanceOf(Agreement);
      expect(agreement.id).toHaveLength(64);
      expect(logger.logs).toMatch(/Agreement .* created/);
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
      expect(logger.logs).toMatch(/Agreement .* terminated/);
    });
  });

  describe("confirm()", () => {
    it("should confirm agreement", async () => {
      const agreement = await Agreement.create("test_proposal_id", yagnaApi, { logger });
      await agreement.confirm();
      expect(logger.logs).toMatch(/Agreement .* approved/);
    });
  });
});
