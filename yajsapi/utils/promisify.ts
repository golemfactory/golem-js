export default function promisify(fn: (...args) => any): (arg) => Promise<any> {
  return (...args) =>
    new Promise((resolve, reject) => {
      try {
        fn(...args, resolve);
      } catch (error) {
        reject(error);
      }
    });
}
