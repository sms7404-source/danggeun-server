import { vi } from 'vitest';

// ── Mock dotenv to prevent loading .env ──
vi.mock('dotenv/config', () => ({}));

// ── Mock the database module ──
vi.mock('../db', () => {
  const createChain = () => {
    const chain: any = {};
    const methods = ['select', 'insert', 'update', 'delete', 'from', 'where', 'set', 'values',
      'returning', 'limit', 'leftJoin', 'innerJoin', 'orderBy', 'groupBy'];
    for (const method of methods) {
      chain[method] = vi.fn().mockReturnValue(chain);
    }
    // Terminal methods return promises by default
    chain.limit.mockResolvedValue([]);
    chain.returning.mockResolvedValue([]);
    return chain;
  };

  const db = createChain();
  // Store the createChain function for test helpers
  (db as any)._createChain = createChain;
  return { db };
});

// ── Mock Supabase Admin SDK ──
vi.mock('../utils/supabase', () => ({
  supabaseAdmin: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: new Error('mocked'),
      }),
    },
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://test.com/img.jpg' } }),
      }),
    },
  },
}));

// ── Mock requireAuth middleware (default: pass through) ──
vi.mock('../middleware/auth', () => ({
  requireAuth: vi.fn((req: any, _res: any, next: any) => {
    req.user = { id: 'test-user-id', email: 'test@test.com' };
    next();
  }),
}));
