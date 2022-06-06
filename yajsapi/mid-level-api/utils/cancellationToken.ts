export class CancellationToken {
  // private isCancelled = false;
  private _cancelled = false;

  get cancelled(): boolean {
    return this._cancelled;
  }

  cancel(): void {
    this._cancelled = true;
  }
}
