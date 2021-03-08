import test from 'ava';
import range from "../../yajsapi/utils/range";

test('get range', t => {
    const result: number[] = range(0, 5);
    t.deepEqual(result, [0, 1, 2, 3, 4]) 
})

test('get range with step', t => {
    const result: number[] = range(0, 5, 2);
    t.deepEqual(result, [0, 2, 4]) 
})
