import { Subscription } from "./subscription";

describe("Subscription", () => {
  it("should notify subscribers", () => {
    const subscription = new Subscription<number>();
    const subscriber = jest.fn();
    subscription.subscribe(subscriber);
    subscription.publish(42);
    expect(subscriber).toHaveBeenCalledWith(42);
  });

  it("should unsubscribe", () => {
    const subscription = new Subscription<number>();
    const subscriber = jest.fn();
    const unsubscribe = subscription.subscribe(subscriber);
    unsubscribe();
    subscription.publish(42);
    expect(subscriber).not.toHaveBeenCalled();
  });

  it("should filter events", () => {
    const subscription = new Subscription<number>();
    const subscriber = jest.fn();
    const filteredSubscription = subscription.filter((event) => event % 2 === 0);
    filteredSubscription.subscribe(subscriber);
    subscription.publish(1);
    subscription.publish(2);
    subscription.publish(3);
    expect(subscriber).toHaveBeenCalledWith(2);
    expect(subscriber).toHaveBeenCalledTimes(1);
  });

  it("should wait for an event", async () => {
    const subscription = new Subscription<number>();
    const promise = subscription.waitFor((event) => event === 42, { timeout: 100 });
    subscription.publish(42);
    const event = await promise;
    expect(event).toBe(42);
  });

  it("should timeout", async () => {
    const subscription = new Subscription<number>();
    const promise = subscription.waitFor((event) => event === 42, { timeout: 100 });
    await expect(promise).rejects.toThrow("Timeout");
  });

  it("should cleanup", () => {
    const subscription = new Subscription<number>();
    const cleanup = jest.fn();
    subscription.setCleanup(cleanup);
    subscription.end();
    expect(cleanup).toHaveBeenCalled();
  });
});
