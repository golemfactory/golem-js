import { Script, Results } from "./script";

export function executeMock(script: Script) {
  const mockResults = ["OK"];
  return new Results({
    encoding: "utf8",
    async read() {
      console.log("Retrieving data from yagna...");
      await new Promise((res) => setTimeout(res, 2000));
      this.push(mockResults.pop() || null);
    },
  });
}

export class stateApi {
  states = ["Terminated", "Unresponsive", "Deployed", "Initialized", "Ready"];
  async getActivityState(id) {
    return { data: { state: [this.states.pop(), this.states.pop()] } };
  }
  async getActivityUsage() {}

  async getRunningCommand() {}
}
