/* eslint-disable */
const http = require("http");

(async function main() {
  const PORT = parseInt(process.env["PORT"] ?? "80");

  // Increase the value if you want to test long response/liveliness scenarios
  const SIMULATE_DELAY_SEC = parseInt(process.env["SIMULATE_DELAY_SEC"] ?? "0");

  const respond = (res) => {
    res.writeHead(200);
    res.end("Hello Golem!");
  };

  const app = http.createServer((req, res) => {
    if (SIMULATE_DELAY_SEC > 0) {
      setTimeout(() => {
        respond(res);
      }, SIMULATE_DELAY_SEC * 1000);
    } else {
      respond(res);
    }
  });

  const server = app.listen(PORT, () => console.log(`HTTP server started at "http://localhost:${PORT}"`));

  const shutdown = () => {
    server.close((err) => {
      if (err) {
        console.error("Server close encountered an issue", err);
      } else {
        console.log("Server closed successfully");
      }
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
})();
