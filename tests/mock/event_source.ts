const events: Map<string, object[]> = new Map();
const errorEvents: Map<string, object[]> = new Map();

export default class EventSourceMock {
  private activityId: string;
  constructor(url) {
    const chunks = url?.split("/");
    this.activityId = chunks[chunks.length - 3];
  }
  addEventListener(eventName, callback) {
    if (eventName === "runtime") {
      const runtimeInterval = setInterval(() => {
        const mockEvents = events.get(this.activityId) || [];
        if (mockEvents.length) {
          callback(mockEvents.shift());
        } else {
          clearInterval(runtimeInterval);
        }
      }, 100);
    }
    if (eventName === "error") {
      const runtimeInterval = setInterval(() => {
        const mockEvents = errorEvents.get(this.activityId) || [];
        if (mockEvents.length) {
          callback(mockEvents.shift());
        } else {
          clearInterval(runtimeInterval);
        }
      }, 100);
    }
  }
}

export const setExpectedEvents = (activityId, expectedEvents) => {
  events.set(
    activityId,
    expectedEvents.map((e) => JSON.parse(JSON.stringify(e)))
  );
};

export const setExpectedErrorEvents = (activityId, expectedErrors) => {
  errorEvents.set(
    activityId,
    expectedErrors.map((e) => JSON.parse(JSON.stringify(e)))
  );
};
