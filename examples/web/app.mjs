import http from "http";
import fs from "fs";
import { fileURLToPath } from "url";
const __dirname = fileURLToPath(new URL('.', import.meta.url));

const server = http.createServer((req, res) => {
  if (req.url === "/") {
    res.writeHead(200, { "content-type": "text/html" });
    fs.createReadStream(`${__dirname}/index.html`).pipe(res);
  } else if (req.url === "/hello") {
    res.writeHead(200, { "content-type": "text/html" });
    fs.createReadStream(`${__dirname}/executor/hello.html`).pipe(res);
  } else if (req.url === "/image") {
    res.writeHead(200, { "content-type": "text/html" });
    fs.createReadStream(`${__dirname}executor/image.html`).pipe(res);
  } else if (req.url === "/mid") {
    res.writeHead(200, { "content-type": "text/html" });
    fs.createReadStream(`${__dirname}/mid_level/index.html`).pipe(res);
  } else if (req.url === "/yajsapi.min.js") {
    res.writeHead(200, { "content-type": "text/javascript" });
    fs.createReadStream(`${__dirname}/../../dist/yajsapi.min.js`).pipe(res);
  } else if (req.url === "/css/main.css") {
    res.writeHead(200, { "content-type": "text/css" });
    fs.createReadStream(`${__dirname}/css/main.css`).pipe(res);
  }
});

server.listen(3000, () => console.log(`Server listen at http://localhost:3000`));
