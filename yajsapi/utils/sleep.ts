const sleep = (time: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, time * 1000));
export default sleep;
