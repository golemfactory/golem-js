import http from "http";
import fs from "fs";

const server = http.createServer((req, res) => {
  if (req.url === "/") {
    res.writeHead(200, { "content-type": "text/html" });
    fs.createReadStream("index.html").pipe(res);
  } else if (req.url === "/hello") {
    res.writeHead(200, { "content-type": "text/html" });
    fs.createReadStream("executor/hello.html").pipe(res);
  } else if (req.url === "/image") {
    res.writeHead(200, { "content-type": "text/html" });
    fs.createReadStream("executor/image.html").pipe(res);
  } else if (req.url === "/mid") {
    res.writeHead(200, { "content-type": "text/html" });
    fs.createReadStream("mid_level/index.html").pipe(res);
  } else if (req.url === "/yajsapi.min.js") {
    res.writeHead(200, { "content-type": "text/javascript" });
    fs.createReadStream("../../dist/yajsapi.min.js").pipe(res);
  } else if (req.url === "/css/main.css") {
    res.writeHead(200, { "content-type": "text/css" });
    fs.createReadStream("css/main.css").pipe(res);
  }
});

server.listen(3000, () => console.log(`Server listen at http://localhost:3000`));
