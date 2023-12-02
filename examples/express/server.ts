import express from "express";
import { GolemNetwork, Job, JobState } from "@golem-sdk/golem-js";
import { getBlenderParams } from "./blenderUtils";
import { fileURLToPath } from "url";
const __dirname = fileURLToPath(new URL(".", import.meta.url));

const app = express();
const port = 3001;
app.use(express.json());

// serve our result images on localhost:3001/results/
app.use("/results", express.static("public"));

const network = new GolemNetwork({
  // let's use one of ready-to-go images created by the Golem team
  // if you want to use your own image take a look at https://docs.golem.network/docs/creators/javascript/examples/tools/converting-docker-image-to-golem-format
  image: "golem/blender:latest",
  // let's make sure the provider has enough resources to render our scene
  demand: {
    minMemGib: 1,
    minStorageGib: 2,
    minCpuThreads: 1,
    minCpuCores: 1,
  },
  // upload the scene file before each job
  beforeEachJob: async (workContext) => {
    await workContext.uploadFile(`${__dirname}/cubes.blend`, "/golem/resource/scene.blend");
  },
  // if you want to see logs from the Golem node set this to true
  enableLogging: false,
  // by default Golem Network uses a simple in-memory storage for job statuses and results. In a real application you should use some persistent storage (e.g. a database)
  // jobStorage: MyAwesomeJobStorage()
});

network.init();
// network.init() happens asynchronously so let's create a middleware that will inform the user if the network is not ready yet
app.use((_req, res, next) => {
  if (!network.isInitialized()) {
    res.status(503).send("Golem Network is not ready yet, please try again later");
    return;
  }
  next();
});

app.post("/render-scene", async (req, res) => {
  const frame = req.body.frame;

  if (typeof frame !== "number") {
    res.status(400).send("please specify which frame to render in the request body");
    return;
  }

  const job = await network.createJob(async (workContext) => {
    const fileName = `output_${frame}.png`;
    const result = await workContext
      .beginBatch()
      .uploadJson(getBlenderParams(frame), "/golem/work/params.json")
      .run("/golem/entrypoints/run-blender.sh")
      .downloadFile(`/golem/output/out${frame.toString().padStart(4, "0")}.png`, `public/${fileName}`)
      .end();
    if (!result?.length) {
      throw new Error("Something went wrong, no result");
    }
    return fileName;
  });
  return res.json({ jobId: job.id });
});

app.get("/job/:jobId/status", async (req, res) => {
  const jobId = req.params.jobId;
  if (!jobId) {
    res.status(400).send("please specify jobId in the request path");
    return;
  }
  let job: Job<string>;
  let status: JobState;
  try {
    job = network.getJobById(jobId) as Job<string>;
    status = await job.fetchState();
  } catch (error) {
    res.status(404).send("job not found");
    return;
  }
  return res.json({ status });
});

app.get("/job/:jobId/result", async (req, res) => {
  const jobId = req.params.jobId;
  if (!jobId) {
    res.status(400).send("please specify jobId in the request path");
    return;
  }
  let job: Job<string>;
  let status: JobState;
  try {
    job = network.getJobById(jobId) as Job<string>;
    status = await job.fetchState();
  } catch (error) {
    res.status(404).send("job not found");
    return;
  }
  if ([JobState.New, JobState.Pending].includes(status)) {
    res.status(400).send("job is still running, check again later!");
    return;
  }
  if (status === JobState.Rejected) {
    res.status(400).send("job failed, check logs for more details");
    return;
  }

  const result = await job.fetchResults();
  return res.json("Job completed successfully! See your result at http://localhost:3001/results/" + result);
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});

process.on("SIGINT", async () => {
  await network.close();
  process.exit(0);
});

// Test your app in command line:
// curl -X POST -H "Content-Type: application/json" -d '{"frame": 0}' http://localhost:3001/render-scene
// curl -X GET http://localhost:3001/job/<jobId>/status
// curl -X GET http://localhost:3001/job/<jobId>/result
