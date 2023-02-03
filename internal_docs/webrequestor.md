# Browser version - WebRequestor

## Requirements

To build a distribution for both the browser and node versions, the following tools are required:

| Tool | version | 
|------|---------|
| Node | >16.0.0 |
| NPM  | x.x     |
| Yarn | x.x     |

## Browsers supported

| Browser | version | 
|---------|---------|
| Chrome  | TODO    |
| Firefox | x.x     |
| Edge    | x.x     |

## Building

**Building using NPM**

`npm install` then
`npm run build:browser`

**Building using Yarn**

`yarn install` then
`yarn build:browser`

**The built version will be available in the folder** `examples/web/js/bundle.js`

## Usage
After build, you can attach the script in the head section, the library will be available globally under the `yajsapi` const. The use of SDK is the same as in the node version. However, file transfer using GFTP is currently not available.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>WebRequestor Example usage</title>
    <script src="/js/bundle.js"></script>
</head>
<body>
    <script>
        (async () => {
            // Accessing executor API
            const executor = await yajsapi.TaskExecutor.create({
                yagnaOptions: { apiKey, basePath },
                package: imageHash
                subnetTag: 'public'
            })
            // your scripts same way as for Node
        })();
    </script>
</body>
</html>
```
For more information on how to use the API, see our [tutorial](tutorial.md).

## Examples
We would like to encourage you to familiarize yourself with the example of using the webRequestor API, which you can find in the [/examples/web](/examples/web) folder

