import { Router, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { priceOffers, products, chatRooms, messages, notifications, users } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

// POST /api/offers — 가격 제안 생성
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const buyerId = req.user!.id;
    const { productId, offerPrice } = req.body;

    // 기본 검증
    if (!productId || !offerPrice || offerPrice <= 0) {
      res.status(400).json({ error: '상품 ID와 유효한 제안 가격이 필요합니다.' });
      return;
    }

    // 상품 조회
    const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!product) {
      res.status(404).json({ error: '상품을 찾을 수 없습니다.' });
      return;
    }

    // 본인 상품 불가
    if (product.sellerId === buyerId) {
      res.status(400).json({ error: '본인 상품에는 가격 제안을 할 수 없습니다.' });
      return;
    }

    // 판매중인 상품만
    if (product.status !== 'SALE') {
      res.status(400).json({ error: '판매중인 상품에만 가격 제안을 할 수 있습니다.' });
      return;
    }

    // 가격 제안 허용 확인
    if (!product.allowOffer) {
      res.status(400).json({ error: '이 상품은 가격 제안을 받지 않습니다.' });
      return;
    }

    // 기존 PENDING 제안 중복 체크
    const [existingOffer] = await db.select().from(priceOffers)
      .where(and(
        eq(priceOffers.productId, productId),
        eq(priceOffers.buyerId, buyerId),
        eq(priceOffers.status, 'PENDING'),
      ))
      .limit(1);

    if (existingOffer) {
      res.status(400).json({ error: '이미 대기 중인 가격 제안이 있습니다.' });
      return;
    }

    // 채팅방 생성 또는 조회
    let [chatRoom] = await db.select().from(chatRooms)
      .where(and(eq(chatRooms.productId, productId), eq(chatRooms.buyerId, buyerId)))
      .limit(1);

    if (!chatRoom) {
      [chatRoom] = await db.insert(chatRooms).values({
        productId,
        buyerId,
        sellerId: product.sellerId,
      }).returning();
    }

    // 구매자 정보 조회 (알림 메시지용)
    const [buyer] = await db.select({ nickname: users.nickname }).from(users).where(eq(users.id, buyerId)).limit(1);

    // 가격 제안 메시지 삽입
    const messageContent = JSON.stringify({ offerPrice, type: 'PRICE_OFFER' });
    const [newMessage] = await db.insert(messages).values({
      chatRoomId: chatRoom.id,
      senderId: buyerId,
      content: messageContent,
      type: 'PRICE_OFFER',
    }).returning();

    // 가격 제안 레코드 생성
    const [offer] = await db.insert(priceOffers).values({
      productId,
      buyerId,
      sellerId: product.sellerId,
      chatRoomId: chatRoom.id,
      messageId: newMessage.id,
      offerPrice,
      status: 'PENDING',
    }).returning();

    // 메시지 content에 offerId 포함하여 업데이트
    const updatedContent = JSON.stringify({ offerPrice, offerId: offer.id, type: 'PRICE_OFFER' });
    await db.update(messages)
      .set({ content: updatedContent })
      .where(eq(messages.id, newMessage.id));

    // 채팅방 마지막 메시지 업데이트
    const priceText = offerPrice.toLocaleString('ko-KR');
    await db.update(chatRooms)
      .set({
        lastMessage: `가격 제안: ${priceText}원`,
        lastMessageAt: new Date(),
      })
      .where(eq(chatRooms.id, chatRoom.id));

    // 판매자에게 알림
    await db.insert(notifications).values({
      userId: product.sellerId,
      type: 'PRICE',
      title: '가격 제안',
      body: `${buyer?.nickname || '구매자'}님이 ${priceText}원으로 가격을 제안했어요.`,
      link: `/chats/${chatRoom.id}`,
    });

    // Socket.io 실시간 알림
    const io = req.app.get('io');
    if (io) {
      const emitMessage = { ...newMessage, content: updatedContent };
      io.to(`chat:${chatRoom.id}`).emit('new_message', emitMessage);
      io.to(`user:${product.sellerId}`).emit('chat_updated', {
        roomId: chatRoom.id,
        lastMessage: `가격 제안: ${priceText}원`,
      });
    }

    res.status(201).json({ offer, chatRoomId: chatRoom.id });
  } catch (err) {
    console.error('가격 제안 생성 오류:', err);
    res.status(500).json({ error: '가격 제안에 실패했습니다.' });
  }
});

// PATCH /api/offers/:id/accept — 제안 수락
router.patch('/:id/accept', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const sellerId = req.user!.id;
    const offerId = parseInt(req.params.id as string);

    // 제안 조회
    const [offer] = await db.select().from(priceOffers).where(eq(priceOffers.id, offerId)).limit(1);
    if (!offer) {
      res.status(404).json({ error: '제안을 찾을 수 없습니다.' });
      return;
    }

    // 판매자 확인
    if (offer.sellerId !== sellerId) {
      res.status(403).json({ error: '판매자만 제안을 수락할 수 있습니다.' });
      return;
    }

    // PENDING 상태 확인
    if (offer.status !== 'PENDING') {
      res.status(400).json({ error: '이미 처리된 제안입니다.' });
      return;
    }

    // 제안 상태 업데이트
    const [updated] = await db.update(priceOffers)
      .set({ status: 'ACCEPTED', respondedAt: new Date() })
      .where(eq(priceOffers.id, offerId))
      .returning();

    // 결과 메시지 삽입
    const priceText = offer.offerPrice.toLocaleString('ko-KR');
    const resultContent = JSON.stringify({
      offerId: offer.id,
      offerPrice: offer.offerPrice,
      status: 'ACCEPTED',
      type: 'PRICE_RESULT',
    });

    const [resultMessage] = await db.insert(messages).values({
      chatRoomId: offer.chatRoomId,
      senderId: sellerId,
      content: resultContent,
      type: 'PRICE_RESULT',
    }).returning();

    // 채팅방 마지막 메시지 업데이트
    await db.update(chatRooms)
      .set({
        lastMessage: `가격 제안이 수락되었습니다`,
        lastMessageAt: new Date(),
      })
      .where(eq(chatRooms.id, offer.chatRoomId));

    // 구매자에게 알림
    const [seller] = await db.select({ nickname: users.nickname }).from(users).where(eq(users.id, sellerId)).limit(1);
    await db.insert(notifications).values({
      userId: offer.buyerId,
      type: 'PRICE',
      title: '가격 제안 수락',
      body: `${seller?.nickname || '판매자'}님이 ${priceText}원 제안을 수락했어요!`,
      link: `/chats/${offer.chatRoomId}`,
    });

    // Socket.io 실시간 알림
    const io = req.app.get('io');
    if (io) {
      io.to(`chat:${offer.chatRoomId}`).emit('new_message', resultMessage);
      io.to(`user:${offer.buyerId}`).emit('chat_updated', {
        roomId: offer.chatRoomId,
        lastMessage: '가격 제안이 수락되었습니다',
      });
    }

    res.json({ offer: updated });
  } catch (err) {
    console.error('가격 제안 수락 오류:', err);
    res.status(500).json({ error: '제안 수락에 실패했습니다.' });
  }
});

// PATCH /api/offers/:id/reject — 제안 거절
router.patch('/:id/reject', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const sellerId = req.user!.id;
    const offerId = parseInt(req.params.id as string);

    // 제안 조회
    const [offer] = await db.select().from(priceOffers).where(eq(priceOffers.id, offerId)).limit(1);
    if (!offer) {
      res.status(404).json({ error: '제안을 찾을 수 없습니다.' });
      return;
    }

    // 판매자 확인
    if (offer.sellerId !== sellerId) {
      res.status(403).json({ error: '판매자만 제안을 거절할 수 있습니다.' });
      return;
    }

    // PENDING 상태 확인
    if (offer.status !== 'PENDING') {
      res.status(400).json({ error: '이미 처리된 제안입니다.' });
      return;
    }

    // 제안 상태 업데이트
    const [updated] = await db.update(priceOffers)
      .set({ status: 'REJECTED', respondedAt: new Date() })
      .where(eq(priceOffers.id, offerId))
      .returning();

    // 결과 메시지 삽입
    const priceText = offer.offerPrice.toLocaleString('ko-KR');
    const resultContent = JSON.stringify({
      offerId: offer.id,
      offerPrice: offer.offerPrice,
      status: 'REJECTED',
      type: 'PRICE_RESULT',
    });

    const [resultMessage] = await db.insert(messages).values({
      chatRoomId: offer.chatRoomId,
      senderId: sellerId,
      content: resultContent,
      type: 'PRICE_RESULT',
    }).returning();

    // 채팅방 마지막 메시지 업데이트
    await db.update(chatRooms)
      .set({
        lastMessage: `가격 제안이 거절되었습니다`,
        lastMessageAt: new Date(),
      })
      .where(eq(chatRooms.id, offer.chatRoomId));

    // 구매자에게 알림
    const [seller] = await db.select({ nickname: users.nickname }).from(users).where(eq(users.id, sellerId)).limit(1);
    await db.insert(notifications).values({
      userId: offer.buyerId,
      type: 'PRICE',
      title: '가격 제안 거절',
      body: `${seller?.nickname || '판매자'}님이 ${priceText}원 제안을 거절했어요.`,
      link: `/chats/${offer.chatRoomId}`,
    });

    // Socket.io 실시간 알림
    const io = req.app.get('io');
    if (io) {
      io.to(`chat:${offer.chatRoomId}`).emit('new_message', resultMessage);
      io.to(`user:${offer.buyerId}`).emit('chat_updated', {
        roomId: offer.chatRoomId,
        lastMessage: '가격 제안이 거절되었습니다',
      });
    }

    res.json({ offer: updated });
  } catch (err) {
    console.error('가격 제안 거절 오류:', err);
    res.status(500).json({ error: '제안 거절에 실패했습니다.' });
  }
});

export default router;
