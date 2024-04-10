import { BatchSubscription } from "./batchSubscription";
describe("Batch Subscription", () => {
  it("should notify subscribers in batches", () => {
    const subscription = new BatchSubscription<number>(2);
    const subscriber = jest.fn();
    subscription.subscribe(subscriber);
    subscription.publish(42);
    expect(subscriber).not.toHaveBeenCalled();
    subscription.publish(43);
    expect(subscriber).toHaveBeenCalledWith([42, 43]);
  });

  it("should notify subscribers after timeout", () => {
    jest.useFakeTimers();
    const subscription = new BatchSubscription<number>(2, 100);
    const subscriber = jest.fn();
    subscription.subscribe(subscriber);
    subscription.publish(42);
    expect(subscriber).not.toHaveBeenCalled();
    jest.advanceTimersByTime(100);
    expect(subscriber).toHaveBeenCalledWith([42]);
  });

  it("should notify subscribers in batches", () => {
    const subscription = new BatchSubscription<number>(2);
    const subscriber = jest.fn();
    subscription.subscribe(subscriber);
    subscription.publish(42);
    subscription.publish(43);
    subscription.publish(44);
    subscription.publish(45);
    expect(subscriber).toHaveBeenCalledTimes(2);
    expect(subscriber).toHaveBeenNthCalledWith(1, [42, 43]);
    expect(subscriber).toHaveBeenNthCalledWith(2, [44, 45]);
  });

  it("should unsubscribe", () => {
    const subscription = new BatchSubscription<number>(1);
    const subscriber = jest.fn();
    const unsubscribe = subscription.subscribe(subscriber);
    subscription.publish(42);
    expect(subscriber).toHaveBeenCalledWith([42]);
    unsubscribe();
    subscription.publish(43);
    expect(subscriber).toHaveBeenCalledTimes(1);
  });
});
