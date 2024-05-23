import { AgreementApiAdapter } from "./agreement-api-adapter";
import { YagnaAgreementOperationEvent, YagnaApi } from "../yagnaApi";
import { imock, instance, mock, when } from "@johanblumenberg/ts-mockito";
import { Logger } from "../../utils";
import { Agreement, IAgreementRepository } from "../../../agreement/agreement";
import {
  AgreementCancelledEvent,
  AgreementConfirmedEvent,
  AgreementRejectedEvent,
  AgreementTerminatedEvent,
} from "../../../agreement/agreement-event";
import { Subject } from "rxjs";

const mockYagnaApi = mock(YagnaApi);
const mockLogger = imock<Logger>();
const mockRepository = imock<IAgreementRepository>();
const mockAgreement = mock(Agreement);

describe("Agreement API Adapter", () => {
  describe("EventAPI", () => {
    test("Maps yagna AgreementApprovedEvent into AgreementConfirmedEvent and emits 'agreementConfirmed'", (done) => {
      // Given
      const agreement = instance(mockAgreement);

      const testSubject$ = new Subject<YagnaAgreementOperationEvent>();
      when(mockYagnaApi.agreementEvents$).thenReturn(testSubject$);

      const dto = {
        eventType: "AgreementApprovedEvent",
        eventDate: new Date().toString(),
        agreementId: "test-agreement-id",
      };

      const adapter = new AgreementApiAdapter(
        "testSessionId",
        instance(mockYagnaApi),
        instance(mockRepository),
        instance(mockLogger),
      );

      when(mockRepository.getById("test-agreement-id")).thenResolve(agreement);

      // When
      testSubject$.next(dto);

      // Then
      adapter.events.on("agreementConfirmed", (event) => {
        try {
          expect(event).toBeInstanceOf(AgreementConfirmedEvent);
          expect(event.agreement).toBe(agreement);
          done();
        } catch (err) {
          done(err);
        }
      });
    });

    test("Maps yagna AgreementTerminatedEvent into AgreementTerminatedEvent and emits 'agreementTerminated'", (done) => {
      // Given
      const agreement = instance(mockAgreement);

      const testSubject$ = new Subject<YagnaAgreementOperationEvent>();
      when(mockYagnaApi.agreementEvents$).thenReturn(testSubject$);

      const dto = {
        eventType: "AgreementTerminatedEvent",
        eventDate: new Date().toString(),
        agreementId: "test-agreement-id",
        terminator: "Provider",
        reason: {
          message: "Serious",
        },
      };

      const adapter = new AgreementApiAdapter(
        "testSessionId",
        instance(mockYagnaApi),
        instance(mockRepository),
        instance(mockLogger),
      );

      when(mockRepository.getById("test-agreement-id")).thenResolve(agreement);

      // When
      testSubject$.next(dto);

      // Then
      adapter.events.on("agreementTerminated", (event) => {
        try {
          expect(event).toBeInstanceOf(AgreementTerminatedEvent);
          expect(event.agreement).toBe(agreement);
          expect(event.reason).toBe("Serious");
          expect(event.terminatedBy).toBe("Provider");

          done();
        } catch (err) {
          done(err);
        }
      });
    });

    test("Maps yagna AgreementRejectedEvent into AgreementRejectedEvent and emits 'agreementRejected'", (done) => {
      // Given
      const agreement = instance(mockAgreement);

      const testSubject$ = new Subject<YagnaAgreementOperationEvent>();
      when(mockYagnaApi.agreementEvents$).thenReturn(testSubject$);

      const dto = {
        eventType: "AgreementRejectedEvent",
        eventDate: new Date().toString(),
        agreementId: "test-agreement-id",
        reason: {
          message: "Serious",
        },
      };

      const adapter = new AgreementApiAdapter(
        "testSessionId",
        instance(mockYagnaApi),
        instance(mockRepository),
        instance(mockLogger),
      );

      when(mockRepository.getById("test-agreement-id")).thenResolve(agreement);

      // When
      testSubject$.next(dto);

      // Then
      adapter.events.on("agreementRejected", (event) => {
        try {
          expect(event).toBeInstanceOf(AgreementRejectedEvent);
          expect(event.agreement).toBe(agreement);
          expect(event.reason).toBe("Serious");

          done();
        } catch (err) {
          done(err);
        }
      });
    });

    test("Maps yagna AgreementCancelledEvent into AgreementCancelledEvent and emits 'agreementCancelled'", (done) => {
      // Given
      const agreement = instance(mockAgreement);

      const testSubject$ = new Subject<YagnaAgreementOperationEvent>();
      when(mockYagnaApi.agreementEvents$).thenReturn(testSubject$);

      const dto = {
        eventType: "AgreementCancelledEvent",
        eventDate: new Date().toString(),
        agreementId: "test-agreement-id",
      };

      const adapter = new AgreementApiAdapter(
        "testSessionId",
        instance(mockYagnaApi),
        instance(mockRepository),
        instance(mockLogger),
      );

      when(mockRepository.getById("test-agreement-id")).thenResolve(agreement);

      // When
      testSubject$.next(dto);

      // Then
      adapter.events.on("agreementCancelled", (event) => {
        try {
          expect(event).toBeInstanceOf(AgreementCancelledEvent);
          expect(event.agreement).toBe(agreement);

          done();
        } catch (err) {
          done(err);
        }
      });
    });
  });
});
