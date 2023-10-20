import express from "express";
import { GolemNetwork, Job, JobState } from "../../src";
import supertest from "supertest";
import fs from "fs";

const blenderParams = (frame) => ({
  scene_file: "/golem/resource/scene.blend",
  resolution: [400, 300],
  use_compositing: false,
  crops: [
    {
      outfilebasename: "out",
      borders_x: [0.0, 1.0],
      borders_y: [0.0, 1.0],
    },
  ],
  samples: 100,
  frames: [frame],
  output_format: "PNG",
  RESOURCES_DIR: "/golem/resources",
  WORK_DIR: "/golem/work",
  OUTPUT_DIR: "/golem/output",
});

describe("Express", function () {
  let network: GolemNetwork;
  beforeEach(async () => {
    network = new GolemNetwork({
      image: "golem/blender:latest",
      demand: {
        minMemGib: 1,
        minStorageGib: 1,
        minCpuThreads: 1,
        minCpuCores: 1,
      },
      beforeEachJob: async (workContext) => {
        await workContext.uploadFile(
          fs.realpathSync(__dirname + "/../mock/fixtures/cubes.blend"),
          "/golem/resource/scene.blend",
        );
      },
      enableLogging: true,
    });
    await network.init();
  });
  afterEach(async () => {
    await network.close();
  });

  const getServer = () => {
    const app = express();
    const port = 3001;
    app.use(express.json());
    app.listen(port);

    app.post("/render-scene", async (req, res) => {
      const frame = req.body.frame;

      if (typeof frame !== "number") {
        res.status(400).send("please specify which frame to render in the request body");
        return;
      }

      const job = await network.createJob(async (workContext) => {
        const fileName = `EXPRESS_SPEC_output_${frame}.png`;
        const result = await workContext
          .beginBatch()
          .uploadJson(blenderParams(frame), "/golem/work/params.json")
          .run("/golem/entrypoints/run-blender.sh")
          .downloadFile(`/golem/output/out${frame.toString().padStart(4, "0")}.png`, fileName)
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

    return app;
  };

  it(
    "starts the express server",
    async function () {
      const app = getServer();
      app.get("/network-status", (req, res) => {
        res.json({ isInitialized: network.isInitialized() });
      });

      const response = await supertest(app).post("/render-scene").send({ frame: 0 });
      expect(response.status).toEqual(200);
      expect(response.body.jobId).toBeDefined();

      const jobId = response.body.jobId;
      let statusResponse = await supertest(app).get(`/job/${jobId}/status`);
      expect(statusResponse.status).toEqual(200);
      expect(statusResponse.body.status).toEqual(JobState.New);

      await new Promise((resolve) => {
        const interval = setInterval(async () => {
          const statusResponse = await supertest(app).get(`/job/${jobId}/status`);
          if (statusResponse.body.status === JobState.Done) {
            clearInterval(interval);
            resolve(undefined);
          }
        }, 500);
      });

      statusResponse = await supertest(app).get(`/job/${jobId}/status`);
      expect(statusResponse.status).toEqual(200);
      expect(statusResponse.body.status).toEqual(JobState.Done);

      const resultResponse = await supertest(app).get(`/job/${jobId}/result`);
      expect(resultResponse.status).toEqual(200);
      expect(resultResponse.body).toEqual(
        "Job completed successfully! See your result at http://localhost:3001/results/EXPRESS_SPEC_output_0.png",
      );
      expect(fs.existsSync(`EXPRESS_SPEC_output_0.png`)).toEqual(true);
    },
    1000 * 240,
  );
});
