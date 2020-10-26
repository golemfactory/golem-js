import path from "path";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Engine, Task, utils, sgx, WorkContext } from "yajsapi";

dayjs.extend(duration);

const { asyncWith, range } = utils;

async function main() {
  const _package = await sgx.demand(
    sgx.SgxEngine.WASI,
    "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
    0.5,
    2.0
  );

  async function* worker(ctx: WorkContext, tasks) {
    ctx.send_file(
      path.join(__dirname, "./input.txt"),
      "/golem/resource/input.txt"
    );
    for await (let task of tasks) {
      let data = task.data();
      ctx.begin();
      ctx.send_json("/golem/work/params.json", {
        input_file: "/golem/resource/input.txt",
        RESOURCES_DIR: "/golem/resources",
        WORK_DIR: "/golem/work",
        OUTPUT_DIR: "/golem/output",
      });
      ctx.run("/golem/entrypoints/run.sh");
      ctx.download_file(
        `/golem/output/out${data.toString().padStart(4, "0")}.png`,
        path.join(__dirname, `./output_${data}.png`)
      );
      yield ctx.commit();
      // TODO: Check
      // job results are valid // and reject by:
      // task.reject_task(msg = 'invalid file')
      task.accept_task();
    }

    ctx.log("task completed");
    return;
  }

  const frames: number[] = range(0, 60, 10);
  const timeout: number = dayjs.duration({ minutes: 15 }).asMilliseconds();

  await asyncWith(
    await new Engine(
      _package,
      6,
      timeout, //5 min to 30 min
      "10.0",
      undefined,
      "devnet-alpha.2"
    ),
    async (engine: Engine): Promise<void> => {
      for await (let progress of engine.map(
        worker,
        frames.map((frame) => new Task(frame))
      )) {
        console.log("progress=", progress);
      }
    }
  );
  return;
}

main();
