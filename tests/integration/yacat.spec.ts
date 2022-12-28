import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { createExecutor } from "../../yajsapi";
import { LoggerMock } from "../mock";
import { Goth } from "./goth";
import { resolve } from "path";
chai.use(chaiAsPromised);
const expect = chai.expect;
const logger = new LoggerMock(false);
import path from "path";
import { fileExistsSync } from "tsconfig-paths/lib/filesystem";
import {extractTypedocConfigFromPackageManifest} from "typedoc/dist/lib/utils/package-manifest";

const range = (start: number, end: number, step = 1): number[] => {
    const list: number[] = [];
    for (let index = start; index < end; index += step) list.push(index);
    return list;
}

describe("Password cracking", function () {

  it("should crack password", async () => {
      const mask = "?a?a";
      const hash = '$P$5ZDzPE45CigTC6EY4cXbyJSLj/pGee0';
    const executor = await createExecutor({
      package: "055911c811e56da4d75ffc928361a78ed13077933ffa8320fb1ec2db",
        budget: 10,
      logger,
    });
      const keyspace = await executor.run<number>(async (ctx) => {
          const result = await ctx.run(`hashcat --keyspace -a 3 ${mask} -m 400`);
          return parseInt(result.stdout || "");
      });
      expect(keyspace).to.equal(95);
      if (!keyspace) return;
      const step = Math.floor(keyspace / 3);
      const ranges = range(0, keyspace, step);
      const results = executor.map(ranges, async (ctx, skip) => {
          console.log(`hashcat -a 3 -m 400 '${hash}' '${mask}' --skip=${skip} --limit=${skip! + step} -o pass.potfile`)
          const results = await ctx
              .beginBatch()
              .run(`hashcat -a 3 -m 400 '${hash}' '${mask}' --skip=${skip} --limit=${skip! + step} -o pass.potfile -D 1,2`)
              .run("cat pass.potfile")
              .end()
              .catch((err) => console.error(err));
          if (!results?.[1]?.stdout) return false;
          return results?.[1]?.stdout.split(":")[1];
      });
      let password = "";
      for await (const result of results) {
          if (result) {
              password = result;
              break;
          }
      }
      expect(password).to.equal('yo')
      await executor.end();
  }).timeout(180000);
});
