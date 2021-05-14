import { logger } from "./";
export default async function asyncWith(expression, block) {
  let mgr = expression ? await expression.ready.call(expression) : null;
  let errInBlock;
  try {
    await block(mgr);
  } catch (error) {
    const { message, stack } = error;
    errInBlock = error;
  }
  await expression.done.call(expression, mgr);
  if (errInBlock) { throw errInBlock; }
}
