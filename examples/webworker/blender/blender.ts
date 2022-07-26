async function main() {
  const worker = new GolemWorker({
    package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
  });
  const gftp = new GftpProvider();
  await worker.register("blender.js");

  const gftp_url = await gftp.publish("./cubes.blend");
  worker.postMessage({ command: "download_file", args: gftp_url });
  const frames = range(0, 60, 10);
  for (const frame of frames) {
    worker.postMessage({ command: "setup", args: get_blender_params(frame) });
    worker.postMessage({ command: "render" });
  }
  let renderedFrameCount = 0;

  worker.onmessage(async (msg) => {
    if (msg.data?.result === "ok") {
      await gftp.receive(msg.data.url, `./output_${msg.data.file}`);
      renderedFrameCount++;
    } else {
      console.warn(msg.data);
    }
    if (renderedFrameCount === frames.lenfth) {
      console.log("All frames rendered");
      worker.terminate();
    }
  });
}
