import chalk from 'chalk';

import { Entity } from './entity';
import { createHash } from './utilities';

import type { Activity } from './activity';

export class ActivityExecution<
  P extends Serializable[],
  R extends Serializable,
> extends Entity<'activity' | 'parameters' | 'result'> {
  #result: R | undefined;

  static async execute<P extends Serializable[], R extends Serializable>(
    activity: Activity<P, R>,
    fn: ActivityFunction<P, R>,
    index: number,
    ...parameters: P
  ): Promise<R> {
    const execution = new ActivityExecution(activity, fn, index, parameters);
    return execution.execute();
  }

  private constructor(
    public readonly activity: Activity<P, R>,
    private readonly fn: (...parameters: P) => R,
    private readonly executionIndex: number,
    private readonly parameters: P,
  ) {
    super();
  }

  get id(): string {
    return `${this.activity.id}/${this.executionIndex}`;
  }

  get hash(): string {
    return createHash(...this.parameters);
  }

  get result(): R | undefined {
    return this.#result;
  }

  set result(result: R) {
    this.#result = result;
  }

  get metadata() {
    const { id, hash, activity, parameters, result } = this;
    return { id, hash, activity: activity.metadata, parameters, result };
  }

  /**
   * Returns whether the activity execution has been completed.
   */
  get completed(): boolean {
    return this.result !== undefined;
  }

  private async execute(): Promise<R> {
    const data = this.load();
    const id = chalk.magenta(this.id);

    if (data && data.result) {
      this.compareHashes(data.hash);

      console.log(chalk.green('Already completed'), id, {
        parameters: data.parameters,
        result: data.result,
      });

      this.result = data.result;
    } else {
      console.log(chalk.blue('Executing activity'), id, {
        parameters: this.parameters,
      });

      this.result = this.fn(...this.parameters);
      await this.save();
    }

    return this.result;
  }
}
