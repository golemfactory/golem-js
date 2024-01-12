import { WebSocket } from "ws";

import net from "net";

const PORT = 5555;
var in_server = null;

var GnetworkID = null;
var GIP = null;
var GPORT_TGT = null;

async function runServer() {
  const server = new net.Server();
  in_server = server;
  server.listen(PORT, () => console.log(`Requestor starts listening on the localhost, port: ${PORT}.`));

  server.on("connection", (socket) => {
    let ws = null;
    ws = runWs(GnetworkID, GIP, GPORT_TGT, socket, () => {
      socket.on("data", async (chunk) => {
        ws.send(chunk.toString());
      });
    });
    socket.on("end", () => {
      ws.close();
    });

    socket.on("error", (err) => console.log(`Error: "${err}"`));
  });
}

function runWs(neworkID, IP, PORT_TGT, sckt, runsckt) {
  const VPN_NETWORK = neworkID;
  let ws = null;
  const URLv2 = "ws://127.0.0.1:7465/net-api/v2/vpn/net/" + VPN_NETWORK + "/tcp/" + IP + "/" + PORT_TGT;

  const URLv1 = "ws://127.0.0.1:7465/net-api/v1/net/" + VPN_NETWORK + "/tcp/" + IP + "/" + PORT_TGT;

  const URL = URLv1;

  try {
    ws = new WebSocket(URL, {
      headers: {
        ["Authorization"]: "Bearer try_golem",
      },
    });
  } catch (err) {
    console.error("Error while opening ws connection to yagna", err);
  }

  ws.on("open", function open() {
    runsckt();
  });

  ws.on("error", function (error) {
    console.log(error);
  });

  ws.on("close", () => {
    //
  });

  ws.on("message", async function (data) {
    if (sckt.readyState == "open") {
      sckt.write(data);
    } else {
      ws.close();
    }
  });

  return ws;
}

async function startProxy(networkID, IP, PORT_TGT) {
  GnetworkID = networkID;
  GIP = IP;
  GPORT_TGT = PORT_TGT;
  runServer();
}

function stopProxy() {
  in_server.close();
}

export { startProxy, stopProxy };
