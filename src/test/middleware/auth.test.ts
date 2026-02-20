import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response, NextFunction } from 'express';
import { supabaseAdmin } from '../../utils/supabase';

// For auth test, we need the REAL requireAuth, not the mocked one
// So we unmock it and reimport
vi.unmock('../../middleware/auth');

// Import the real auth middleware
const { requireAuth } = await import('../../middleware/auth');

const mockedSupabase = vi.mocked(supabaseAdmin);

function createMockReqRes(authHeader?: string) {
  const req = {
    headers: authHeader ? { authorization: authHeader } : {},
    user: undefined,
  } as any;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

describe('requireAuth middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('유효한 Bearer 토큰으로 req.user를 설정하고 next()를 호출한다', async () => {
    mockedSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'user-123', email: 'test@test.com' } as any },
      error: null,
    });

    const { req, res, next } = createMockReqRes('Bearer valid-token');
    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ id: 'user-123', email: 'test@test.com' });
  });

  it('Authorization 헤더가 없으면 401을 반환한다', async () => {
    const { req, res, next } = createMockReqRes();
    await requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: '인증 토큰이 필요합니다.' })
    );
  });

  it('Bearer 접두사가 없으면 401을 반환한다', async () => {
    const { req, res, next } = createMockReqRes('InvalidToken abc');
    await requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('Supabase getUser가 에러를 반환하면 401을 반환한다', async () => {
    mockedSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: new Error('invalid token') as any,
    });

    const { req, res, next } = createMockReqRes('Bearer invalid-token');
    await requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: '유효하지 않은 토큰입니다.' })
    );
  });

  it('Supabase getUser가 null user를 반환하면 401을 반환한다', async () => {
    mockedSupabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const { req, res, next } = createMockReqRes('Bearer expired-token');
    await requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
