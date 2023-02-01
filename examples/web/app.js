const http = require("http");
const fs = require("fs");

const server = http.createServer((req, res) => {
  if (req.url === "/") {
    res.writeHead(200, { "content-type": "text/html" });
    fs.createReadStream("index.html").pipe(res);
  } else if (req.url === "/js/bundle.js") {
    res.writeHead(200, { "content-type": "text/plain" });
    fs.createReadStream("./js/bundle.js").pipe(res);
  }
});

server.listen(3000, () => console.log(`Server listen at http://localhost:3000`));
