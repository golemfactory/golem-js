import { RequestorControlApi } from "ya-ts-client/dist/ya-activity/api";

const results = {
  exec: "",
};
const errors = {};

export class RequestorControlApiMock extends RequestorControlApi {
  constructor() {
    super();
  }
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  async exec(): Promise<string> {
    return results?.exec;
  }
}

export function setExpected(function_name, res, err?) {
  results[function_name] = res;
  errors[function_name] = err;
}
