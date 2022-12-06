import test from "ava";
import promisify from "../../yajsapi/utils/promisify";

test("promisify resolve given fn", async (t) => {
  function wantCb(param, cb) {
    setTimeout(() => {
      cb(param * param);
    }, 500);
  }

  const result = await promisify(wantCb)(21);
  t.is(result, 441);
});

test("promisify reject given fn", async (t) => {
  function wantCb(_param, _cb) {
    throw Error("i am an error");
  }

  const error = await t.throwsAsync(promisify(wantCb)(21));
  t.is(error!.message, "i am an error");
});
