import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { db } from '../../db';

const mockedDb = db as any;

describe('/api/products', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/products', () => {
    it('유효한 데이터로 상품 등록 시 201을 반환한다', async () => {
      const newProduct = { id: 1, title: '아이폰 14', price: 800000, sellerId: 'test-user-id' };

      // 1st select: 사용자의 regionId 가져오기
      const userChain: any = {};
      userChain.from = vi.fn().mockReturnValue(userChain);
      userChain.where = vi.fn().mockReturnValue(userChain);
      userChain.limit = vi.fn().mockResolvedValue([{ regionId: 1 }]);
      mockedDb.select.mockReturnValueOnce(userChain);

      // insert: 상품 추가
      const insertChain: any = {};
      insertChain.values = vi.fn().mockReturnValue(insertChain);
      insertChain.returning = vi.fn().mockResolvedValue([newProduct]);
      mockedDb.insert.mockReturnValueOnce(insertChain);

      const res = await request(app)
        .post('/api/products')
        .send({ title: '아이폰 14', price: 800000 });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('아이폰 14');
    });

    it('제목이 비어있으면 400을 반환한다', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({ title: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('입력값이 올바르지 않습니다.');
    });

    it('제목이 100자를 초과하면 400을 반환한다', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({ title: 'a'.repeat(101) });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/products/:id', () => {
    it('존재하는 상품을 200으로 반환한다', async () => {
      const product = {
        id: 1, title: '테스트', price: 10000, sellerId: 'seller-1',
        regionId: 1, viewCount: 5, status: 'SALE',
      };

      // 1st select: 상품 조회
      const productChain: any = {};
      productChain.from = vi.fn().mockReturnValue(productChain);
      productChain.where = vi.fn().mockReturnValue(productChain);
      productChain.limit = vi.fn().mockResolvedValue([product]);
      mockedDb.select.mockReturnValueOnce(productChain);

      // 2nd select: 이미지
      const imgChain: any = {};
      imgChain.from = vi.fn().mockReturnValue(imgChain);
      imgChain.where = vi.fn().mockReturnValue(imgChain);
      imgChain.orderBy = vi.fn().mockResolvedValue([]);
      mockedDb.select.mockReturnValueOnce(imgChain);

      // 3rd select: 판매자 정보
      const sellerChain: any = {};
      sellerChain.from = vi.fn().mockReturnValue(sellerChain);
      sellerChain.where = vi.fn().mockReturnValue(sellerChain);
      sellerChain.limit = vi.fn().mockResolvedValue([{ id: 'seller-1', nickname: '판매자' }]);
      mockedDb.select.mockReturnValueOnce(sellerChain);

      // 4th select: 지역 정보
      const regionChain: any = {};
      regionChain.from = vi.fn().mockReturnValue(regionChain);
      regionChain.where = vi.fn().mockReturnValue(regionChain);
      regionChain.limit = vi.fn().mockResolvedValue([{ name: '서초동' }]);
      mockedDb.select.mockReturnValueOnce(regionChain);

      // 5th select: 관심 수
      const likeChain: any = {};
      likeChain.from = vi.fn().mockReturnValue(likeChain);
      likeChain.where = vi.fn().mockResolvedValue([{ count: 3 }]);
      mockedDb.select.mockReturnValueOnce(likeChain);

      // update: 조회수 +1
      const updateChain: any = {};
      updateChain.set = vi.fn().mockReturnValue(updateChain);
      updateChain.where = vi.fn().mockResolvedValue(undefined);
      mockedDb.update.mockReturnValueOnce(updateChain);

      const res = await request(app).get('/api/products/1');

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('테스트');
      expect(res.body.viewCount).toBe(6);
      expect(res.body.regionName).toBe('서초동');
      expect(res.body.likeCount).toBe(3);
    });

    it('존재하지 않는 상품은 404를 반환한다', async () => {
      const chain: any = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue([]);
      mockedDb.select.mockReturnValueOnce(chain);

      const res = await request(app).get('/api/products/999');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('상품을 찾을 수 없습니다.');
    });

    it('잘못된 ID이면 400을 반환한다', async () => {
      const res = await request(app).get('/api/products/abc');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('올바른 상품 ID가 아닙니다.');
    });
  });

  describe('PUT /api/products/:id', () => {
    it('본인 상품 수정 시 200을 반환한다', async () => {
      const product = { id: 1, sellerId: 'test-user-id', title: '원래 제목' };
      const updated = { ...product, title: '수정된 제목' };

      // select: 상품 조회
      const selectChain: any = {};
      selectChain.from = vi.fn().mockReturnValue(selectChain);
      selectChain.where = vi.fn().mockReturnValue(selectChain);
      selectChain.limit = vi.fn().mockResolvedValue([product]);
      mockedDb.select.mockReturnValueOnce(selectChain);

      // update: 상품 수정
      const updateChain: any = {};
      updateChain.set = vi.fn().mockReturnValue(updateChain);
      updateChain.where = vi.fn().mockReturnValue(updateChain);
      updateChain.returning = vi.fn().mockResolvedValue([updated]);
      mockedDb.update.mockReturnValueOnce(updateChain);

      const res = await request(app)
        .put('/api/products/1')
        .send({ title: '수정된 제목' });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('수정된 제목');
    });

    it('타인 상품 수정 시 403을 반환한다', async () => {
      const product = { id: 1, sellerId: 'other-user-id', title: '타인 상품' };

      const selectChain: any = {};
      selectChain.from = vi.fn().mockReturnValue(selectChain);
      selectChain.where = vi.fn().mockReturnValue(selectChain);
      selectChain.limit = vi.fn().mockResolvedValue([product]);
      mockedDb.select.mockReturnValueOnce(selectChain);

      const res = await request(app)
        .put('/api/products/1')
        .send({ title: '수정 시도' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('본인의 상품만 수정할 수 있습니다.');
    });
  });

  describe('DELETE /api/products/:id', () => {
    it('본인 상품 삭제 시 200을 반환한다', async () => {
      const product = { id: 1, sellerId: 'test-user-id' };

      const selectChain: any = {};
      selectChain.from = vi.fn().mockReturnValue(selectChain);
      selectChain.where = vi.fn().mockReturnValue(selectChain);
      selectChain.limit = vi.fn().mockResolvedValue([product]);
      mockedDb.select.mockReturnValueOnce(selectChain);

      const deleteChain: any = {};
      deleteChain.where = vi.fn().mockResolvedValue(undefined);
      mockedDb.delete.mockReturnValueOnce(deleteChain);

      const res = await request(app).delete('/api/products/1');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('상품이 삭제되었습니다.');
    });

    it('타인 상품 삭제 시 403을 반환한다', async () => {
      const product = { id: 1, sellerId: 'other-user-id' };

      const selectChain: any = {};
      selectChain.from = vi.fn().mockReturnValue(selectChain);
      selectChain.where = vi.fn().mockReturnValue(selectChain);
      selectChain.limit = vi.fn().mockResolvedValue([product]);
      mockedDb.select.mockReturnValueOnce(selectChain);

      const res = await request(app).delete('/api/products/1');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('본인의 상품만 삭제할 수 있습니다.');
    });
  });

  describe('PATCH /api/products/:id/status', () => {
    it('유효한 상태값으로 변경 시 200을 반환한다', async () => {
      const product = { id: 1, sellerId: 'test-user-id', status: 'SALE' };
      const updated = { ...product, status: 'RESERVED' };

      const selectChain: any = {};
      selectChain.from = vi.fn().mockReturnValue(selectChain);
      selectChain.where = vi.fn().mockReturnValue(selectChain);
      selectChain.limit = vi.fn().mockResolvedValue([product]);
      mockedDb.select.mockReturnValueOnce(selectChain);

      const updateChain: any = {};
      updateChain.set = vi.fn().mockReturnValue(updateChain);
      updateChain.where = vi.fn().mockReturnValue(updateChain);
      updateChain.returning = vi.fn().mockResolvedValue([updated]);
      mockedDb.update.mockReturnValueOnce(updateChain);

      const res = await request(app)
        .patch('/api/products/1/status')
        .send({ status: 'RESERVED' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('RESERVED');
    });

    it('무효한 상태값이면 400을 반환한다', async () => {
      const res = await request(app)
        .patch('/api/products/1/status')
        .send({ status: 'INVALID' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('올바른 상태값이 아닙니다.');
    });
  });

  describe('PATCH /api/products/:id/bump', () => {
    it('3일 경과 시 끌올 성공', async () => {
      const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
      const product = { id: 1, sellerId: 'test-user-id', bumpedAt: fourDaysAgo, createdAt: fourDaysAgo };

      const selectChain: any = {};
      selectChain.from = vi.fn().mockReturnValue(selectChain);
      selectChain.where = vi.fn().mockReturnValue(selectChain);
      selectChain.limit = vi.fn().mockResolvedValue([product]);
      mockedDb.select.mockReturnValueOnce(selectChain);

      const updated = { ...product, bumpedAt: new Date().toISOString() };
      const updateChain: any = {};
      updateChain.set = vi.fn().mockReturnValue(updateChain);
      updateChain.where = vi.fn().mockReturnValue(updateChain);
      updateChain.returning = vi.fn().mockResolvedValue([updated]);
      mockedDb.update.mockReturnValueOnce(updateChain);

      const res = await request(app).patch('/api/products/1/bump');

      expect(res.status).toBe(200);
    });

    it('3일 미경과 시 400을 반환한다', async () => {
      const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
      const product = { id: 1, sellerId: 'test-user-id', bumpedAt: oneHourAgo, createdAt: oneHourAgo };

      const selectChain: any = {};
      selectChain.from = vi.fn().mockReturnValue(selectChain);
      selectChain.where = vi.fn().mockReturnValue(selectChain);
      selectChain.limit = vi.fn().mockResolvedValue([product]);
      mockedDb.select.mockReturnValueOnce(selectChain);

      const res = await request(app).patch('/api/products/1/bump');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('끌어올리기는 3일에 한 번만 가능합니다.');
    });
  });
});
