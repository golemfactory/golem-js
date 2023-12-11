const path = require("path");
const fs = require("fs");
const fetchTitle = /title: ["'](.*)["']/;

async function prepareDocAnchor(docsDir, type, file) {
  const filePath = path.join(docsDir, type, file);
  const fileContent = fs.readFileSync(filePath, "utf-8");

  if (fetchTitle.test(fileContent)) {
    const title = fetchTitle
      .exec(fileContent)[1]
      .replace(` ${type[0].toUpperCase() + type.slice(1)} `, " ")
      .replace(" - golem-js API Reference", "")
      .replace(/^(Class|Interface|Module|Enum)\s+/, "");

    return {
      link: `${type}/${file.replace(".md", "")}`,
      title,
    };
  }
}

(async () => {
  const docsDir = process.argv[2] || "docs";
  const directoryPath = path.join(__dirname, "..", docsDir);
  const logFilePath = path.join(process.argv[3] || docsDir, "overview.md");
  const logStream = fs.createWriteStream(logFilePath, { flags: "w" });

  const types = fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .filter((i) => i.isDirectory())
    .map((d) => d.name);

  logStream.write(`---
title: golem-js API reference overview
description: Dive into the content overview of the Golem-JS API reference.
type: JS API Reference
---
`);

  for (const type of types) {
    logStream.write(`\n* ${type[0].toUpperCase() + type.slice(1)}`);
    const files = fs.readdirSync(path.join(directoryPath, type), { withFileTypes: true }).map((f) => f.name);

    for (const file of files) {
      const doc = await prepareDocAnchor(docsDir, type, file);
      if (doc && doc.title) logStream.write(`\n\t* [${doc.title}](${doc.link})`);
    }
  }

  logStream.end();
  console.info("🪄 GitBook summary successfully generated");
})().catch((e) => {
  fs.appendFileSync("error.log", e.message + "\n");
});
