import express from "express";
import { GolemNetwork, JobState } from "../../src/experimental";
import supertest from "supertest";
import fs from "fs";
import { jest } from "@jest/globals";

describe("Express", function () {
  let golemClient: GolemNetwork;
  const consoleSpy = jest.fn();
  beforeEach(async () => {
    golemClient = new GolemNetwork({});
    await golemClient.init();
    consoleSpy.mockReset();
  });
  afterEach(async () => {
    await golemClient.close();
  });

  const getServer = () => {
    const app = express();
    const port = 3000;

    app.use(express.text());

    app.post("/tts", async (req, res) => {
      if (!req.body) {
        res.status(400).send("Missing text parameter");
        return;
      }
      const job = golemClient.createJob({
        package: {
          imageTag: "severyn/espeak:latest",
        },
      });

      job.events.on("created", () => {
        consoleSpy("Job created");
      });
      job.events.on("started", () => {
        consoleSpy("Job started");
      });
      job.events.on("error", () => {
        consoleSpy("Job failed", job.error);
      });
      job.events.on("success", () => {
        consoleSpy("Job succeeded", job.results);
      });

      job.startWork(async (ctx) => {
        const fileName = `EXPRESS_SPEC_OUTPUT.wav`;
        await ctx
          .beginBatch()
          .run(`espeak "${req.body}" -w /golem/output/output.wav`)
          .downloadFile("/golem/output/output.wav", fileName)
          .end();
        return fileName;
      });
      res.send(job.id);
    });

    app.get("/tts/:id", async (req, res) => {
      const job = golemClient.getJobById(req.params.id);
      if (!job) {
        res.status(404).send("Job not found");
        return;
      }
      res.send(job.state);
    });

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

    return app;
  };

  it(
    "starts the express server",
    async function () {
      const app = getServer();

      const response = await supertest(app).post("/tts").send("Hello Golem!").set("Content-Type", "text/plain");
      expect(response.status).toEqual(200);
      expect(response.text).toMatch(/^[a-f0-9-]{36}$/i);

      const jobId = response.text;

      let statusResponse = await supertest(app).get(`/tts/${jobId}`).set("Content-Type", "text/plain");
      expect(statusResponse.status).toEqual(200);
      expect(statusResponse.text === JobState.New || statusResponse.text === JobState.Pending).toBeTruthy();

      await new Promise((resolve, reject) => {
        const interval = setInterval(async () => {
          const statusResponse = await supertest(app).get(`/tts/${jobId}`).set("Content-Type", "text/plain");
          if (statusResponse.text === JobState.Done) {
            clearInterval(interval);
            resolve(undefined);
          }
          if (statusResponse.text === JobState.Rejected) {
            clearInterval(interval);
            reject(new Error("Job rejected"));
          }
        }, 500);
      });

      statusResponse = await supertest(app).get(`/tts/${jobId}`).set("Content-Type", "text/plain");
      expect(statusResponse.status).toEqual(200);
      expect(statusResponse.text).toEqual(JobState.Done);

      const resultResponse = await supertest(app).get(`/tts/${jobId}/results`).set("Content-Type", "text/plain");
      expect(resultResponse.status).toEqual(200);
      expect(resultResponse.text).toEqual(
        "Job completed successfully! Open the following link in your browser to listen to the result: http://localhost:3000/results/EXPRESS_SPEC_OUTPUT.wav",
      );
      expect(fs.existsSync(`EXPRESS_SPEC_OUTPUT.wav`)).toEqual(true);
      expect(consoleSpy).toHaveBeenNthCalledWith(1, "Job created");
      expect(consoleSpy).toHaveBeenNthCalledWith(2, "Job started");
      expect(consoleSpy).toHaveBeenNthCalledWith(3, "Job succeeded", "EXPRESS_SPEC_OUTPUT.wav");
      expect(consoleSpy).toHaveBeenCalledTimes(3);
    },
    1000 * 240,
  );
});
