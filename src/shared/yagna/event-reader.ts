import { Logger } from "../utils";
import { Subject } from "rxjs";
import { EventDTO } from "ya-ts-client/dist/market-api";
import { waitForCondition } from "../utils/wait";

export type CancellablePoll<T> = {
  /** User defined name of the event stream for ease of debugging */
  eventType: string;

  /** Tells if a poll call is currently active - reader */
  isBusy: boolean;

  /** Tells if the poll is active in general. If it's 'false' it means that the poll was cancelled and no polling attempts will be done any more */
  isOnline: boolean;

  /** Triggers the poll using the fetcher provided when the CancellablePoll was created */
  pollValues: () => AsyncGenerator<T>;

  /**
   * Cancels the polling operations, stopping the reader
   *
   * It will wait for the last read to complete and will take the reader offline
   */
  cancel: () => Promise<void>;
};

export type EventsFetcherWithCursor<T extends EventDTO> = (lastEventTimestamp: string) => Promise<T[]>;

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
    eventsFetcher: EventsFetcherWithCursor<T>,
  ): CancellablePoll<T> {
    let isBusy = false;
    let isOnline = true;
    let keepReading = true;
    let lastTimestamp = new Date().toISOString();

    const logger = this.logger;

    return {
      eventType,
      isBusy,
      isOnline,
      pollValues: async function* () {
        while (keepReading) {
          try {
            isBusy = true;
            const events = await eventsFetcher(lastTimestamp);
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
            logger.error("Error fetching events from Yagna", { eventType, error });
          } finally {
            isBusy = false;
          }
        }
        logger.debug("Stopped reading events", { eventType });
        isOnline = false;
      },
      cancel: async function () {
        keepReading = false;
        await waitForCondition(() => !isBusy && !isOnline);
        logger.debug("Cancelled reading the events", { eventType });
      },
    };
  }
}
