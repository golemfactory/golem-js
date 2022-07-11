const ai_models_vm_repos = {
    gpt2: "d646d7b93083d817846c2ae5c62c72ca0507782385a2e29291a3d376",
    gpt3: "529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4",
    other: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
};

const active_models = new Map<string, Service>();

async function sendToModel(input: string, model: string): Promise<string> {
    if (!active_models.has(model)) {
        await deployModel(model);
    }
    const service = active_models.get(model)!;
    if ((await service.getState()) !== "Running") {
        await setupService(service);
    }
    await service.send("/golem/gpt2.sh", ["--input", input]);

    return new Promise((resolve, reject) => {
        service.on("data", (data) => resolve(data));
        service.on("error", (error) => reject(error));
    });
}

async function deployModel(model) {
    const service = new Service({
        image: ai_models_vm_repos[model],
        other_options: "todo",
        run: async (ctx) => await ctx.run("/golem/init_gpt2.sh"),
    });
    await service.start();
    active_models.set(model, service);
}

async function setupService(service) {
    // todo
}
