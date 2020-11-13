import { Callable, eventLoop, Queue } from ".";

export default class AsyncWrapper {
    private _wrapped: Callable<any, any>;
    private _args_buffer: Queue<any>;
    private _task: any;
    private _loop: any;

    constructor(
        wrapped: Callable<any, any>,
        event_loop: any = null,
        cancellationToken
    ) {
        this._wrapped = wrapped;
        this._args_buffer = new Queue([], cancellationToken);
        this._task = null;
        this._loop = event_loop || eventLoop();
    }

    async _worker(): Promise<void> {
        while (true) {
            const args = await this._args_buffer.get()
            this._wrapped(...args)
            // this._args_buffer.task_done()
        }
    }

    async ready() {
        this._task = this._loop.create_task(this._worker.bind(this))
    }

    async done(): Promise<void> {
        // await this._args_buffer.join()
        if (this._task)
            this._task.cancel()
        this._task = null
    }

    async_call(): void {
        this._args_buffer.put([...arguments]);
    }
}
