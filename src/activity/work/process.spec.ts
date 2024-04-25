import { RemoteProcess } from "./process";
import { imock, instance, mock, reset } from "@johanblumenberg/ts-mockito";
import { Logger, YagnaApi } from "../../shared/utils";
import { Agreement, IActivityApi } from "../../agreement";
import { Activity } from "../index";
import {
  buildActivityResults,
  buildExeScriptErrorResult,
  buildExeScriptSuccessResult,
} from "../../../tests/unit/helpers";

const mockYagna = mock(YagnaApi);
const mockAgreement = mock(Agreement);
const mockActivity = mock(Activity);
const mockLogger = imock<Logger>();
const mockActivityApi = imock<IActivityApi>();

describe("RemoteProcess", () => {
  let activity: Activity;

  beforeEach(() => {
    reset(mockYagna);
    reset(mockAgreement);

    activity = instance(mockActivity);
  });

  it("should create remote process", async () => {
    const streamOfActivityResults = buildActivityResults([buildExeScriptSuccessResult("ok")]);
    const remoteProcess = new RemoteProcess(
      instance(mockActivityApi),
      streamOfActivityResults,
      activity,
      instance(mockLogger),
    );
    expect(remoteProcess).toBeDefined();
  });

  it("should read stdout from remote process", async () => {
    const streamOfActivityResults = buildActivityResults([buildExeScriptSuccessResult("Output")]);
    const remoteProcess = new RemoteProcess(
      instance(mockActivityApi),
      streamOfActivityResults,
      activity,
      instance(mockLogger),
    );
    for await (const stdout of remoteProcess.stdout) {
      expect(stdout).toEqual("Output");
    }
  });

  it("should read stderr from remote process", async () => {
    const streamOfActivityResults = buildActivityResults(undefined, [buildExeScriptErrorResult("Error", "Error")]);
    const remoteProcess = new RemoteProcess(
      instance(mockActivityApi),
      streamOfActivityResults,
      activity,
      instance(mockLogger),
    );
    for await (const stderr of remoteProcess.stderr) {
      expect(stderr).toEqual("Error");
    }
  });

  it("should wait for exit", async () => {
    const streamOfActivityResults = buildActivityResults([buildExeScriptSuccessResult("Ok")]);
    const remoteProcess = new RemoteProcess(
      instance(mockActivityApi),
      streamOfActivityResults,
      activity,
      instance(mockLogger),
    );
    const finalResult = await remoteProcess.waitForExit();
    expect(finalResult.result).toEqual("Ok");
  });
});
