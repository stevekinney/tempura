import crypto from 'node:crypto';
import { v4 as uuid } from 'uuid';

export function generateId(): string {
  return uuid();
}

export function hash(...data: unknown[]): string {
  return crypto.createHash('sha1').update(data.join('-')).digest('base64');
}
