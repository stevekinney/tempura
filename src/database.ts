import { open } from 'lmdb';

export const database = open({
  path: './data',
  compression: true,
});
