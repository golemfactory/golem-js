const sleep = (time: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, time));
export default sleep;
