import { RemoteProcess } from "./process";
import { ActivityMock } from "../../tests/mock/activity.mock";
import { Run, Script } from "../script";
import { instance, mock, reset } from "@johanblumenberg/ts-mockito";
import { YagnaApi } from "../utils";
import { Agreement } from "../agreement";

const mockYagna = mock(YagnaApi);
const mockAgreement = mock(Agreement);

describe("RemoteProcess", () => {
  let activity: ActivityMock;

  beforeEach(() => {
    reset(mockYagna);
    reset(mockAgreement);

    activity = new ActivityMock("test_id", instance(mockAgreement), yagna);
  });

  const yagna = instance(mockYagna);

  it("should create remote process", async () => {
    const expectedResult = ActivityMock.createResult({ stdout: "Ok" });
    activity.mockResults([expectedResult]);
    const exeScriptRequest = new Script([new Run("test_command")]).getExeScriptRequest();
    const streamOfActivityResults = await activity.execute(exeScriptRequest, true);
    const remoteProcess = new RemoteProcess(streamOfActivityResults, activity);
    expect(remoteProcess).toBeDefined();
  });

  it("should read stdout from remote process", async () => {
    const expectedResult = ActivityMock.createResult({ stdout: "Output" });
    activity.mockResults([expectedResult]);
    const exeScriptRequest = new Script([new Run("test_command")]).getExeScriptRequest();
    const streamOfActivityResults = await activity.execute(exeScriptRequest, true);
    const remoteProcess = new RemoteProcess(streamOfActivityResults, activity);
    for await (const stdout of remoteProcess.stdout) {
      expect(stdout).toEqual("Output");
    }
  });

  it("should read stderr from remote process", async () => {
    const expectedResult = ActivityMock.createResult({ stderr: "Error" });
    activity.mockResults([expectedResult]);
    const exeScriptRequest = new Script([new Run("test_command")]).getExeScriptRequest();
    const streamOfActivityResults = await activity.execute(exeScriptRequest, true);
    const remoteProcess = new RemoteProcess(streamOfActivityResults, activity);
    for await (const stderr of remoteProcess.stderr) {
      expect(stderr).toEqual("Error");
    }
  });

  it("should wait for exit", async () => {
    const expectedResult = ActivityMock.createResult({ stdout: "Output", stderr: "Error" });
    activity.mockResults([expectedResult]);
    const exeScriptRequest = new Script([new Run("test_command")]).getExeScriptRequest();
    const streamOfActivityResults = await activity.execute(exeScriptRequest, true);
    const remoteProcess = new RemoteProcess(streamOfActivityResults, activity);
    const finalResult = await remoteProcess.waitForExit();
    expect(finalResult.result).toEqual("Ok");
  });
});
