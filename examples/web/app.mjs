import http from "http";
import fs from "fs";

const server = http.createServer((req, res) => {
  if (req.url === "/") {
    res.writeHead(200, { "content-type": "text/html" });
    fs.createReadStream(new URL("./index.html", import.meta.url).pathname).pipe(res);
  } else if (req.url === "/hello") {
    res.writeHead(200, { "content-type": "text/html" });
    fs.createReadStream(new URL("executor/hello.html", import.meta.url).pathname).pipe(res);
  } else if (req.url === "/image") {
    res.writeHead(200, { "content-type": "text/html" });
    fs.createReadStream(new URL("executor/image.html", import.meta.url).pathname).pipe(res);
  } else if (req.url === "/mid") {
    res.writeHead(200, { "content-type": "text/html" });
    fs.createReadStream(new URL("mid_level/index.html", import.meta.url).pathname).pipe(res);
  } else if (req.url === "/yajsapi.min.js") {
    res.writeHead(200, { "content-type": "text/javascript" });
    fs.createReadStream(new URL("../../dist/yajsapi.min.js", import.meta.url).pathname).pipe(res);
  } else if (req.url === "/css/main.css") {
    res.writeHead(200, { "content-type": "text/css" });
    fs.createReadStream(new URL("css/main.css", import.meta.url).pathname).pipe(res);
  }
});

server.listen(3000, () => console.log(`Server listen at http://localhost:3000`));
