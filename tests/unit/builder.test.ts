import { expect } from "chai";
import { DemandBuilder } from "../../yajsapi/props";

describe("#DemandBuilder()", () => {
    it('empty constraints', done => {
        const demand_builder = new DemandBuilder();
        const constraints: string = demand_builder.constraints();
        expect(constraints).to.equal("(&)");
        done();
    });

    it('one constraint', done => {
        const demand_builder = new DemandBuilder();
        demand_builder.ensure("(a=b)");
        const constraints: string = demand_builder.constraints();
        expect(constraints).to.equal("(a=b)");
        done();
    });

    it('two constraints', done => {
        const demand_builder = new DemandBuilder();
        demand_builder.ensure("(a.b=c)");
        demand_builder.ensure("(d.e=f)");
        const constraints: string = demand_builder.constraints();
        expect(constraints).to.equal("(&(a.b=c)\n\t(d.e=f))");
        done();
    });
});