import anyTest, {Macro, TestInterface} from 'ava';
import Callable from "../../yajsapi/utils/callable";

const test = anyTest as TestInterface<Callable<[string], string>>;

const macro: Macro<[string], Callable<[string], string>> = (t, expected: string) => {
	t.is(t.context['foo']("bar"), expected);
};

test.beforeEach(t => {
    const foo: Callable<[string], string> = (str) => str;
	t.context['foo'] = foo;
});

test('callable interface returns string', macro, 'bar');
