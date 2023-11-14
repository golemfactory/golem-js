/**
 * This interface describes events emitted by `TaskExecutor` through `TaskExecutor.events` object.
 */
export interface TaskExecutorEventsDict {
  /**
   * Fires when task executor is initialized and ready to be used.
   */
  initialized: () => void;

  /**
   * Fires when task executor is about to shut down, immediately after TaskExecutor.end() is called.
   */
  terminating: () => void;

  /**
   * Fires when task executor is completely terminated.
   */
  terminated: () => void;
}
