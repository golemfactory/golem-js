import { logger } from "./";
export default async function asyncWith(expression, block) {
  let mgr = expression ? await expression.ready() : null;
  try {
    await block(mgr);
  } catch (error) {
    const { message, stack } = error;
    console.log();
    logger.error(`${message}\n\n${stack}\n`);
  }
  await expression.done(mgr);
}
