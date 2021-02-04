export default function promisify(fn: Function): Function {
  return (...args) =>
    new Promise((resolve, reject) => {
      try {
        fn(...args, resolve);
      } catch (error) {
        reject(error);
      }
    });
}
