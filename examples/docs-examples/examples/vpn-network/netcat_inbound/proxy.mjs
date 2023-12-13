import { WebSocket } from "ws";

import net from "net";

//import config from "./config.json" assert { type: "json" };

const PORT = 5555;
var ws_ready = false;
var ws = null;
var tcp = null;
var input_server = null;

async function runServer() {
  const server = new net.Server();
  input_server = server;
  server.listen(PORT, () => console.log(`Requestor starts listening on port: ${PORT}.`));

  server.on("connection", (socket) => {
    tcp = socket;

    socket.on("data", (chunk) => {
      if (ws_ready) {
        ws.send(chunk.toString());
      }
    });

    socket.on("end", () => {}); //console.log("Closing connection"));

    socket.on("error", (err) => console.log(`Error: "${err}"`));
  });
}

function runWs(neworkID, IP, PORT_TGT) {
  const VPN_NETWORK = neworkID;

  const URL = "ws://127.0.0.1:7465/net-api/v2/vpn/net/" + VPN_NETWORK + "/tcp/" + IP + "/" + "1234";

  //console.log(URL);

  try {
    ws = new WebSocket(
      URL, //);
      {
        headers: {
          ["Authorization"]: "Bearer try_golem",
        },
      },
    );
  } catch (err) {
    console.error("Error while opening ws connection to yagna", err);
  }

  ws.on("open", function open() {
    ws_ready = true;
  });

  ws.on("error", function (error) {
    console.log(error);
  });

  ws.on("message", function (data, flags) {
    tcp.write(data);
  });
}

function runProxy(networkID, IP, PORT_TGT) {
  runServer();
  runWs(networkID, IP, PORT_TGT);
}

function stopProxy() {
  input_server.close();
  ws.close();
}
export { runProxy, stopProxy };
