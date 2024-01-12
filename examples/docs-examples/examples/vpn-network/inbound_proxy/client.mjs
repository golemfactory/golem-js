fetch("http://127.0.0.1:5555")
  .then((response) => response.json())
  .then((data) => {
    console.log(data);
  });
