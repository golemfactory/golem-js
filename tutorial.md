# New Task API

The new version of the Taks API introduces a simplified interface for executing commands in the Golem network.

## The basic algorithm is as follows:

### 1. Creating a Executor instance

The executor can be created by passing appropriate initial parameters such as: ...
One required parameter is image_hash.

### 2. Execute one of the available executor methods: `run`, `map` or `forEach`.

#### a) `run` method - we use method run to execute one worker function, eg.
```js
  const result = await executor.run((ctx) => ctx.run("echo 'Hello World!'"));
  console.log(result.stdout)
```

#### b) `map` - we use method map to get results for each element in iterable object, eg,
```js
  const data = [1, 2, 3, 4, 5];
  const results = executor.map(data, (ctx, item) => ctx.run(`echo "${item}"`));
  for await (const result of results) console.log(result.stdout);
```
In results we get async iterable object, so we can iterate for each element by `for await` statement.

#### c) `forEach` method - it is very similar to map, but it does not return any value, eg.
```js
  const data = [1, 2, 3, 4, 5];
  await executor.forEach(data, async (ctx, item) => {
      console.log((await ctx.run(`echo "${item}"`).stdout));
  });
```

### 3. Termination an executor instance

   Termination of contracts, payment processing, etc.

### Worker Function and Work Context API

Each of available method: `run`, `map` and `forEach` takes as a parameter `worker` function. Worker function is asynchronous and provide `Work Contect API` - `ctx`.

Wor Context allow to run single commands or batch of commands in provider.

Single commands available to run on provider:

   - `run()`
   - `uploadFile()`
   - `uploadJson()`
   - `downloadFile()`

We can also compose particular command into batch. To do this we should use `beginBatch`, eg.

```js
const res = await ctx
   .beginBatch()
   .run('echo "Hello Golem"')
   .run('echo "Hello World"')
   .uploadJson({ hello: 'Golem'}, '/golem.json')
   .end()
   .catch((error) => console.error(error));

res?.map(({ stdout }) => console.log(stdout));
```
We can end batch of command by `end()` as above and it means that this code return `Promise` of `Result` objects (or throw an error if occurred).

We can also end this batch by `endStream()` and then we get `Readable` stream, eg:

```js
const results = await ctx
   .beginBatch()
   .run('echo "Hello Golem"')
   .run('echo "Hello World"')
   .uploadJson({ hello: 'Golem'}, '/golem.json')
   .endStream();

 results.on("data", ({ stdout }) => console.log(stdout));
 results.on("error", (error) => console.error(error));
 results.on("close", () => console.log("END"));
```

### Additional executor method `beforeEach()` 

There is special method available in executor object, that allow to run a worker function once before each workers on provider per one activity. It's `beforeEach()` method.
These method takes as parameter one worker function and run it only once on every new activity on provider. Below example demonstrate usage of this method.

```js
  executor.beforeEach(async (ctx) => {
    await ctx.uploadFile("./params.txt", "/params.txt");
  });

  await executor.forEach([1, 2, 3, 4, 5], async (ctx, item) => {
     await ctx
       .beginBatch()
       .run(`/run_some_command.sh --input ${item}--params /input_params.txt --output /output.txt`)
       .downloadFile("/output.txt", "./output.txt")
       .end();
  });
```
