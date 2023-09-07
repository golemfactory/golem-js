const path = require("path");
const fs = require("fs");
const fetchTitle = /title: ["'](.*)["']/;

async function prepareDocAnchor(docsDir, type, file) {
  const filePath = path.join(docsDir, type, file);
  const fileContent = fs.readFileSync(filePath, "utf-8");
  const titleMatch = fetchTitle.exec(fileContent);

  let title = "";
  if (titleMatch) {
    title = titleMatch[1]
      .replace(` ${capitalizeFirstLetter(type)} `, " ")
      .replace(" - golem-js API Reference", "")
      .replace("Class ", "")
      .replace("Interface ", "")
      .replace("Module ", "")
      .replace("Enum ", "");
  }

  return {
    link: `${type}/${file.replace(".md", "")}`,
    title,
  };
}

function capitalizeFirstLetter(string) {
  return string[0].toUpperCase() + string.slice(1);
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
    for await (let file of files) {
      const doc = await prepareDocAnchor(docsDir, type, file);
      if (doc.title) logStream.write(`\n\t* [${doc.title}](${doc.link})`);
    }
  }

  logStream.end("");
  console.info("🪄 GitBook summary successfully generated");
})().catch((e) => {
  console.error(e.message);
});
