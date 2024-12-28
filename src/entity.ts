import { database } from './database';

/**
 * Base class for all entities.
 *
 * Do **not** instantiate this class directly.
 */
export abstract class Entity<Metadata extends Exclude<string, 'id' | 'hash'>> {
  abstract readonly id: string;
  abstract readonly hash: string;

  /**
   * Serializeable data about the entity.
   */
  abstract readonly metadata: { id: string; hash: string } & Record<
    Metadata,
    unknown
  >;

  get [Symbol.toStringTag](): string {
    return `${this.constructor.name}<${this.id}>`;
  }

  [Symbol.toPrimitive](
    hint: 'string' | 'number' | 'default',
  ): string | number | null {
    if (hint === 'string') return this.id;
    return null;
  }

  /**
   * Returns the type of the entity.
   */
  get type(): string {
    return this.constructor.name;
  }

  /**
   * Saves the entity to the database
   * and returns the entity itself.
   */
  async save(): Promise<this> {
    const { id, ...data } = this.metadata;
    database.put(id, data);
    return this;
  }

  /**
   * Loads the Entity from the database.
   */
  load(): this['metadata'] | undefined {
    const data: this['metadata'] = database.get(this.id);
    return data;
  }

  /**
   * Compares the hash of the entity with the given hash.
   * If no hash is provided, it compares the hash with the one
   * saved in the database.
   */
  compareHashes(hash?: string): true | never {
    if (hash) {
      if (hash === this.hash) {
        return true;
      } else {
        throw new Error(`Hash mismatch for ${this}: ${hash} !== ${this.hash}`);
      }
    }

    const data = this.load();
    if (!data || !data.hash) return true;
    return this.compareHashes(data.hash);
  }
}
