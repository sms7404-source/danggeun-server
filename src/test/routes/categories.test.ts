import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { db } from '../../db';

const mockedDb = db as any;

describe('GET /api/categories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('카테고리 목록을 200으로 반환한다', async () => {
    const categories = [
      { id: 1, name: '디지털기기', sortOrder: 1 },
      { id: 2, name: '생활가전', sortOrder: 2 },
    ];

    // db.select().from(categories).orderBy(...)
    const chain: any = {};
    chain.from = vi.fn().mockReturnValue(chain);
    chain.orderBy = vi.fn().mockResolvedValue(categories);
    mockedDb.select.mockReturnValueOnce(chain);

    const res = await request(app).get('/api/categories');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(categories);
    expect(res.body).toHaveLength(2);
  });

  it('DB 에러 시 500을 반환한다', async () => {
    const chain: any = {};
    chain.from = vi.fn().mockReturnValue(chain);
    chain.orderBy = vi.fn().mockRejectedValue(new Error('DB error'));
    mockedDb.select.mockReturnValueOnce(chain);

    const res = await request(app).get('/api/categories');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('카테고리 조회에 실패했습니다.');
  });
});
