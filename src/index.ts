import { createWorkflow } from './create-workflow';

const workflow = createWorkflow(
  { name: 'add-and-double' },
  async (activity, a: number, b: number) => {
    function add(x: number, y: number) {
      return x + y;
    }

    const sum = activity(add);
    const double = activity((x: number) => x * 2);

    let result = await sum(a, b);

    result = await sum(result, 3);
    result = await double(result);

    return result;
  },
);

/**
 * We'll set a static run ID for this example in order to see that
 * we're caching the result of the workflow execution.
 */
workflow.setRunId('static-run-id');

/**
 * The first time we run the workflow, we should see the activity
 * executions in the console. The second time we run the workflow,
 * we should see that the activity executions are skipped.
 */
const result = await workflow(1, 2);

/**
 * The result should be 12.
 */
console.log(result);
