import { imock, instance, mock, reset, spy, when, verify, _ } from "@johanblumenberg/ts-mockito";
import { Agreement, MarketModule } from "../market";
import { StorageProvider } from "../shared/storage";
import { AgreementPaymentProcess } from "../payment/agreement_payment_process";
import { ResourceRental, ResourceRentalOptions } from ".";
import { ActivityModule, ExeUnit } from "../activity";
import { Logger } from "../shared/utils";

const mockAgreement = mock(Agreement);
const mockStorageProvider = imock<StorageProvider>();
const mockPaymentProcess = mock(AgreementPaymentProcess);
const mockMarketModule = imock<MarketModule>();
const mockActivityModule = imock<ActivityModule>();
const mockLogger = imock<Logger>();
const mockResourceRentalOptions = imock<ResourceRentalOptions>();
const mockExeUnit = mock(ExeUnit);
when(mockResourceRentalOptions.networkNode).thenReturn(undefined);

let resourceRental: ResourceRental;

beforeEach(() => {
  reset(mockAgreement);
  reset(mockStorageProvider);
  reset(mockPaymentProcess);
  reset(mockMarketModule);
  reset(mockActivityModule);
  reset(mockLogger);
  reset(mockResourceRentalOptions);
  when(mockActivityModule.createExeUnit(_, _)).thenResolve(instance(mockExeUnit));
  resourceRental = new ResourceRental(
    instance(mockAgreement),
    instance(mockStorageProvider),
    instance(mockPaymentProcess),
    instance(mockMarketModule),
    instance(mockActivityModule),
    instance(mockLogger),
    instance(mockResourceRentalOptions),
  );
});

describe("ResourceRental", () => {
  describe("stopAndFinalize", () => {
    it("reuses the same promise if called multiple times", async () => {
      const rentalSpy = spy(resourceRental);
      expect(resourceRental["finalizePromise"]).toBeUndefined();
      const promise1 = resourceRental.stopAndFinalize();
      const promise2 = resourceRental.stopAndFinalize();
      const promise3 = resourceRental.stopAndFinalize();
      expect(resourceRental["finalizePromise"]).toBeDefined();
      await Promise.all([promise1, promise2, promise3]);
      verify(rentalSpy["startStopAndFinalize"](_)).once();
      expect(resourceRental["finalizePromise"]).toBeUndefined();
    });
    it("should not run terdown multiple times", async () => {
      const rentalSpy = spy(resourceRental);
      when(rentalSpy["fetchAgreementState"]()).thenResolve("Terminated");
      when(mockPaymentProcess.isFinished()).thenReturn(true);
      expect(resourceRental["finalizePromise"]).toBeUndefined();
      await resourceRental.stopAndFinalize();
      await resourceRental.stopAndFinalize();
      await resourceRental.stopAndFinalize();
      verify(mockExeUnit.teardown()).once();
      expect(resourceRental["finalizePromise"]).toBeUndefined();
    });
    describe("ExeUnit", () => {
      it("should create an exe unit on startup and use it later", async () => {
        expect(resourceRental["currentExeUnit"]).toBeDefined();
        verify(mockActivityModule.createExeUnit(_, _)).once();
        await resourceRental.getExeUnit();
        verify(mockActivityModule.createExeUnit(_, _)).once();
      });

      it("should reuse the same promise if called multiple times", async () => {
        expect(resourceRental["currentExeUnit"]).toBeDefined();
        const promise1 = resourceRental.getExeUnit();
        const promise2 = resourceRental.getExeUnit();
        const promise3 = resourceRental.getExeUnit();
        await Promise.all([promise1, promise2, promise3]);
        verify(mockActivityModule.createExeUnit(_, _)).once();
      });

      it("should reuse the same promise if called multiple time after destroy exe-unit created on strtup", async () => {
        expect(resourceRental["currentExeUnit"]).toBeDefined();
        await resourceRental.destroyExeUnit();
        const promise1 = resourceRental.getExeUnit();
        const promise2 = resourceRental.getExeUnit();
        const promise3 = resourceRental.getExeUnit();
        expect(resourceRental["exeUnitPromise"]).toBeDefined();
        await Promise.all([promise1, promise2, promise3]);
        verify(mockActivityModule.createExeUnit(_, _)).twice();
      });
    });
  });
});
