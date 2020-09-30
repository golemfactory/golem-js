export default class AsyncExitStack {
  private _stack: any[] = [];
  async enter_async_context(ctx) {
    const _entered_ctx = await ctx.ready();
    this._stack.push(ctx);
    return _entered_ctx;
  }

  async aclose() {
    for (let i = 0; i < this._stack.length; i++) {
      await this._stack[i].done();
    }
  }
}
