interface TaskInfo {
  startTime: number;
  stopTime: number;
  agreements: Set<string>;
  activities: Set<string>;
  retriesCount: number;
  success: boolean;
  reason?: string;
}
interface AgreementInfo {
  activities: Set<string>;
  tasks: Set<string>;
}
interface ActivityInfo {
  agreement: string;
  task: string;
}

export class Tasks {
  tasks = new Map<string, TaskInfo>();
  agreements = new Map<string, AgreementInfo>();
  activities = new Map<string, ActivityInfo>();
  startTime?: number;
  stopTime?: number;

  addStartTime(timestamp: number) {
    this.startTime = timestamp;
  }

  addStopTime(timestamp: number) {
    this.stopTime = timestamp;
  }

  startTask(id: string, agreementId: string, activityId: string, timestamp: number) {
    this.storeTaskInfo(id, agreementId, activityId, timestamp);
    this.storeActivityInfo(id, agreementId, activityId);
    this.storeAgreementInfo(id, agreementId, activityId);
  }

  private storeActivityInfo(taskId: string, agreementId: string, activityId: string) {
    this.activities.set(activityId, { agreement: agreementId, task: taskId });
  }
  private storeAgreementInfo(taskId: string, agreementId: string, activityId: string) {
    const agreement = this.agreements.get(agreementId);
    if (!agreement) {
      this.agreements.set(agreementId, {
        activities: new Set([activityId]),
        tasks: new Set([taskId]),
      });
    } else {
      agreement.tasks.add(taskId);
      agreement.activities.add(activityId);
    }
  }

  private storeTaskInfo(id: string, agreementId: string, activityId: string, timestamp: number) {
    const task = this.tasks.get(id);
    if (!task) {
      this.tasks.set(id, {
        agreements: new Set<string>().add(agreementId),
        activities: new Set<string>().add(activityId),
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
    task && (task.stopTime = timestamp) && !(task.success = success) && (task.reason = reason);
  }

  retryTask(id, retriesCount) {
    const task = this.tasks.get(id);
    task && (task.retriesCount = retriesCount);
  }

  getComputedTasksCountAgreementId(agreementId: string): number {
    return [...this.tasks.values()].filter((task) => task.agreements.has(agreementId) && task.success).length;
  }

  getActivitiesByAgreementId(agreementId: string): string[] {
    const agreement = this.agreements.get(agreementId);
    if (!agreement) {
      return [];
    } else {
      return [...agreement.activities.values()];
    }
  }

  getTasksCountByAgreementId(agreementId: string): number {
    const agreement = this.agreements.get(agreementId);
    if (!agreement) {
      return 0;
    } else {
      return agreement.tasks.size;
    }
  }
  getAllTasks(): Array<TaskInfo> {
    return [...this.tasks.values()];
  }
}
