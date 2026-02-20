import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';

const testSchema = z.object({
  title: z.string().min(1).max(100),
  price: z.number().int().min(0).optional(),
});

function createMockReqRes(body: any) {
  const req = { body } as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

describe('validate middleware', () => {
  it('유효한 body일 때 next()를 호출한다', () => {
    const { req, res, next } = createMockReqRes({ title: '테스트 상품' });
    validate(testSchema)(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('Zod 기본값을 적용하고 req.body를 파싱된 데이터로 교체한다', () => {
    const { req, res, next } = createMockReqRes({ title: '테스트' });
    validate(testSchema)(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.body.title).toBe('테스트');
  });

  it('무효한 body일 때 400을 반환한다', () => {
    const { req, res, next } = createMockReqRes({ title: '' });
    validate(testSchema)(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: '입력값이 올바르지 않습니다.' })
    );
  });

  it('필수 필드 누락 시 400을 반환한다', () => {
    const { req, res, next } = createMockReqRes({});
    validate(testSchema)(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
