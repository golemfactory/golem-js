import { ProviderInfo } from "../../agreement";
import { Result } from "../../activity";
import { RemoteProcess } from "../../task/process";
import { CommandOptions } from "../../task/work";
import { EventEmitter } from "eventemitter3";
import { GolemInstanceEvents } from "./types";

export interface GolemInstance {
  readonly provider: ProviderInfo;
  readonly events: EventEmitter<GolemInstanceEvents>;

  run(commandLine: string, options?: CommandOptions): Promise<Result>;

  /**
   * Execute an executable on provider.
   *
   * @param executable Executable to run.
   * @param args Executable arguments.
   * @param options Additional run options.
   */
  run(executable: string, args: string[], options?: CommandOptions): Promise<Result>;

  run(exeOrCmd: string, argsOrOptions?: string[] | CommandOptions, options?: CommandOptions): Promise<Result>;

  /**
   * Spawn an executable on provider and return {@link RemoteProcess} object
   * that contain stdout and stderr as Readable
   *
   * @param commandLine Shell command to execute.
   * @param options Additional run options.
   */
  spawn(commandLine: string, options?: Omit<CommandOptions, "capture">): Promise<RemoteProcess>;

  /**
   * @param executable Executable to run.
   * @param args Executable arguments.
   * @param options Additional run options.
   */
  spawn(executable: string, args: string[], options?: CommandOptions): Promise<RemoteProcess>;

  spawn(exeOrCmd: string, argsOrOptions?: string[] | CommandOptions, options?: CommandOptions): Promise<RemoteProcess>;

  /**
   * Generic transfer command, requires the user to provide a publicly readable transfer source
   *
   * @param from - publicly available resource for reading. Supported protocols: file, http, ftp or gftp
   * @param to - file path
   * @param options Additional run options.
   */
  transfer(from: string, to: string, options?: CommandOptions): Promise<Result>;

  uploadFile(src: string, dst: string, options?: CommandOptions): Promise<Result>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  uploadJson(json: any, dst: string, options?: CommandOptions): Promise<Result>;

  uploadData(data: Uint8Array, dst: string, options?: CommandOptions): Promise<Result>;

  downloadFile(src: string, dst: string, options?: CommandOptions): Promise<Result>;

  downloadData(src: string, options?: CommandOptions): Promise<Result<Uint8Array>>;

  downloadJson(src: string, options?: CommandOptions): Promise<Result>;

  /**
   * Destroy this instance.
   */
  destroy(): Promise<void>;
}
