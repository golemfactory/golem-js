import { RemoteProcess } from "./process";
import { ActivityMock } from "../../tests/mock/activity.mock";
import { YagnaMock } from "../../tests/mock";
import { Run, Script } from "../script";
import { ResultState } from "../activity";

describe("RemoteProcess", () => {
  let activity: ActivityMock;
  beforeEach(() => {
    activity = new ActivityMock("test_id", "test_id", new YagnaMock().getApi());
  });

  it("should create remote process", async () => {
    const expectedResult = ActivityMock.createResult({ stdout: "Ok" });
    activity.mockResults([expectedResult]);
    const exeScriptRequest = new Script([new Run("test_command")]).getExeScriptRequest();
    const streamOfActivityResults = await activity.execute(exeScriptRequest, true);
    const remoteProcess = new RemoteProcess(streamOfActivityResults);
    expect(remoteProcess).toBeDefined();
  });

  it("should read stdout from remote process", async () => {
    const expectedResult = ActivityMock.createResult({ stdout: "Output" });
    activity.mockResults([expectedResult]);
    const exeScriptRequest = new Script([new Run("test_command")]).getExeScriptRequest();
    const streamOfActivityResults = await activity.execute(exeScriptRequest, true);
    const remoteProcess = new RemoteProcess(streamOfActivityResults);
    for await (const stdout of remoteProcess.stdout) {
      expect(stdout).toEqual("Output");
    }
  });

  it("should read stderr from remote process", async () => {
    const expectedResult = ActivityMock.createResult({ stderr: "Error" });
    activity.mockResults([expectedResult]);
    const exeScriptRequest = new Script([new Run("test_command")]).getExeScriptRequest();
    const streamOfActivityResults = await activity.execute(exeScriptRequest, true);
    const remoteProcess = new RemoteProcess(streamOfActivityResults);
    for await (const stderr of remoteProcess.stderr) {
      expect(stderr).toEqual("Error");
    }
  });

  it("should wait for exit", async () => {
    const expectedResult = ActivityMock.createResult({ stdout: "Output", stderr: "Error" });
    activity.mockResults([expectedResult]);
    const exeScriptRequest = new Script([new Run("test_command")]).getExeScriptRequest();
    const streamOfActivityResults = await activity.execute(exeScriptRequest, true);
    const remoteProcess = new RemoteProcess(streamOfActivityResults);
    const finalResult = await remoteProcess.waitForExit();
    expect(finalResult.result).toEqual(ResultState.Ok);
  });
});
