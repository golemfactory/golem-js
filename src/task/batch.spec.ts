import { DownloadFile, Run, UploadData, UploadFile } from "../script";
import { Batch } from "./batch";
import { NullStorageProvider } from "../storage";
import { ActivityMock } from "../../tests/mock/activity.mock";
import { LoggerMock, YagnaMock } from "../../tests/mock";
import { Result } from "../activity";

describe("Batch", () => {
  let activity: ActivityMock;
  let batch: Batch;

  beforeEach(() => {
    activity = new ActivityMock("test_id", "test_id", new YagnaMock().getApi());
    batch = new Batch(activity, new NullStorageProvider(), new LoggerMock());
  });

  describe("Commands", () => {
    describe("run()", () => {
      it("should accept shell command", async () => {
        expect(batch.run("rm -rf")).toBe(batch);
        expect(batch["script"]["commands"][0]).toBeInstanceOf(Run);
        // TODO: check if constructed script is correct.
      });

      it("should accept executable", async () => {
        expect(batch.run("/bin/bash", ["-c", "echo Hello"])).toBe(batch);
        expect(batch["script"]["commands"][0]).toBeInstanceOf(Run);
      });
    });

    describe("uploadFile()", () => {
      it("should add upload file command", async () => {
        expect(batch.uploadFile("/tmp/file.txt", "/golem/file.txt")).toBe(batch);
        const cmd = batch["script"]["commands"][0] as UploadFile;
        expect(cmd).toBeInstanceOf(UploadFile);
        expect(cmd["src"]).toBe("/tmp/file.txt");
        expect(cmd["dstPath"]).toBe("/golem/file.txt");
      });
    });

    describe("uploadJson()", () => {
      it("should execute upload json command", async () => {
        const input = { hello: "world" };
        expect(batch.uploadJson(input, "/golem/file.txt")).toBe(batch);
        const cmd = batch["script"]["commands"][0] as UploadData;
        expect(cmd).toBeInstanceOf(UploadData);
        expect(JSON.parse(new TextDecoder().decode(cmd["src"]))).toEqual(input);
        expect(cmd["dstPath"]).toBe("/golem/file.txt");
      });
    });

    describe("uploadData()", () => {
      it("should execute upload json command", async () => {
        const input = "Hello World";
        expect(batch.uploadData(new TextEncoder().encode(input), "/golem/file.txt")).toBe(batch);
        const cmd = batch["script"]["commands"][0] as UploadData;
        expect(cmd).toBeInstanceOf(UploadData);
        expect(new TextDecoder().decode(cmd["src"])).toEqual(input);
        expect(cmd["dstPath"]).toBe("/golem/file.txt");
      });
    });

    describe("downloadFile()", () => {
      it("should execute download file command", async () => {
        expect(batch.downloadFile("/golem/file.txt", "/tmp/file.txt")).toBe(batch);
        const cmd = batch["script"]["commands"][0] as DownloadFile;
        expect(cmd).toBeInstanceOf(DownloadFile);
        expect(cmd["srcPath"]).toBe("/golem/file.txt");
        expect(cmd["dstPath"]).toBe("/tmp/file.txt");
      });
    });
  });

  describe("end()", () => {
    beforeEach(() => {
      batch.run("echo 'Hello World'").run("echo 'Hello World 2'");
    });

    it("should work", async () => {
      activity.mockResultCreate({ stdout: "Hello World" });
      activity.mockResultCreate({ stdout: "Hello World 2" });

      const results = await batch.end();

      expect(results.length).toBe(2);
      expect(results[0].stdout).toBe("Hello World");
      expect(results[1].stdout).toBe("Hello World 2");
    });

    it("should initialize script with script.before()", async () => {
      const spy = jest.spyOn(batch["script"], "before");

      await batch.end();

      expect(spy).toHaveBeenCalled();
    });

    it("should call script.after() on success", async () => {
      const spy = jest.spyOn(batch["script"], "after");

      await batch.end();

      expect(spy).toHaveBeenCalled();
    });

    it("should call script.after() on failure", async () => {
      const spy = jest.spyOn(batch["script"], "after");
      activity.mockResultFailure("FAILURE");

      await expect(batch.end()).rejects.toThrowError();

      expect(spy).toHaveBeenCalled();
    });

    it("should call script.after() on execute error", async () => {
      const spy = jest.spyOn(batch["script"], "after");
      jest.spyOn(activity, "execute").mockRejectedValue(new Error("ERROR"));

      await expect(batch.end()).rejects.toThrowError("ERROR");

      expect(spy).toHaveBeenCalled();
    });

    it("should throw error on result stream error", async () => {
      activity.mockResultFailure("FAILURE");
      await expect(batch.end()).rejects.toThrowError("FAILURE");
    });
  });

  describe("endStream()", () => {
    beforeEach(() => {
      batch.run("echo 'Hello World'").run("echo 'Hello World 2'");
    });

    it("should work", async () => {
      activity.mockResultCreate({ stdout: "Hello World" });
      activity.mockResultCreate({ stdout: "Hello World 2" });
      const results: Result[] = [];

      const stream = await batch.endStream();

      for await (const result of stream) {
        results.push(result);
      }

      expect(results.length).toBe(2);
      expect(results[0].stdout).toBe("Hello World");
      expect(results[1].stdout).toBe("Hello World 2");
    });

    it("should initialize script with script.before()", async () => {
      const spy = jest.spyOn(batch["script"], "before");

      await batch.endStream();

      expect(spy).toHaveBeenCalled();
    });

    it("should call script.after() on success", async () => {
      const spy = jest.spyOn(batch["script"], "after");

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const r of await batch.endStream()) {
        /* empty */
      }

      expect(spy).toHaveBeenCalled();
    });

    // FIXME: Not working due to bug: JST-252
    xit("should call script.after() on result stream error", async () => {
      const spy = jest.spyOn(batch["script"], "after");
      activity.mockResultFailure("FAILURE");

      const stream = await batch.endStream();
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const r of stream) {
          /* empty */
        }
        fail("Expected to throw");
      } catch (e) {
        /* empty */
      }

      expect(spy).toHaveBeenCalled();
    });

    it("should call script.after() on execute error", async () => {
      const spy = jest.spyOn(batch["script"], "after");
      jest.spyOn(activity, "execute").mockRejectedValue(new Error("ERROR"));

      await expect(async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const r of await batch.endStream()) {
          /* empty */
        }
      }).rejects.toThrowError("ERROR");

      expect(spy).toHaveBeenCalled();
    });
  });
});
