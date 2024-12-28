import { ActivityExecution } from './activity-execution';
import { hash } from './utilities';
import { Entity } from './entity';

export type CreateActivityOptions = {
  name?: string;
};

export class Activity<
  P extends Serializable[],
  R extends Serializable,
> extends Entity<'name' | 'index' | 'workflowId'> {
  static index = 0;

  readonly index: string = String(Activity.index++);
  readonly hash: string;
  readonly id: string;

  #executionCount = 0;

  /**
   * Creates a new activity with the given function.
   * @param workflowId The ID of the workflow.
   * @param fn The function that represents the activity.
   * @param options The options to create the activity.
   */
  static create<P extends Serializable[], R extends Serializable>(
    workflowId: string,
    fn: ActivityFunction<P, R>,
    options: CreateActivityOptions = {},
  ): Activity<P, R> {
    return new Activity(workflowId, fn, options.name);
  }

  private constructor(
    public readonly workflowId: string,
    private readonly fn: (...parameters: P) => R,
    public readonly name: string = fn.name || 'Anonymous',
  ) {
    super();
    this.hash = hash(this.index, this.name, fn.toString());
    this.id = `${workflowId}/activities/${this.encodedHash}`;
  }

  /**
   * Returns the metadata of the activity.
   */
  get metadata() {
    const { id, name, index, hash, workflowId } = this;
    return { id, name, index, hash, workflowId };
  }

  get encodedHash(): string {
    return encodeURIComponent(this.hash);
  }

  /**
   * Executes the activity with the given parameters.
   */
  async execute(...parameters: P): Promise<R> {
    return ActivityExecution.execute(
      this,
      this.fn,
      this.#executionCount++,
      ...parameters,
    );
  }
}
