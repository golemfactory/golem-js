export default async function asyncWith(expression, block) {
    let mgr = await expression.ready();
    try {
        await block(mgr);
    } catch(error) {
        await expression.done(mgr);
    }
    await expression.done(mgr);
}
