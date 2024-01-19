import * as golem from "https://unpkg.com/@golem-sdk/golem-js";

function appendResults(result) {
  const results = document.getElementById("results");
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(result));
  results.appendChild(div);
}

function appendLog(msg, level = "info") {
  const logs = document.getElementById("logs");
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(`[${new Date().toISOString()}] [${level}] ${msg}`));
  logs.appendChild(div);
}

const logger = {
  error: (msg) => appendLog(msg, "error"),
  info: (msg) => appendLog(msg, "info"),
  warn: (msg) => appendLog(msg, "warn"),
  debug: (msg) => appendLog(msg, "debug"),
  child: () => logger,
};

async function run() {
  const executor = await golem.TaskExecutor.create({
    package: "dcd99a5904bebf7ca655a833b73cc42b67fd40b4a111572e3d2007c3",
    yagnaOptions: { apiKey: "try_golem", basePath: document.getElementById("YAGNA_API_BASEPATH").value },
    subnetTag: document.getElementById("SUBNET_TAG").value,
    logger,
  });

  try {
    await executor.run(async (ctx) => appendResults((await ctx.run("echo 'Hello World'")).stdout));
  } catch (error) {
    logger.error("Computation failed:", error);
  } finally {
    await executor.end();
  }
}

document.getElementById("echo").onclick = run;
