import { kebabCase } from 'change-case';
import { generateId } from './utilities';
import { WorkflowExecution, type WorkflowMetadata } from './workflow';

/**
 * The metadata to create a new workflow.
 */
type CreateWorkflowMetadata = {
  /** The name of the workflow. This should be kebab-cased. */
  name: string;
};

/**
 * Creates a new workflow with the given metadata and function.
 * @param metadata The metadata to create a new workflow.
 * @param workflow The function that represents the workflow.
 * @returns A function to run the workflow.
 */
export function createWorkflow<
  P extends Serializable[],
  R extends Serializable,
>(
  metadata: CreateWorkflowMetadata,
  workflow: (
    activity: WorkflowExecution['createActivity'],
    ...parameters: P
  ) => Promise<R>,
) {
  let runId = generateId();
  const name = kebabCase(metadata.name);

  /**
   * Runs the workflow with the given parameters.
   * @returns The result of the workflow.
   * @param parameters The parameters of the workflow.
   * @returns The result of the workflow.
   */
  async function execution(...parameters: P) {
    const workflowExecution = await WorkflowExecution.create({
      name,
      workflow,
      parameters,
      runId,
    });

    return workflowExecution.execute();
  }

  /**
   * Runs the workflow with the given parameters and result.
   * @returns The metadata of the workflow execution—including the result.
   */
  execution.withMetadata = async (
    ...parameters: P
  ): Promise<WorkflowMetadata<true>> => {
    const workflowExecution = await WorkflowExecution.create({
      name,
      workflow,
      parameters,
      runId,
    });

    await execution(...parameters);

    if (workflowExecution.result === undefined) {
      throw new Error('The workflow did not return a result.');
    }

    return workflowExecution.metadata as unknown as WorkflowMetadata<true>;
  };

  /**
   * Sets a custom run ID for the workflow.
   * @param id The run ID of the workflow.
   */
  execution.setRunId = (id: string) => {
    runId = kebabCase(id);
    return execution;
  };

  return execution;
}
