import { RemoteProcess } from "./process";
import { instance, mock, reset } from "@johanblumenberg/ts-mockito";
import { YagnaApi } from "../utils";
import { Agreement } from "../agreement";
import { Activity } from "../activity";
import { buildActivityResults, buildExeScriptErrorResult, buildExeScriptSuccessResult } from "../../tests/unit/helpers";

const mockYagna = mock(YagnaApi);
const mockAgreement = mock(Agreement);
const mockActivity = mock(Activity);

describe("RemoteProcess", () => {
  let activity: Activity;

  beforeEach(() => {
    reset(mockYagna);
    reset(mockAgreement);

    activity = instance(mockActivity);
  });

  it("should create remote process", async () => {
    const streamOfActivityResults = buildActivityResults([buildExeScriptSuccessResult("ok")]);
    const remoteProcess = new RemoteProcess(streamOfActivityResults, activity);
    expect(remoteProcess).toBeDefined();
  });

  it("should read stdout from remote process", async () => {
    const streamOfActivityResults = buildActivityResults([buildExeScriptSuccessResult("Output")]);
    const remoteProcess = new RemoteProcess(streamOfActivityResults, activity);
    for await (const stdout of remoteProcess.stdout) {
      expect(stdout).toEqual("Output");
    }
  });

  it("should read stderr from remote process", async () => {
    const streamOfActivityResults = buildActivityResults(undefined, [buildExeScriptErrorResult("Error", "Error")]);
    const remoteProcess = new RemoteProcess(streamOfActivityResults, activity);
    for await (const stderr of remoteProcess.stderr) {
      expect(stderr).toEqual("Error");
    }
  });

  it("should wait for exit", async () => {
    const streamOfActivityResults = buildActivityResults([buildExeScriptSuccessResult("Ok")]);
    const remoteProcess = new RemoteProcess(streamOfActivityResults, activity);
    const finalResult = await remoteProcess.waitForExit();
    expect(finalResult.result).toEqual("Ok");
  });
});
