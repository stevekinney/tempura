import { Activity, type CreateActivityOptions } from './activity';
import { generateId, hash } from './utilities';
import { Entity } from './entity';
import { kebabCase } from 'change-case';

type WorkflowName = string;
type WorkflowId = `${string}/${string}`;
type WorkflowStatus = 'pending' | 'running' | 'completed' | 'failed';
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
> extends Entity<'name' | 'runId' | 'parameters' | 'result' | 'status'> {
  readonly hash: string;
  protected status: WorkflowStatus = 'pending';
  result?: R;

  static create<P extends Serializable[], R extends Serializable>({
    name,
    workflow,
    parameters,
    runId = generateId(),
  }: WorkflowExecutionOptions<P, R>) {
    return new WorkflowExecution<P, R>(
      kebabCase(name) as WorkflowName,
      workflow,
      parameters,
      runId,
    ).save();
  }

  private constructor(
    public readonly name: WorkflowExecutionOptions<P, R>['name'],
    private readonly workflow: WorkflowExecutionOptions<P, R>['workflow'],
    public readonly parameters: WorkflowExecutionOptions<P, R>['parameters'],
    public readonly runId: string,
  ) {
    super();

    this.hash = hash(name, this.runId, workflow.toString(), ...parameters);

    const data = this.load();

    if (data) {
      this.result = data.result;
      this.status = data.status;
    }
  }

  get id(): WorkflowId {
    return `${this.name}/${this.runId}`;
  }

  get code() {
    return this.workflow.toString();
  }

  get metadata() {
    const { id, hash, name, runId, parameters, result, status } = this;
    return { id, hash, name, runId, parameters, result, status };
  }

  #updateStatus(status: WorkflowStatus) {
    this.status = status;
    this.save();
  }

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
    this.#updateStatus('running');

    try {
      this.result = await this.workflow(
        this.createActivity,
        ...this.parameters,
      );
      this.#updateStatus('completed');
      return this.result;
    } catch (error) {
      this.#updateStatus('failed');
      throw error;
    }
  }
}
