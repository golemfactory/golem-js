// eslint-disable-next-line no-undef
addEventListener("message", (e) => {
  console.log("Worker: Message received from main script");
  // eslint-disable-next-line no-undef
  postMessage(JSON.stringify(e));
  const result = e.data[0] * e.data[1];
  if (isNaN(result)) {
    // eslint-disable-next-line no-undef
    postMessage("Please write two numbers");
  } else {
    const workerResult = "Result: " + result;
    console.log("Worker: Posting message back to main script");
    // eslint-disable-next-line no-undef
    postMessage(workerResult);
  }
});
