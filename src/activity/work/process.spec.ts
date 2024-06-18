import { RemoteProcess } from "./process";
import { imock, instance, mock, reset } from "@johanblumenberg/ts-mockito";
import { Logger, YagnaApi } from "../../shared/utils";
import { Agreement } from "../../market/agreement";
import { Activity, ActivityModule } from "../index";
import {
  buildExecutorResults,
  buildExeScriptErrorResult,
  buildExeScriptSuccessResult,
} from "../../../tests/unit/helpers";

const mockYagna = mock(YagnaApi);
const mockAgreement = mock(Agreement);
const mockActivity = mock(Activity);
const mockLogger = imock<Logger>();
const mockActivityModule = imock<ActivityModule>();
describe("RemoteProcess", () => {
  let activity: Activity;

  beforeEach(() => {
    reset(mockYagna);
    reset(mockAgreement);
    reset(mockActivity);
    reset(mockLogger);
    reset(mockActivityModule);

    activity = instance(mockActivity);
  });

  it("should create remote process", async () => {
    const streamOfActivityResults = buildExecutorResults([buildExeScriptSuccessResult("ok")]);
    const remoteProcess = new RemoteProcess(
      instance(mockActivityModule),
      streamOfActivityResults,
      activity,
      instance(mockLogger),
    );
    expect(remoteProcess).toBeDefined();
  });

  it("should read stdout from remote process", async () => {
    const streamOfActivityResults = buildExecutorResults([buildExeScriptSuccessResult("Output")]);
    const remoteProcess = new RemoteProcess(
      instance(mockActivityModule),
      streamOfActivityResults,
      activity,
      instance(mockLogger),
    );
    for await (const stdout of remoteProcess.stdout) {
      expect(stdout).toEqual("Output");
    }
  });

  it("should read stderr from remote process", async () => {
    const streamOfActivityResults = buildExecutorResults(undefined, [buildExeScriptErrorResult("Error", "Error")]);
    const remoteProcess = new RemoteProcess(
      instance(mockActivityModule),
      streamOfActivityResults,
      activity,
      instance(mockLogger),
    );
    for await (const stderr of remoteProcess.stderr) {
      expect(stderr).toEqual("Error");
    }
  });

  it("should wait for exit", async () => {
    const streamOfActivityResults = buildExecutorResults([buildExeScriptSuccessResult("Ok")]);
    const remoteProcess = new RemoteProcess(
      instance(mockActivityModule),
      streamOfActivityResults,
      activity,
      instance(mockLogger),
    );
    const finalResult = await remoteProcess.waitForExit();
    expect(finalResult.result).toEqual("Ok");
  });
});
