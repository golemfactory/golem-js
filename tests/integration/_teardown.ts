export default async function tearDownGoth() {
  await globalThis.__GOTH.end();
}
