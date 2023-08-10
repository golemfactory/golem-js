/**
 * @param time
 * @param inMs
 * @ignore
 */
const sleep = (time: number, inMs = false): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, time * (inMs ? 1 : 1000)));
export default sleep;
