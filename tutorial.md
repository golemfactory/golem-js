# New Task API

The new version of the Taks API introduces a simplified interface for executing commands in the Golem network.

### The basic algorithm is as follows:

1. Creating a Executor instance

    The executor can be created by passing appropriate initial parameters such as: ...
    One required parameter is image_hash.

   2. Execute one of the available executor methods: `run`, `map` or `foreach`.

       a) Method `run` - we use method run to execute one worker function, eg.
       ```js
           const result = await executor.run((ctx) => ctx.run("echo 'Hello World!'"));
       ```
   
       b) Method `map` - we use method map to get results for each element in iterable object, eg,
       ```js
           const data = [1, 2, 3, 4, 5];
           const results = executor.map(data, (ctx, item) => ctx.run(`echo "${item}"`));
           for await (const result of results) console.log(result);
       ```
       In results we get async iterable object, so we can iterate fo each element by `for await` function

3. Termination an executor instance

   Termination of contracts, payment processing, etc.

### Worker Function and Work Context API

    TODO
