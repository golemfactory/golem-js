this.addEventListener(
  "message",
  function (e) {
    switch (e.data) {
      case "start":
        this.postMessage("watek uruchomiony!");
        break;
      case "stop":
        this.postMessage("watek zatrzymany!");
        this.close();
        break;
      default:
        this.postMessage("nieznane polecenie!");
    }
  },
  false
);
