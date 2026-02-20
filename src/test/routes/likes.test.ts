import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { db } from '../../db';

const mockedDb = db as any;

describe('/api/likes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/likes/:productId', () => {
    it('찜하기 성공 시 201을 반환한다', async () => {
      // 1st select: 기존 찜 확인 → 없음
      const selectChain: any = {};
      selectChain.from = vi.fn().mockReturnValue(selectChain);
      selectChain.where = vi.fn().mockReturnValue(selectChain);
      selectChain.limit = vi.fn().mockResolvedValue([]);
      mockedDb.select.mockReturnValueOnce(selectChain);

      // insert: 찜 추가
      const insertChain: any = {};
      insertChain.values = vi.fn().mockResolvedValue(undefined);
      mockedDb.insert.mockReturnValueOnce(insertChain);

      const res = await request(app).post('/api/likes/1');

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('찜 완료');
    });

    it('이미 찜한 상품이면 409를 반환한다', async () => {
      // 기존 찜 존재
      const selectChain: any = {};
      selectChain.from = vi.fn().mockReturnValue(selectChain);
      selectChain.where = vi.fn().mockReturnValue(selectChain);
      selectChain.limit = vi.fn().mockResolvedValue([{ id: 1 }]);
      mockedDb.select.mockReturnValueOnce(selectChain);

      const res = await request(app).post('/api/likes/1');

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('이미 찜한 상품입니다.');
    });

    it('잘못된 productId이면 400을 반환한다', async () => {
      const res = await request(app).post('/api/likes/abc');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('올바른 상품 ID가 아닙니다.');
    });
  });

  describe('DELETE /api/likes/:productId', () => {
    it('찜 해제 성공 시 200을 반환한다', async () => {
      const deleteChain: any = {};
      deleteChain.where = vi.fn().mockResolvedValue(undefined);
      mockedDb.delete.mockReturnValueOnce(deleteChain);

      const res = await request(app).delete('/api/likes/1');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('찜 해제 완료');
    });
  });

  describe('GET /api/likes/check/:productId', () => {
    it('찜한 상품이면 { liked: true }를 반환한다', async () => {
      const selectChain: any = {};
      selectChain.from = vi.fn().mockReturnValue(selectChain);
      selectChain.where = vi.fn().mockReturnValue(selectChain);
      selectChain.limit = vi.fn().mockResolvedValue([{ id: 1 }]);
      mockedDb.select.mockReturnValueOnce(selectChain);

      const res = await request(app).get('/api/likes/check/1');

      expect(res.status).toBe(200);
      expect(res.body.liked).toBe(true);
    });

    it('찜하지 않은 상품이면 { liked: false }를 반환한다', async () => {
      const selectChain: any = {};
      selectChain.from = vi.fn().mockReturnValue(selectChain);
      selectChain.where = vi.fn().mockReturnValue(selectChain);
      selectChain.limit = vi.fn().mockResolvedValue([]);
      mockedDb.select.mockReturnValueOnce(selectChain);

      const res = await request(app).get('/api/likes/check/1');

      expect(res.status).toBe(200);
      expect(res.body.liked).toBe(false);
    });
  });
});
