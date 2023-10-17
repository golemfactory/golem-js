let i = 0;

function timedCount() {
  i = i + 1;
  // eslint-disable-next-line no-undef
  postMessage(i);
  setTimeout(timedCount, 500);
}

timedCount();
