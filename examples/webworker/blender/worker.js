const blender = require("blender-external-lib");

this.addEventListener("message", async function (e) {
  if (e.data?.command === "download_file") {
    await this.downloadFile(e.data?.args, "/golem/resource/scene.blend");
  } else if (e.data?.command === "setup") {
    this.writeFileSync("/golem/work/params.json", e.data.args, "utf8");
  } else if (e.data?.command === "render") {
    const output_file = await blender.render("/golem/resource/scene.blend", "/golem/work/params.json", "/golem/output");
    const url = await this.uploadFile(output_file);
    this.postMessage({ result: "ok", file: output_file, url });
  } else {
    this.postMessage("unknown command");
  }
});
