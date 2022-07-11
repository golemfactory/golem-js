import { Activity, Run, Terminate, Script } from "./todo";

const ai_models_vm_repos = {
    gpt2: "d646d7b93083d817846c2ae5c62c72ca0507782385a2e29291a3d376",
    gpt3: "529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4",
    other: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
};

const active_models = new Map<string, Activity>();

async function sendToModel(input: string, model: string): Promise<string> {
    if (!active_models.has(model)) {
        await deployModel(model);
    }
    const activity = active_models.get(model)!;
    if ((await activity.getState()) !== "Ready") {
        await setupActivity(activity);
    }
    const exeCommand = new Run("/golem/gpt2.sh", ["--input", input]);
    const script = new Script([exeCommand]);
    const batchTxt = script.serialize();
    const results = await activity.execute(batchTxt);
    const { result, stdout, stderr } = await results.read();
    if (result === "Ok") return stdout;
    throw new Error(stderr);
}

async function deployModel(model) {
    const allocation = new Allocation();
    await allocation.send();
    const demand = new Demand(allocation, ai_models_vm_repos[model]);
    const market = new Market();
    const demandId = await market.sendDemnad(demand);
    const strategy = new Strategy("todo");
    const proposal = await market.findBestProposal(demandId, strategy);
    const agreement = new Agreement(proposal);
    const agreementId = await agreement.sign();
    const activity = new Activity(agreementId);
    await initModel(activity);
    active_models.set(model, activity);
}

async function initModel(activity) {
    const initCmd = new Run("/golem/init_gpt2.sh");
    const batch_txt = JSON.stringify([initCmd.toJson()]);
    await activity.execute(batch_txt);
}

async function setupActivity(activity) {
    const terminateBatchTxt = JSON.stringify([new Terminate().toJson()]);
    await activity.execute(terminateBatchTxt);
}
