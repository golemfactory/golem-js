const path = require("path");
const fs = require("fs");

async function prepareDocAnchor(docsDir, type, file) {
  const filePath = path.join(docsDir, type, file);
  const fileContent = fs.readFileSync(filePath, "utf-8");
  const firstLine = (fileContent.match(/(^.*)/) || [])[1] || "";
  return {
    link: `${type}/${file.replace(".md", "")}`,
    title: firstLine.substring(firstLine.indexOf(":") + 2),
  };
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

(async () => {
  const docsDir = process.argv[2] || "docs";
  const directoryPath = path.join(__dirname, "..", docsDir);
  const logStream = fs.createWriteStream(path.join(process.argv[3] || docsDir, "overview.md"), { flags: "w" });

  const types = fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .filter((i) => i.isDirectory())
    .map((d) => d.name);

  for (let type of types) {
    logStream.write(`\n* ${capitalizeFirstLetter(type)}`);

    const files = fs.readdirSync(path.join(directoryPath, type), { withFileTypes: true }).map((f) => f.name);

    for (let file of files) {
      const doc = await prepareDocAnchor(docsDir, type, file);
      logStream.write(`\n\t* [${doc.title}](${doc.link})`);
    }
  }

  logStream.end("");
  console.info("🪄 GitBook summary successfully generated");
})().catch((e) => {
  console.error(e.message);
});
