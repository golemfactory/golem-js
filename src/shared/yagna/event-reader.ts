import { Logger } from "../utils";
import { Subject } from "rxjs";
import { EventDTO } from "ya-ts-client/dist/market-api";
import { waitForCondition } from "../utils/wait";

export type CancellablePoll<T> = {
  /** User defined name of the event stream for ease of debugging */
  eventType: string;

  /** Flag indicating if the reader is finished and no longer polling */
  isFinished: boolean;

  /** Triggers the poll using the fetcher provided when the CancellablePoll was created */
  pollValues: () => AsyncGenerator<T>;

  /**
   * Cancels the polling operations, stopping the reader
   */
  cancel: () => Promise<void>;
};

type CancellablePromise<T> = Promise<T> & { cancel: () => void };
export type CancellableEventsFetcherWithCursor<T extends EventDTO> = (
  lastEventTimestamp: string,
) => CancellablePromise<T[]>;

export class EventReader {
  public constructor(private readonly logger: Logger) {}

  public async pollToSubject<T>(generator: AsyncGenerator<T>, subject: Subject<T>) {
    for await (const value of generator) {
      subject.next(value);
    }

    subject.complete();
  }

  public createReader<T extends EventDTO>(
    eventType: string,
    eventsFetcher: CancellableEventsFetcherWithCursor<T>,
  ): CancellablePoll<T> {
    let isFinished = false;
    let keepReading = true;
    let currentPoll: CancellablePromise<T[]> | null = null;
    let lastTimestamp = new Date().toISOString();

    const logger = this.logger;

    return {
      eventType,
      isFinished,
      pollValues: async function* () {
        while (keepReading) {
          try {
            currentPoll = eventsFetcher(lastTimestamp);
            const events = await currentPoll;
            logger.debug("Polled events from Yagna", {
              eventType,
              count: events.length,
              lastEventTimestamp: lastTimestamp,
            });
            for (const event of events) {
              yield event;
              lastTimestamp = event.eventDate;
            }
          } catch (error) {
            if (typeof error === "object" && error.name === "CancelError") {
              logger.debug("Polling was cancelled", { eventType });
              continue;
            }
            logger.error("Error fetching events from Yagna", { eventType, error });
          }
        }
        logger.debug("Stopped reading events", { eventType });
        isFinished = true;
      },
      cancel: async function () {
        keepReading = false;
        if (currentPoll) {
          currentPoll.cancel();
        }
        await waitForCondition(() => isFinished, { intervalSeconds: 0 });
        logger.debug("Cancelled reading the events", { eventType });
      },
    };
  }
}
