import { kebabCase } from 'change-case';

import { Activity, type CreateActivityOptions } from './activity';
import { generateId, createHash } from './utilities';
import { Entity } from './entity';
import { database } from './database';
import {
  recordWorkflowChange,
  recordWorkflowEvent,
  type EventType,
} from './record-workflow-event';

type WorkflowName = string;
type WorkflowId = `${string}/${string}`;
export type WorkflowStatus = 'pending' | 'running' | 'completed' | 'failed';
export type WorkflowMetadata<HasResult = false> = HasResult extends true
  ? Omit<WorkflowExecution['metadata'], 'result'> & {
      result: Exclude<WorkflowExecution['metadata']['result'], undefined>;
    }
  : WorkflowExecution['metadata'];

/**
 * The options to create a new workflow execution.
 * @template P The parameters of the workflow.
 * @template R The result of the workflow.
 * @param name The name of the workflow.
 * @param workflow The function that represents the workflow.
 * @param parameters The parameters of the workflow.
 */
interface WorkflowExecutionOptions<
  P extends Serializable[],
  R extends Serializable,
> {
  /** The name of the workflow. This should be kebab-cased. */
  name: WorkflowName;
  runId?: string;
  workflow: (
    activity: WorkflowExecution['createActivity'],
    ...parameters: P
  ) => Promise<R>;
  parameters: P;
}

/**
 * Represents a workflow execution.
 * @template P The parameters of the workflow.
 * @template R The result of the workflow.
 * @param name The name of the workflow. This should be kebab-cased.
 * @param runId The unique identifier of the workflow execution
 * @param workflow The function that represents the workflow.
 */
export class WorkflowExecution<
  P extends Serializable[] = Serializable[],
  R extends Serializable = Serializable,
> extends Entity<
  'name' | 'runId' | 'parameters' | 'result' | 'status' | 'eventCount'
> {
  result?: R;

  static async create<P extends Serializable[], R extends Serializable>({
    name,
    workflow,
    parameters,
    runId = generateId(),
  }: WorkflowExecutionOptions<P, R>) {
    const id: WorkflowId = `${name}/${runId}`;
    const hash = createHash(name, runId, workflow.toString(), ...parameters);
    name = kebabCase(name) as WorkflowName;

    await database.put(id, {
      name,
      workflow,
      parameters,
      runId,
      hash,
    });

    return new WorkflowExecution<P, R>(
      id,
      name,
      workflow,
      parameters,
      runId,
      hash,
    );
  }

  private constructor(
    public readonly id: WorkflowId,
    public readonly name: WorkflowExecutionOptions<P, R>['name'],
    private readonly workflow: WorkflowExecutionOptions<P, R>['workflow'],
    public readonly parameters: WorkflowExecutionOptions<P, R>['parameters'],
    public readonly runId: string,
    public readonly hash: string,
  ) {
    super();

    this.save().then(() => {
      const data = this.load();
      if (data) this.result = data.result;
    });
  }

  get code(): string {
    return this.workflow.toString();
  }

  get metadata() {
    const { id, hash, name, runId, parameters, result, status, eventCount } =
      this;
    return { id, hash, name, runId, parameters, result, status, eventCount };
  }

  get status(): WorkflowStatus {
    return this.get('status') || 'pending';
  }

  get eventCount() {
    return database.get(`${this.id}/meta/eventCount`) || 0;
  }

  get<K extends keyof WorkflowMetadata>(key: K): WorkflowMetadata[K] {
    const workflow = database.get(this.id) || {};
    return workflow[key];
  }

  private set<K extends keyof WorkflowMetadata>(
    key: K,
    value: WorkflowMetadata[K],
  ) {
    return recordWorkflowChange(this.id, key, value);
  }

  private recordEvent = <T extends EventType>(
    type: T,
    data: Record<string, unknown>,
  ) => {
    return recordWorkflowEvent(this.id, type, data);
  };

  /**
   * Utility function to indentify the activities in the workflow.
   * @param fn The function that represents the activity.
   * @param options The options to create the activity.
   */
  createActivity = <
    P extends Serializable[] = Serializable[],
    R extends Serializable = Serializable,
  >(
    fn: ActivityFunction<P, R>,
    options: CreateActivityOptions = {},
  ) => {
    const activity = Activity.create<P, R>(this.id, fn, options);
    return activity.execute.bind(activity);
  };

  async execute() {
    if (this.result) {
      await this.set('status', 'completed');
      return this.result;
    }

    await this.set('status', 'running');

    try {
      this.result = await this.workflow(
        this.createActivity,
        ...this.parameters,
      );

      this.set('status', 'completed');
      return this.result;
    } catch (error) {
      this.set('status', 'failed');

      if (error instanceof Error) {
        this.recordEvent('workflow-error', {
          hasMessage: true,
          message: error.message,
        });
      } else {
        this.recordEvent('workflow-error', {
          hasMessage: false,
          message: 'Unknown,',
        });
      }

      throw error;
    }
  }
}
