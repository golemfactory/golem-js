/* eslint-disable */

const http = require("http");

const config = require("./config.json");

const port = config.port;
const host = config.host;
const provider = config.server;

const reqHandler = function (req, res) {
  res.setHeader("Content-Type", "application/json");
  res.writeHead(200);
  const output = { message: "Hello Golem!", provider: provider };
  res.end(JSON.stringify(output));
};

async function go() {
  const server = http.createServer(reqHandler);

  server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
  });

  process.on("SIGINT", () => {
    console.log("Server stops: ", new Date());
    process.exit();
  });
}

go();
