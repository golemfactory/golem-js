/* eslint-disable */
const net = require("net");

const server = net.createServer((socket) => {
  console.log("New connection from:", socket.remoteAddress);

  socket.on("data", (data) => {
    console.log(`Received message: ${data.toString()}`);
    socket.write(`Response from worker: ${data.toString()}`);
  });

  socket.on("end", () => {
    console.log("Connection ended");
  });

  socket.on("error", (err) => {
    console.error("Socket error:", err.message);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`TCP server is running and listening on port ${PORT}`);
});

server.on("error", (err) => {
  console.error("Server error:", err.message);
});
