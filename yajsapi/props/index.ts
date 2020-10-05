import { Field, Model } from "./base";
import { DemandBuilder } from "./builder";

export { DemandBuilder, Model };

export class Identification extends Model {
  name: Field = new Field({ metadata: { key: "golem.node.id.name" } });
  subnet_tag: Field = new Field({
    metadata: { key: "golem.node.debug.subnet" },
  });

  constructor(subnet_tag: string = "testnet", name?: string) {
    super();
    this.subnet_tag.value = subnet_tag;
    if(name) {
      this.name.value = name;
    }
  }
}

export const IdentificationKeys: any = new Identification().keys().get();

export class Activity extends Model {
  /*Activity-related Properties*/

  cost_cap: Field = new Field({ metadata: { key: "golem.activity.cost_cap" } });
  /*Sets a Hard cap on total cost of the Activity (regardless of the usage vector or
    pricing function). The Provider is entitled to 'kill' an Activity which exceeds the
    capped cost amount indicated by Requestor.
    */

  cost_warning: Field = new Field({
    metadata: { key: "golem.activity.cost_warning" },
  });
  /*Sets a Soft cap on total cost of the Activity (regardless of the usage vector or
    pricing function). When the cost_warning amount is reached for the Activity,
    the Provider is expected to send a Debit Note to the Requestor, indicating
    the current amount due
    */

  timeout_secs: Field = new Field({
    metadata: { key: "golem.activity.timeout_secs" },
  });
  /*A timeout value for batch computation (eg. used for container-based batch
    processes). This property allows to set the timeout to be applied by the Provider
    when running a batch computation: the Requestor expects the Activity to take
    no longer than the specified timeout value - which implies that
    eg. the golem.usage.duration_sec counter shall not exceed the specified
    timeout value.
    */

  expiration: Field = new Field({
    metadata: { key: "golem.srv.comp.expiration" },
  });
}

export const ActivityKeys = new Activity().keys().get();
