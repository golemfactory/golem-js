import { Engine, Task, vm } from "./runner";
import { WorkContext } from "./runner/ctx";

// "Warning: Possible EventEmitter memory leak detected. 11 wakeup listeners added. Use emitter.setMaxListeners() to increase limit"
// Temp fix for the warning above, need to debug emitter and remove events, mostly causes from stringio
require('events').EventEmitter.prototype._maxListeners = 250;

export {
  Engine, Task, vm, WorkContext
}
