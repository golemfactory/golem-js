const sleep = (time: number) =>
  new Promise((resolve) => setTimeout(resolve, time * 1000));
export default sleep;
