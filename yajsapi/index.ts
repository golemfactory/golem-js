import { BatchResults, Executor, Task, sgx, vm } from "./executor";
import { WorkContext, Work, ExecOptions } from "./executor/ctx";
import { Golem } from "./executor/golem";
import * as props from "./props";
import * as rest from "./rest";
import * as storage from "./storage";
import * as utils from "./utils";
import * as network from "./network";
import * as activity from "./activity";
import * as script from "./script";

// For debug purposes, in case of unhandled rejection issues
// detect the related async call with this
//
// process.on('unhandledRejection', (reason, p) => {
//   console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
// });

export {
  Golem,
  Executor,
  ExecOptions,
  Task,
  sgx,
  vm,
  Work,
  WorkContext,
  BatchResults,
  props,
  rest,
  storage,
  utils,
  network,
  activity,
  script,
};
