export default interface Callable<T, R> {
  (...T): R;
}
