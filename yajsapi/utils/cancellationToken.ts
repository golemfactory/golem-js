export default class Token {
  private _parent;
  private _cancelled: boolean;
  constructor(parent?) {
    if (parent) this._parent = parent;
    this._cancelled = false;
  }

  get cancelled(): boolean {
    return (
      this._cancelled ||
      (this._cancelled = this._parent ? this._parent.cancelled : false)
    );
  }

  cancel(): void {
    this._cancelled = true;
  }
}
