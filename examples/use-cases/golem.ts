interface Golem {
  run(): Promise<stream.Readable>;
  acceptResult(taskId: string): void;
  getNetworkUri(): string;
}
