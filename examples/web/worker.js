console.log("Please write two numbers separated by a comma");
postMessage("Please write two numbers separated by a comma");
onmessage = (e) => {
  console.log("Message received from main script");
  const a = Number(e.data[0]);
  const b = Number(e.data[1]);
  if (isNaN(a) || isNaN(b)) {
    postMessage("Invalid numbers");
  } else {
    console.log("Posting message back to main script");
    postMessage(`${a} + ${b} = ${a + b}`);
  }
};
