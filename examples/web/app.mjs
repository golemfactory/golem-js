import http from "http";
import fs from "fs";
import { fileURLToPath } from "url";
const __dirname = fileURLToPath(new URL(".", import.meta.url));

const server = http.createServer((req, res) => {
  if (req.url === "/") {
    res.writeHead(200, { "content-type": "text/html" });
    fs.createReadStream(`${__dirname}/index.html`).pipe(res);
  } else if (req.url === "/hello") {
    res.writeHead(200, { "content-type": "text/html" });
    fs.createReadStream(`${__dirname}/hello.html`).pipe(res);
  } else if (req.url === "/image") {
    res.writeHead(200, { "content-type": "text/html" });
    fs.createReadStream(`${__dirname}/image.html`).pipe(res);
  } else if (req.url === "/docs-example-transfer-data") {
    res.writeHead(200, { "content-type": "text/html" });
    fs.createReadStream(`${__dirname}/../docs-examples/examples/transferring-data/transferDatainBrowser.html`).pipe(
      res,
    );
  } else if (req.url === "/docs-example-transfer-json") {
    res.writeHead(200, { "content-type": "text/html" });
    fs.createReadStream(`${__dirname}/../docs-examples/examples/transferring-data/uploadHSONinBrowser.html`).pipe(res);
  } else if (req.url === "/docs-tutorial") {
    res.writeHead(200, { "content-type": "text/html" });
    fs.createReadStream(`${__dirname}/../docs-examples/tutorials/running-from-browser/index.html`).pipe(res);
  } else if (req.url === "/docs-quickstart") {
    res.writeHead(200, { "content-type": "text/html" });
    fs.createReadStream(`${__dirname}/../docs-examples/quickstarts/web-quickstart/index.html`).pipe(res);
  } else if (req.url === "/requestor.mjs") {
    res.writeHead(200, { "content-type": "text/javascript" });
    fs.createReadStream(`${__dirname}/../docs-examples/quickstarts/web-quickstart/requestor.mjs`).pipe(res);
  } else if (req.url === "/golem-js.min.js") {
    res.writeHead(200, { "content-type": "text/javascript" });
    fs.createReadStream(`${__dirname}/../../dist/golem-js.min.js`).pipe(res);
  } else if (req.url === "/css/main.css") {
    res.writeHead(200, { "content-type": "text/css" });
    fs.createReadStream(`${__dirname}/css/main.css`).pipe(res);
  }
});

server.listen(3000, () => console.log(`Server listen at http://localhost:3000`));
