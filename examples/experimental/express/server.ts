import express from "express";
import { JobManager, JobState } from "@golem-sdk/golem-js/experimental";

const app = express();
const port = 3000;

app.use(express.text());

const golemClient = new JobManager();

await golemClient
  .init()
  .then(() => {
    console.log("Connected to the Golem Network!");
  })
  .catch((error) => {
    console.error("Failed to connect to the Golem Network:", error);
    process.exit(1);
  });

app.post("/tts", async (req, res) => {
  if (!req.body) {
    res.status(400).send("Missing text parameter");
    return;
  }
  const job = golemClient.createJob({
    demand: {
      activity: {
        imageTag: "severyn/espeak:latest",
      },
    },
    market: {
      rentHours: 0.5,
      pricing: {
        model: "linear",
        maxStartPrice: 1,
        maxCpuPerHourPrice: 1,
        maxEnvPerHourPrice: 1,
      },
    },
  });

  job.events.on("created", () => {
    console.log("Job created");
  });
  job.events.on("started", () => {
    console.log("Job started");
  });
  job.events.on("error", () => {
    console.log("Job failed", job.error);
  });
  job.events.on("success", () => {
    console.log("Job succeeded", job.results);
  });

  job.startWork(async (ctx) => {
    const fileName = `${Math.random().toString(36).slice(2)}.wav`;
    await ctx
      .beginBatch()
      .run(`espeak "${req.body}" -w /golem/output/output.wav`)
      .downloadFile("/golem/output/output.wav", `public/${fileName}`)
      .end();
    return fileName;
  });
  res.send(`Job started! ID: ${job.id}`);
});

app.get("/tts/:id", async (req, res) => {
  const job = golemClient.getJobById(req.params.id);
  if (!job) {
    res.status(404).send("Job not found");
    return;
  }
  res.send("Job's state is: " + job.state);
});

// serve files in the /public directory
app.use("/results", express.static("public"));

app.get("/tts/:id/results", async (req, res) => {
  const job = golemClient.getJobById(req.params.id);
  if (!job) {
    res.status(404).send("Job not found");
    return;
  }
  if (job.state !== JobState.Done) {
    await job.waitForResult();
  }

  const results = await job.results;
  res.send(
    `Job completed successfully! Open the following link in your browser to listen to the result: http://localhost:${port}/results/${results}`,
  );
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});

process.on("SIGINT", async () => {
  // cancel and cleanup all running jobs
  await golemClient.close();
  process.exit(0);
});

/*
Test your app in the command line:

1. Create a new job:
curl \
    --header "Content-Type: text/plain" \
    --request POST \
    --data "Hello Golem" \
    http://localhost:3000/tts

2. Check the job's state:
curl http://localhost:3000/tts/<job_id>

3. Check the job's results:
curl http://localhost:3000/tts/<job_id>/results
*/
