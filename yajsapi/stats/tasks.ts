interface TaskInfo {
  startTime: number;
  stopTime: number;
  agreements: Set<string>;
  activities: Set<string>;
  retriesCount: number;
  success: boolean;
  reason?: string;
}

export class Tasks {
  tasks = new Map<string, TaskInfo>();
  startTime?: number;
  stopTime?: number;

  addStartTime(timestamp: number) {
    this.startTime = timestamp;
  }

  addStopTime(timestamp: number) {
    this.stopTime = timestamp;
  }

  startTask(id: string, agreementId: string, activityId: string, timestamp: number) {
    const task = this.tasks.get(id);
    if (!task) {
      this.tasks.set(id, {
        agreements: new Set<string>().add(agreementId),
        activities: new Set<string>().add(agreementId),
        retriesCount: 0,
        startTime: timestamp,
        stopTime: 0,
        success: false,
      });
    } else {
      task.agreements.add(agreementId);
      task.activities.add(activityId);
    }
  }

  stopTask(id: string, timestamp: number, success: boolean, reason?: string) {
    const task = this.tasks.get(id);
    task && (task.stopTime = timestamp) && (task.success = success) && (task.reason = reason);
  }

  retryTask(id, retriesCount) {
    const task = this.tasks.get(id);
    task && (task.retriesCount = retriesCount);
  }

  getComputedTasks(agreementId: string): number {
    return [...this.tasks.values()].filter((task) => task.agreements.has(agreementId) && task.success).length;
  }

  getActivities(agreementId: string): string[] {
    return [...this.tasks.values()]
      .filter((task) => task.agreements.has(agreementId))
      .flatMap((t) => [...t.activities]);
  }

  getAllTasks(agreementId: string): number {
    return [...this.tasks.values()].filter((task) => task.agreements.has(agreementId)).length;
  }
}
