this.addEventListener("message", function (e) {
  if (e.data === "start") {
    // todo
    this.postMessage("script started");
  } else if (e.data === "stop") {
    // todo
    this.postMessage("script stopped");
    this.close();
  } else if (e.data?.action) {
    // todo run[e.data.action](a.data?.args)
  } else {
    this.postMessage("unknown command");
  }
});
