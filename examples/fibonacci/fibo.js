/* eslint-env node */

function fiboLoop(n) {
  let a = 1,
    b = 0;
  while (n >= 0) {
    [a, b] = [a + b, a];
    n--;
  }
  return b;
}

function fiboRecur(n) {
  return n > 1 ? fiboRecur(n - 1) + fiboRecur(n - 2) : 1;
}

function fiboMemo(n, memo) {
  memo = memo || {};
  if (memo[n]) return memo[n];
  if (n <= 1) return 1;
  return (memo[n] = fiboMemo(n - 1, memo) + fiboMemo(n - 2, memo));
}

function benchmark(fn, n, type) {
  const timeStart = process.hrtime();
  const result = fn(n);
  const timeSTop = process.hrtime(timeStart);
  return { type, result, time: parseFloat(timeSTop.join(".")) };
}

const n = process.argv[2] || 1;

const results = [
  benchmark(fiboLoop, n, "loop"),
  benchmark(fiboRecur, n, "recursion"),
  benchmark(fiboMemo, n, "memoization"),
].sort((a, b) => a.time - b.time);

console.table(results);
