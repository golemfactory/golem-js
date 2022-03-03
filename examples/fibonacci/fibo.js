function fibo_loop(n) {
  let a = 1, b = 0, temp;
  while (n >= 0){
    temp = a;
    a = a + b;
    b = temp;
    n--;
  }
  return b;
}

function fibo_recur(n) {
  return n > 1 ? fibo_recur(n-1) + fibo_recur(n-2) : 1;
}

function fibo_memo(n, memo) {
  memo = memo || {};
  if (memo[n]) return memo[n];
  if (n <= 1) return 1;
  return memo[n] = fibo_memo(n - 1, memo) + fibo_memo(n - 2, memo);
}

function benchmark(fn, n, type) {
  const time_start = process.hrtime();
  const result = fn(n);
  const time_stop = process.hrtime(time_start);
  return { type, result, time: parseFloat(time_stop.join('.')) };
}

const n = process.argv[2] || 1;

const results = [
  benchmark(fibo_loop, n, 'loop'),
  benchmark(fibo_recur, n, 'recursion'),
  benchmark(fibo_memo, n, 'memoization')
].sort((a, b) => a.time - b.time);

console.table(results);
