import { imock, instance, mock, reset, spy, when, verify, _ } from "@johanblumenberg/ts-mockito";
import { Agreement, MarketModule } from "../market";
import { StorageProvider } from "../shared/storage";
import { AgreementPaymentProcess } from "../payment/agreement_payment_process";
import { ResourceRental, ResourceRentalOptions } from ".";
import { ActivityModule } from "../activity";
import { Logger } from "../shared/utils";

const mockAgreement = mock(Agreement);
const mockStorageProvider = imock<StorageProvider>();
const mockPaymentProcess = mock(AgreementPaymentProcess);
const mockMarketModule = imock<MarketModule>();
const mockActivityModule = imock<ActivityModule>();
const mockLogger = imock<Logger>();
const mockResourceRentalOptions = imock<ResourceRentalOptions>();
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
      when(rentalSpy["startStopAndFinalize"](_)).thenResolve();
      expect(resourceRental["finalizePromise"]).toBeUndefined();
      const promise1 = resourceRental.stopAndFinalize();
      const promise2 = resourceRental.stopAndFinalize();
      const promise3 = resourceRental.stopAndFinalize();
      expect(resourceRental["finalizePromise"]).toBeDefined();
      await Promise.all([promise1, promise2, promise3]);
      verify(rentalSpy["startStopAndFinalize"](_)).once();
      expect(resourceRental["finalizePromise"]).toBeUndefined();
    });
  });
});
