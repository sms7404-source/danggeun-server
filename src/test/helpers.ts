import { vi } from 'vitest';
import { db } from '../db';

const mockedDb = db as any;

/**
 * Creates a fresh chainable mock for db.select()
 * Returns data when .limit() is called at the end of the chain
 */
export function mockSelectChain(resolvedData: any[]) {
  const chain: any = {};
  const methods = ['from', 'where', 'leftJoin', 'innerJoin', 'orderBy', 'groupBy'];
  for (const method of methods) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  chain.limit = vi.fn().mockResolvedValue(resolvedData);
  // Also make chain thenable for cases without .limit()
  chain.then = (resolve: Function) => resolve(resolvedData);
  mockedDb.select.mockReturnValueOnce(chain);
  return chain;
}

/**
 * Creates a fresh chainable mock for db.insert()
 */
export function mockInsertChain(resolvedData: any[]) {
  const chain: any = {};
  chain.values = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue(resolvedData);
  chain.then = (resolve: Function) => resolve(resolvedData);
  mockedDb.insert.mockReturnValueOnce(chain);
  return chain;
}

/**
 * Creates a fresh chainable mock for db.update()
 */
export function mockUpdateChain(resolvedData: any[]) {
  const chain: any = {};
  chain.set = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue(resolvedData);
  chain.then = (resolve: Function) => resolve(resolvedData);
  mockedDb.update.mockReturnValueOnce(chain);
  return chain;
}

/**
 * Creates a fresh chainable mock for db.delete()
 */
export function mockDeleteChain() {
  const chain: any = {};
  chain.where = vi.fn().mockResolvedValue(undefined);
  chain.then = (resolve: Function) => resolve(undefined);
  mockedDb.delete.mockReturnValueOnce(chain);
  return chain;
}

/**
 * Resets all db mock implementations
 */
export function resetDbMocks() {
  mockedDb.select.mockReset().mockReturnThis();
  mockedDb.insert.mockReset().mockReturnThis();
  mockedDb.update.mockReset().mockReturnThis();
  mockedDb.delete.mockReset().mockReturnThis();
}
