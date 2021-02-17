import { Executor, Task, sgx, vm } from "./executor";
import { WorkContext } from "./executor/ctx";
import * as props from "./props";
import * as rest from "./rest";
import * as storage from "./storage";
import * as utils from "./utils";

// For debug purposes, in case of unhandled rejection issues 
// detect the related async call with this
//
// process.on('unhandledRejection', (reason, p) => {
//   console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
// });

export { Executor, Task, sgx, vm, WorkContext, props, rest, storage, utils };
