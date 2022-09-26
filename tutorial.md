# New Task API

The new version of the Taks API introduces a simplified interface for executing commands in the Golem network.

## The basic algorithm

### 1. Creating a Executor instance

The executor can be created by passing appropriate initial parameters such as package, budget, subnet tag, payment driver, payment network etc.
One required parameter is a package. This can be done in two ways. First by passing only package image hash, e.g.
```js
const executor = await createExecutor("9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae"); 
```
Or by passing some optional parameters, eg
```js
const executor = await createExecutor({
  subnet_tag,
  payment_driver,
  payment_network,
  package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
});
```

### 2. Executing one of the available executor methods: `run`, `map` or `forEach`.

#### a) `run` method - to execute one worker function, e.g.
```js
  const result = await executor.run((ctx) => ctx.run("echo 'Hello World!'"));
  console.log(result.stdout)
```

#### b) `map` - to get results for each element in iterable object, e.g.
```js
  const data = [1, 2, 3, 4, 5];
  const results = executor.map(data, (ctx, item) => ctx.run(`echo "${item}"`));
  for await (const result of results) console.log(result.stdout);
```
In results we get async iterable object, so we can iterate for each element by `for await` statement.

#### c) `forEach` method - it is very similar to map, but it does not return any value, e.g.
```js
  const data = [1, 2, 3, 4, 5];
  await executor.forEach(data, async (ctx, item) => {
      console.log((await ctx.run(`echo "${item}"`).stdout));
  });
```

### 3. Termination an executor instance

Termination of contracts, payment processing, etc.

```js
await executor.end();
```


### Worker Function and Work Context API

Each of available method: `run`, `map` and `forEach` takes as a parameter `worker` function. Worker function is asynchronous and provide `Work Contect API` - `ctx` object.

Work Context allow to run single commands or batch of commands on provider.

Single commands available to run on provider:

   - `run()`
   - `uploadFile()`
   - `uploadJson()`
   - `downloadFile()`

You can also compose particular commands into batches. For this, you should use `beginBatch`, e.g.

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
You can end batch of command by `end()` as above and it means that this code return `Promise` of `Result` objects (or throw an error if occurred).

You can also end this batch by `endStream()` to get a `Readable` stream, e.g.

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

There is a special method available in the executor object, that allows you to run the worker function once before each worker executes other tasks on the provider, but within the same activity. This is `beforeEach()` method.
This method takes as a parameter one worker function and runs it only once for each new provider activity. The following example demonstrates the use of this method.

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
