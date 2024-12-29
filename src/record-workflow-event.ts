import { database as db } from './database';
import type { WorkflowMetadata } from './workflow';

type WorkflowMetadataKey = keyof WorkflowMetadata;
export type EventType = `update-${string}` | 'workflow-error';

const getEventCount = (id: string) => {
  const previousEventCount: number = db.get(`${id}/meta/event-count`) || 0;
  return previousEventCount + 1;
};

export const recordWorkflowChange = <K extends WorkflowMetadataKey>(
  id: string,
  key: K,
  value: WorkflowMetadata[K],
) => {
  const type = `update-${key}` as const;
  const workflow: WorkflowMetadata = db.get(id);

  if (!workflow) {
    throw new Error(`Workflow with ID ${id} not found.`);
  }

  const previous = workflow[key];
  const data = { previous, current: value };

  if (previous === value) return value;

  workflow[key] = value;

  return db.transaction(() => {
    const eventCount = getEventCount(id);

    db.put(`${id}/meta/event-count`, eventCount);
    db.put(`${id}/events/${eventCount}`, { type, ...data });
    db.put(id, workflow);

    return value;
  });
};

export const recordWorkflowEvent = (
  id: string,
  type: EventType,
  data: Record<string, unknown>,
) => {
  return db.transaction(() => {
    const eventCount = getEventCount(id);

    db.put(`${id}/meta/event-count`, eventCount);
    db.put(`${id}/events/${eventCount}`, { type, ...data });
  });
};
