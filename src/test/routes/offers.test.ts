import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { db } from '../../db';

const mockedDb = db as any;

describe('/api/offers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/offers', () => {
    it('유효한 가격 제안 시 201을 반환한다', async () => {
      const product = {
        id: 1, sellerId: 'seller-id', allowOffer: true, status: 'SALE', title: '아이폰',
      };
      const chatRoom = { id: 10, productId: 1, buyerId: 'test-user-id', sellerId: 'seller-id' };
      const message = { id: 100, chatRoomId: 10, type: 'PRICE_OFFER' };
      const offer = { id: 1, offerPrice: 40000, status: 'PENDING' };

      // 1st select: 상품 조회
      const productChain: any = {};
      productChain.from = vi.fn().mockReturnValue(productChain);
      productChain.where = vi.fn().mockReturnValue(productChain);
      productChain.limit = vi.fn().mockResolvedValue([product]);
      mockedDb.select.mockReturnValueOnce(productChain);

      // 2nd select: 기존 PENDING 제안 확인
      const pendingChain: any = {};
      pendingChain.from = vi.fn().mockReturnValue(pendingChain);
      pendingChain.where = vi.fn().mockReturnValue(pendingChain);
      pendingChain.limit = vi.fn().mockResolvedValue([]);
      mockedDb.select.mockReturnValueOnce(pendingChain);

      // 3rd select: 기존 채팅방 확인
      const chatChain: any = {};
      chatChain.from = vi.fn().mockReturnValue(chatChain);
      chatChain.where = vi.fn().mockReturnValue(chatChain);
      chatChain.limit = vi.fn().mockResolvedValue([chatRoom]);
      mockedDb.select.mockReturnValueOnce(chatChain);

      // 1st insert: 메시지
      const msgInsert: any = {};
      msgInsert.values = vi.fn().mockReturnValue(msgInsert);
      msgInsert.returning = vi.fn().mockResolvedValue([message]);
      mockedDb.insert.mockReturnValueOnce(msgInsert);

      // 2nd insert: priceOffers
      const offerInsert: any = {};
      offerInsert.values = vi.fn().mockReturnValue(offerInsert);
      offerInsert.returning = vi.fn().mockResolvedValue([offer]);
      mockedDb.insert.mockReturnValueOnce(offerInsert);

      // update: chatRoom lastMessage
      const updateChain: any = {};
      updateChain.set = vi.fn().mockReturnValue(updateChain);
      updateChain.where = vi.fn().mockResolvedValue(undefined);
      mockedDb.update.mockReturnValueOnce(updateChain);

      // 3rd insert: notification
      const notifInsert: any = {};
      notifInsert.values = vi.fn().mockResolvedValue(undefined);
      mockedDb.insert.mockReturnValueOnce(notifInsert);

      const res = await request(app)
        .post('/api/offers')
        .send({ productId: 1, offerPrice: 40000 });

      expect(res.status).toBe(201);
      expect(res.body.offer).toBeDefined();
      expect(res.body.chatRoomId).toBe(10);
    });

    it('본인 상품에 제안하면 400을 반환한다', async () => {
      const product = {
        id: 1, sellerId: 'test-user-id', allowOffer: true, status: 'SALE',
      };

      const productChain: any = {};
      productChain.from = vi.fn().mockReturnValue(productChain);
      productChain.where = vi.fn().mockReturnValue(productChain);
      productChain.limit = vi.fn().mockResolvedValue([product]);
      mockedDb.select.mockReturnValueOnce(productChain);

      const res = await request(app)
        .post('/api/offers')
        .send({ productId: 1, offerPrice: 40000 });

      expect(res.status).toBe(400);
    });

    it('존재하지 않는 상품이면 404를 반환한다', async () => {
      const productChain: any = {};
      productChain.from = vi.fn().mockReturnValue(productChain);
      productChain.where = vi.fn().mockReturnValue(productChain);
      productChain.limit = vi.fn().mockResolvedValue([]);
      mockedDb.select.mockReturnValueOnce(productChain);

      const res = await request(app)
        .post('/api/offers')
        .send({ productId: 999, offerPrice: 40000 });

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/offers/:id/accept', () => {
    it('판매자가 수락하면 200을 반환한다', async () => {
      const offer = {
        id: 1, sellerId: 'test-user-id', buyerId: 'buyer-id',
        chatRoomId: 10, offerPrice: 40000, status: 'PENDING',
      };
      const updatedOffer = { ...offer, status: 'ACCEPTED' };
      const message = { id: 101, type: 'PRICE_RESULT' };

      // select: offer 조회
      const offerChain: any = {};
      offerChain.from = vi.fn().mockReturnValue(offerChain);
      offerChain.where = vi.fn().mockReturnValue(offerChain);
      offerChain.limit = vi.fn().mockResolvedValue([offer]);
      mockedDb.select.mockReturnValueOnce(offerChain);

      // update: offer status
      const updateChain: any = {};
      updateChain.set = vi.fn().mockReturnValue(updateChain);
      updateChain.where = vi.fn().mockReturnValue(updateChain);
      updateChain.returning = vi.fn().mockResolvedValue([updatedOffer]);
      mockedDb.update.mockReturnValueOnce(updateChain);

      // insert: 결과 메시지
      const msgInsert: any = {};
      msgInsert.values = vi.fn().mockReturnValue(msgInsert);
      msgInsert.returning = vi.fn().mockResolvedValue([message]);
      mockedDb.insert.mockReturnValueOnce(msgInsert);

      // update: chatRoom lastMessage
      const chatUpdate: any = {};
      chatUpdate.set = vi.fn().mockReturnValue(chatUpdate);
      chatUpdate.where = vi.fn().mockResolvedValue(undefined);
      mockedDb.update.mockReturnValueOnce(chatUpdate);

      // select: seller nickname
      const sellerChain: any = {};
      sellerChain.from = vi.fn().mockReturnValue(sellerChain);
      sellerChain.where = vi.fn().mockReturnValue(sellerChain);
      sellerChain.limit = vi.fn().mockResolvedValue([{ nickname: '판매자' }]);
      mockedDb.select.mockReturnValueOnce(sellerChain);

      // insert: notification
      const notifInsert: any = {};
      notifInsert.values = vi.fn().mockResolvedValue(undefined);
      mockedDb.insert.mockReturnValueOnce(notifInsert);

      const res = await request(app).patch('/api/offers/1/accept');

      expect(res.status).toBe(200);
      expect(res.body.offer.status).toBe('ACCEPTED');
    });

    it('비판매자가 수락 시도하면 403을 반환한다', async () => {
      const offer = {
        id: 1, sellerId: 'other-seller', buyerId: 'buyer-id',
        chatRoomId: 10, status: 'PENDING',
      };

      const offerChain: any = {};
      offerChain.from = vi.fn().mockReturnValue(offerChain);
      offerChain.where = vi.fn().mockReturnValue(offerChain);
      offerChain.limit = vi.fn().mockResolvedValue([offer]);
      mockedDb.select.mockReturnValueOnce(offerChain);

      const res = await request(app).patch('/api/offers/1/accept');

      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/offers/:id/reject', () => {
    it('판매자가 거절하면 200을 반환한다', async () => {
      const offer = {
        id: 1, sellerId: 'test-user-id', buyerId: 'buyer-id',
        chatRoomId: 10, offerPrice: 40000, status: 'PENDING',
      };
      const updatedOffer = { ...offer, status: 'REJECTED' };
      const message = { id: 102, type: 'PRICE_RESULT' };

      const offerChain: any = {};
      offerChain.from = vi.fn().mockReturnValue(offerChain);
      offerChain.where = vi.fn().mockReturnValue(offerChain);
      offerChain.limit = vi.fn().mockResolvedValue([offer]);
      mockedDb.select.mockReturnValueOnce(offerChain);

      const updateChain: any = {};
      updateChain.set = vi.fn().mockReturnValue(updateChain);
      updateChain.where = vi.fn().mockReturnValue(updateChain);
      updateChain.returning = vi.fn().mockResolvedValue([updatedOffer]);
      mockedDb.update.mockReturnValueOnce(updateChain);

      const msgInsert: any = {};
      msgInsert.values = vi.fn().mockReturnValue(msgInsert);
      msgInsert.returning = vi.fn().mockResolvedValue([message]);
      mockedDb.insert.mockReturnValueOnce(msgInsert);

      const chatUpdate: any = {};
      chatUpdate.set = vi.fn().mockReturnValue(chatUpdate);
      chatUpdate.where = vi.fn().mockResolvedValue(undefined);
      mockedDb.update.mockReturnValueOnce(chatUpdate);

      // select: seller nickname
      const sellerChain2: any = {};
      sellerChain2.from = vi.fn().mockReturnValue(sellerChain2);
      sellerChain2.where = vi.fn().mockReturnValue(sellerChain2);
      sellerChain2.limit = vi.fn().mockResolvedValue([{ nickname: '판매자' }]);
      mockedDb.select.mockReturnValueOnce(sellerChain2);

      const notifInsert: any = {};
      notifInsert.values = vi.fn().mockResolvedValue(undefined);
      mockedDb.insert.mockReturnValueOnce(notifInsert);

      const res = await request(app).patch('/api/offers/1/reject');

      expect(res.status).toBe(200);
      expect(res.body.offer.status).toBe('REJECTED');
    });

    it('비판매자가 거절 시도하면 403을 반환한다', async () => {
      const offer = {
        id: 1, sellerId: 'other-seller', buyerId: 'buyer-id',
        chatRoomId: 10, status: 'PENDING',
      };

      const offerChain: any = {};
      offerChain.from = vi.fn().mockReturnValue(offerChain);
      offerChain.where = vi.fn().mockReturnValue(offerChain);
      offerChain.limit = vi.fn().mockResolvedValue([offer]);
      mockedDb.select.mockReturnValueOnce(offerChain);

      const res = await request(app).patch('/api/offers/1/reject');

      expect(res.status).toBe(403);
    });
  });
});
