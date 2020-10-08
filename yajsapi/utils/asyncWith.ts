import { logger } from "./";
export default async function asyncWith(expression, block) {
    let mgr = await expression.ready();
    try {
        await block(mgr);
    } catch(error) {
        const { message,  stack } = error;
        console.log();
        logger.error(`${message}\n\n${stack}\n`);
        await expression.done(mgr);
    }
    await expression.done(mgr);
}
