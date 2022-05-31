export class CancellationToken {
  private isCancelled = false;

  get cancelled(): boolean {
    return this.isCancelled;
  }

  cancel(): void {
    this.isCancelled = true;
  }
}
