global.events = new Map();
global.errorEvents = new Map();

export class EventSourceMock {
  private activityId: string;
  constructor(url) {
    const chunks = url?.split("/");
    this.activityId = chunks[chunks.length - 3];
  }
  addEventListener(eventName, callback) {
    if (eventName === "runtime") {
      const runtimeInterval = setInterval(() => {
        const mockEvents = global.events.get(this.activityId) || [];
        if (mockEvents.length) {
          callback(mockEvents.shift());
        } else {
          clearInterval(runtimeInterval);
        }
      }, 100);
    }
    if (eventName === "error") {
      const errorInterval = setInterval(() => {
        const mockEvents = global.errorEvents.get(this.activityId) || [];
        if (mockEvents.length) {
          callback(mockEvents.shift());
        } else {
          clearInterval(errorInterval);
        }
      }, 100);
    }
  }
}

export const setExpectedEvents = (activityId, expectedEvents) => {
  global.events.set(
    activityId,
    expectedEvents.map((e) => JSON.parse(JSON.stringify(e))),
  );
};

export const setExpectedErrorEvents = (activityId, expectedErrors) => {
  global.errorEvents.set(
    activityId,
    expectedErrors.map((e) => JSON.parse(JSON.stringify(e))),
  );
};
