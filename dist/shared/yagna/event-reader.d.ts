import { Logger } from "../utils";
import { Subject } from "rxjs";
import { EventDTO } from "ya-ts-client/dist/market-api";
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
type CancellablePromise<T> = Promise<T> & {
    cancel: () => void;
};
export type CancellableEventsFetcherWithCursor<T extends EventDTO> = (lastEventTimestamp: string) => CancellablePromise<T[]>;
export declare class EventReader {
    private readonly logger;
    constructor(logger: Logger);
    pollToSubject<T>(generator: AsyncGenerator<T>, subject: Subject<T>): Promise<void>;
    createReader<T extends EventDTO>(eventType: string, eventsFetcher: CancellableEventsFetcherWithCursor<T>): CancellablePoll<T>;
}
export {};
