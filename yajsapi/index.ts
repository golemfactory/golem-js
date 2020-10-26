import events from "events";
import { Engine, Task, sgx, vm } from "./runner";
import { WorkContext } from "./runner/ctx";
import * as props from "./props";
import * as rest from "./rest";
import * as storage from "./storage";
import * as utils from "./utils";

// "Warning: Possible EventEmitter memory leak detected. 11 wakeup listeners added. Use emitter.setMaxListeners() to increase limit"
// Temp fix for the warning above, need to debug emitter and remove events, mostly causes from stringio
events.EventEmitter.prototype.setMaxListeners(250);

export { Engine, Task, sgx, vm, WorkContext, props, rest, storage, utils };
