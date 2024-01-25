/* eslint-disable */

const http = require("http");

const config = require("./config.json");

const port = config.port;
const host = config.host;
const provider = config.server;
/*
const port = 8000;
const host = "0.0.0.0";
const provider = "local";
*/
const reqHandler = function (req, res) {
  //console.log("rawHeaders", req.rawHeaders);
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

  await new Promise((res) => setTimeout(res, 120 * 1000));
  console.log("Server stops: ", new Date());
  process.exit(0);
}

go();
