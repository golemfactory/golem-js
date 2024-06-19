import { Activity, ActivityModule, ActivityStateEnum, Result } from "../";
import {
  Capture,
  Command,
  Deploy,
  DownloadData,
  DownloadFile,
  Run,
  Script,
  Start,
  Transfer,
  UploadData,
  UploadFile,
} from "../script";
import { NullStorageProvider, StorageProvider } from "../../shared/storage";
import { defaultLogger, Logger, sleep, YagnaOptions } from "../../shared/utils";
import { Batch } from "./batch";
import { NetworkNode } from "../../network";
import { RemoteProcess } from "./process";
import { GolemWorkError, WorkErrorCode } from "./error";
import { GolemConfigError, GolemTimeoutError } from "../../shared/error/golem-error";
import { Agreement, ProviderInfo } from "../../market/agreement";
import { TcpProxy } from "../../network/tcpProxy";
import { ExecutionOptions, ExeScriptExecutor } from "../exe-script-executor";

export type Worker<OutputType> = (ctx: WorkContext) => Promise<OutputType>;

const DEFAULTS = {
  activityPreparingTimeout: 300_000,
  activityStateCheckInterval: 1000,
};

export interface WorkOptions {
  activityPreparingTimeout?: number;
  activityStateCheckingInterval?: number;
  storageProvider?: StorageProvider;
  networkNode?: NetworkNode;
  logger?: Logger;
  activityReadySetupFunctions?: Worker<unknown>[];
  yagnaOptions?: YagnaOptions;
  execution?: ExecutionOptions;
}

export interface CommandOptions {
  timeout?: number;
  env?: object;
  capture?: Capture;
}

export interface ActivityDTO {
  provider: ProviderInfo;
  id: string;
  agreement: Agreement;
}

/**
 * Groups most common operations that the requestors might need to implement their workflows
 */
export class WorkContext {
  private readonly activityPreparingTimeout: number;
  private readonly activityStateCheckingInterval: number;

  public readonly provider: ProviderInfo;
  private readonly logger: Logger;
  private readonly storageProvider: StorageProvider;

  private readonly networkNode?: NetworkNode;

  private executor: ExeScriptExecutor;

  constructor(
    public readonly activity: Activity,
    public readonly activityModule: ActivityModule,
    private options?: WorkOptions,
  ) {
    this.activityPreparingTimeout = options?.activityPreparingTimeout || DEFAULTS.activityPreparingTimeout;
    this.activityStateCheckingInterval = options?.activityStateCheckingInterval || DEFAULTS.activityStateCheckInterval;

    this.logger = options?.logger ?? defaultLogger("work");
    this.provider = activity.provider;
    this.storageProvider = options?.storageProvider ?? new NullStorageProvider();

    this.networkNode = options?.networkNode;

    this.executor = this.activityModule.createScriptExecutor(this.activity, this.options?.execution);
  }

  private async fetchState(): Promise<ActivityStateEnum> {
    return this.activityModule
      .refreshActivity(this.activity)
      .then((activity) => activity.getState())
      .catch((err) => {
        this.logger.error("Failed to read activity state", err);
        throw new GolemWorkError(
          "Failed to read activity state",
          WorkErrorCode.ActivityStatusQueryFailed,
          this.activity.agreement,
          this.activity,
          err,
        );
      });
  }

  async before(): Promise<Result[] | void> {
    let state = await this.fetchState();
    if (state === ActivityStateEnum.Ready) {
      await this.setupActivity();
      return;
    }

    if (state === ActivityStateEnum.Initialized) {
      const result = await this.executor
        .execute(
          new Script([new Deploy(this.networkNode?.getNetworkConfig?.()), new Start()]).getExeScriptRequest(),
          undefined,
          this.activityPreparingTimeout,
        )
        .catch((e) => {
          throw new GolemWorkError(
            `Unable to deploy activity. ${e}`,
            WorkErrorCode.ActivityDeploymentFailed,
            this.activity.agreement,
            this.activity,
            this.activity.provider,
            e,
          );
        });

      let timeoutId: NodeJS.Timeout;

      await Promise.race([
        new Promise(
          (res, rej) =>
            (timeoutId = setTimeout(
              () => rej(new GolemTimeoutError("Preparing activity timeout")),
              this.activityPreparingTimeout,
            )),
        ),
        (async () => {
          for await (const res of result) {
            if (res.result === "Error")
              throw new GolemWorkError(
                `Preparing activity failed. Error: ${res.message}`,
                WorkErrorCode.ActivityDeploymentFailed,
                this.activity.agreement,
                this.activity,
                this.activity.provider,
              );
          }
        })(),
      ])
        .catch((error) => {
          if (error instanceof GolemWorkError) {
            throw error;
          }
          throw new GolemWorkError(
            `Preparing activity failed. Error: ${error.toString()}`,
            WorkErrorCode.ActivityDeploymentFailed,
            this.activity.agreement,
            this.activity,
            this.activity.provider,
            error,
          );
        })
        .finally(() => clearTimeout(timeoutId));
    }

    await sleep(this.activityStateCheckingInterval, true);

    state = await this.fetchState();

    if (state !== ActivityStateEnum.Ready) {
      throw new GolemWorkError(
        `Activity ${this.activity.id} cannot reach the Ready state. Current state: ${state}`,
        WorkErrorCode.ActivityDeploymentFailed,
        this.activity.agreement,
        this.activity,
        this.activity.provider,
      );
    }

    await this.setupActivity();
  }

  private async setupActivity() {
    if (!this.options?.activityReadySetupFunctions) {
      return;
    }
    for (const setupFunction of this.options.activityReadySetupFunctions) {
      await setupFunction(this);
    }
  }

  /**
   * Execute a command on provider using a shell (/bin/sh).
   *
   * @param commandLine Shell command to execute.
   * @param options Additional run options.
   */
  async run(commandLine: string, options?: CommandOptions): Promise<Result>;

  /**
   * Execute an executable on provider.
   *
   * @param executable Executable to run.
   * @param args Executable arguments.
   * @param options Additional run options.
   */
  async run(executable: string, args: string[], options?: CommandOptions): Promise<Result>;
  async run(exeOrCmd: string, argsOrOptions?: string[] | CommandOptions, options?: CommandOptions): Promise<Result> {
    const isArray = Array.isArray(argsOrOptions);

    this.logger.debug("Running command", {
      command: isArray ? `${exeOrCmd} ${argsOrOptions?.join(" ")}` : exeOrCmd,
      provider: this.provider.name,
    });

    const run = isArray
      ? new Run(exeOrCmd, argsOrOptions as string[], options?.env, options?.capture)
      : new Run("/bin/sh", ["-c", exeOrCmd], argsOrOptions?.env, argsOrOptions?.capture);
    const runOptions = isArray ? options : (argsOrOptions as CommandOptions);

    return this.runOneCommand(run, runOptions);
  }

  /**
   * Run an executable on provider and return {@link RemoteProcess} that will allow streaming
   *   that contain stdout and stderr as Readable
   *
   * @param commandLine Shell command to execute.
   * @param options Additional run options.
   */
  async runAndStream(commandLine: string, options?: Omit<CommandOptions, "capture">): Promise<RemoteProcess>;
  /**
   * @param executable Executable to run.
   * @param args Executable arguments.
   * @param options Additional run options.
   */
  async runAndStream(executable: string, args: string[], options?: CommandOptions): Promise<RemoteProcess>;
  async runAndStream(
    exeOrCmd: string,
    argsOrOptions?: string[] | CommandOptions,
    options?: CommandOptions,
  ): Promise<RemoteProcess> {
    const isArray = Array.isArray(argsOrOptions);
    const capture: Capture = {
      stdout: { stream: { format: "string" } },
      stderr: { stream: { format: "string" } },
    };
    const run = isArray
      ? new Run(exeOrCmd, argsOrOptions as string[], options?.env, capture)
      : new Run("/bin/sh", ["-c", exeOrCmd], argsOrOptions?.env, capture);
    const script = new Script([run]);
    // In this case, the script consists only of one run command,
    // so we skip the execution of script.before and script.after
    const streamOfActivityResults = await this.executor
      .execute(script.getExeScriptRequest(), true, options?.timeout)
      .catch((e) => {
        throw new GolemWorkError(
          `Script execution failed for command: ${JSON.stringify(run.toJson())}. ${
            e?.response?.data?.message || e?.message || e
          }`,
          WorkErrorCode.ScriptExecutionFailed,
          this.activity.agreement,
          this.activity,
          this.activity.provider,
          e,
        );
      });

    return new RemoteProcess(this.activityModule, streamOfActivityResults, this.activity, this.logger);
  }

  /**
   * Generic transfer command, requires the user to provide a publicly readable transfer source
   *
   * @param from - publicly available resource for reading. Supported protocols: file, http, ftp or gftp
   * @param to - file path
   * @param options Additional run options.
   */
  async transfer(from: string, to: string, options?: CommandOptions): Promise<Result> {
    this.logger.debug(`Transferring`, { from, to });
    return this.runOneCommand(new Transfer(from, to), options);
  }

  async uploadFile(src: string, dst: string, options?: CommandOptions): Promise<Result> {
    this.logger.debug(`Uploading file`, { src, dst });
    return this.runOneCommand(new UploadFile(this.storageProvider, src, dst), options);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  uploadJson(json: any, dst: string, options?: CommandOptions): Promise<Result> {
    this.logger.debug(`Uploading json`, { dst });
    const src = new TextEncoder().encode(JSON.stringify(json));
    return this.runOneCommand(new UploadData(this.storageProvider, src, dst), options);
  }

  uploadData(data: Uint8Array, dst: string, options?: CommandOptions): Promise<Result> {
    this.logger.debug(`Uploading data`, { dst });
    return this.runOneCommand(new UploadData(this.storageProvider, data, dst), options);
  }

  downloadFile(src: string, dst: string, options?: CommandOptions): Promise<Result> {
    this.logger.debug(`Downloading file from`, { src, dst });
    return this.runOneCommand(new DownloadFile(this.storageProvider, src, dst), options);
  }

  downloadData(src: string, options?: CommandOptions): Promise<Result<Uint8Array>> {
    this.logger.debug(`Downloading data`, { src });
    return this.runOneCommand(new DownloadData(this.storageProvider, src), options);
  }

  async downloadJson(src: string, options?: CommandOptions): Promise<Result> {
    this.logger.debug(`Downloading json`, { src });
    const result = await this.downloadData(src, options);
    if (result.result !== "Ok") {
      return new Result({
        ...result,
        data: undefined,
      });
    }

    return new Result({
      ...result,
      data: JSON.parse(new TextDecoder().decode(result.data)),
    });
  }

  beginBatch() {
    return new Batch(this.executor, this.storageProvider, this.logger);
  }

  /**
   * Provides a WebSocket URI that allows communicating with a remote process listening on the target port
   *
   * @param port The port number used by the service running within an activity on the provider
   */
  getWebsocketUri(port: number): string {
    if (!this.networkNode)
      throw new GolemWorkError(
        "There is no network in this work context",
        WorkErrorCode.NetworkSetupMissing,
        this.activity.agreement,
        this.activity,
        this.activity.provider,
      );

    return this.networkNode.getWebsocketUri(port);
  }

  getIp(): string {
    if (!this.networkNode)
      throw new GolemWorkError(
        "There is no network in this work context",
        WorkErrorCode.NetworkSetupMissing,
        this.activity.agreement,
        this.activity,
        this.activity.provider,
      );
    return this.networkNode.ip;
  }

  /**
   * Creates a new TCP proxy that will allow tunnelling the TPC traffic from the provider via the requestor
   *
   * @param portOnProvider The port that the service running on the provider is listening to
   */
  createTcpProxy(portOnProvider: number) {
    if (!this.options?.yagnaOptions?.apiKey) {
      throw new GolemConfigError("You need to provide yagna API key to use the TCP Proxy functionality");
    }

    return new TcpProxy(this.getWebsocketUri(portOnProvider), this.options.yagnaOptions.apiKey, {
      logger: this.logger,
    });
  }

  getDto(): ActivityDTO {
    return {
      provider: this.provider,
      id: this.activity.id,
      agreement: this.activity.agreement,
    };
  }

  private async runOneCommand<T>(command: Command<T>, options?: CommandOptions): Promise<Result<T>> {
    // Initialize script.
    const script = new Script([command]);
    await script.before().catch((e) => {
      throw new GolemWorkError(
        `Script initialization failed for command: ${JSON.stringify(command.toJson())}. ${
          e?.response?.data?.message || e?.message || e
        }`,
        WorkErrorCode.ScriptInitializationFailed,
        this.activity.agreement,
        this.activity,
        this.activity.provider,
        e,
      );
    });
    await sleep(100, true);

    // Send script.
    const results = await this.executor.execute(script.getExeScriptRequest(), false, options?.timeout);

    // Process result.
    let allResults: Result<T>[] = [];
    for await (const result of results) allResults.push(result);
    allResults = await script.after(allResults);

    // Handle errors.
    const commandsErrors = allResults.filter((res) => res.result === "Error");
    if (commandsErrors.length) {
      const errorMessage = commandsErrors
        .map(
          (err) =>
            `Error: ${err.message}. Stdout: ${err.stdout?.toString().trim()}. Stderr: ${err.stderr?.toString().trim()}`,
        )
        .join(". ");
      this.logger.warn(`Task error`, {
        provider: this.provider.name,
        error: errorMessage,
      });
    }

    return allResults[0];
  }
}
