import {
  Package,
  Accounts,
  Allocation,
  Demand,
  DemandEvent,
  DemandEventType,
  Proposal,
  Agreement,
  Activity,
  Result,
  Deploy,
  Run,
  Script,
  Start,
  ConsoleLogger,
  Payments,
  PaymentEventType,
  InvoiceEvent,
  DebitNoteEvent,
} from "yajsapi";
async function main() {
  const logger = new ConsoleLogger();
  const taskPackage = await Package.create({ imageHash: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae" });
  const accounts = await (await Accounts.create()).list();
  const account = accounts.find((account) => account?.platform.indexOf("erc20") !== -1);
  if (!account) throw new Error("There is no available account");
  const allocation = await Allocation.create({ account, logger });
  const demand = await Demand.create(taskPackage, [allocation], { logger });
  const offer: Proposal = await new Promise((res) =>
    demand.addEventListener(DemandEventType, async (event) => {
      const proposalEvent = event as DemandEvent;
      if (proposalEvent.proposal.isInitial())
        await proposalEvent.proposal.respond(account.platform).catch((e) => logger.error(e));
      else if (proposalEvent.proposal.isDraft()) res(proposalEvent.proposal);
    })
  );
  const payments = await Payments.create({ logger });
  const processPayment = (event) => {
    if (event instanceof InvoiceEvent && event.invoice.agreementId == agreement.id)
      event.invoice.accept(event.invoice.amount, allocation.id).catch((e) => logger.warn(e));
    if (event instanceof DebitNoteEvent)
      event.debitNote.accept(event.debitNote.totalAmountDue, allocation.id).catch((e) => logger.warn(e));
  };
  payments.addEventListener(PaymentEventType, processPayment);
  const agreement = await Agreement.create(offer.id, { logger });
  await agreement.confirm();
  const activity = await Activity.create(agreement.id, { logger, activityExecuteTimeout: 120_000 });
  const script = await Script.create([new Deploy(), new Start(), new Run("/bin/sh", ["-c", "echo 'Hello Golem'"])]);
  const exeScript = script.getExeScriptRequest();
  const streamResult = await activity.execute(exeScript);
  const results: Result[] = [];
  for await (const result of streamResult) results.push(result);
  console.log(results[2].stdout);
  await activity.stop();
  await agreement.terminate();
  await demand.unsubscribe();
  // waiting for payments...
  setTimeout(async () => {
    await allocation.release();
    await payments.unsubscribe();
    payments.removeEventListener(PaymentEventType, processPayment);
  }, 3000);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
