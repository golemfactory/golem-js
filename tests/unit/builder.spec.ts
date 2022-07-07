import test from 'ava';
import { DemandBuilder } from "../../yajsapi/props/builder";

test('empty constraints', t => {
    const demand_builder = new DemandBuilder();
    const constraints: string = demand_builder.constraints();
    t.is(constraints, "(&)");
});

test('one constraint', t => {
    const demand_builder = new DemandBuilder();
    demand_builder.ensure("(a=b)");
    const constraints: string = demand_builder.constraints();
    t.is(constraints, "(a=b)");
});

test('two constraints', t => {
    const demand_builder = new DemandBuilder();
    demand_builder.ensure("(a.b=c)");
    demand_builder.ensure("(d.e=f)");
    const constraints: string = demand_builder.constraints();
    t.is(constraints, "(&(a.b=c)\n\t(d.e=f))");
});
