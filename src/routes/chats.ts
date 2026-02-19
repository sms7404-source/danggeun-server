import { Router, Response } from 'express';
import { eq, and, or, sql, desc } from 'drizzle-orm';
import { db } from '../db';
import { chatRooms, messages, users, products, productImages } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

// POST /api/chats — 채팅방 생성 또는 기존 채팅방 반환
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const buyerId = req.user!.id;
    const { productId } = req.body;

    if (!productId) {
      res.status(400).json({ error: '상품 ID가 필요합니다.' });
      return;
    }

    // 상품 정보 가져오기
    const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!product) {
      res.status(404).json({ error: '상품을 찾을 수 없습니다.' });
      return;
    }

    // 자기 상품에 채팅 불가
    if (product.sellerId === buyerId) {
      res.status(400).json({ error: '본인 상품에는 채팅할 수 없습니다.' });
      return;
    }

    // 기존 채팅방 확인
    const [existing] = await db.select().from(chatRooms)
      .where(and(eq(chatRooms.productId, productId), eq(chatRooms.buyerId, buyerId)))
      .limit(1);

    if (existing) {
      res.json(existing);
      return;
    }

    // 새 채팅방 생성
    const [newRoom] = await db.insert(chatRooms).values({
      productId,
      buyerId,
      sellerId: product.sellerId,
    }).returning();

    res.status(201).json(newRoom);
  } catch (err) {
    console.error('채팅방 생성 오류:', err);
    res.status(500).json({ error: '채팅방 생성에 실패했습니다.' });
  }
});

// GET /api/chats — 내 채팅 목록
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const rooms = await db
      .select({
        id: chatRooms.id,
        productId: chatRooms.productId,
        buyerId: chatRooms.buyerId,
        sellerId: chatRooms.sellerId,
        lastMessage: chatRooms.lastMessage,
        lastMessageAt: chatRooms.lastMessageAt,
        createdAt: chatRooms.createdAt,
      })
      .from(chatRooms)
      .where(or(eq(chatRooms.buyerId, userId), eq(chatRooms.sellerId, userId)))
      .orderBy(desc(sql`COALESCE(${chatRooms.lastMessageAt}, ${chatRooms.createdAt})`));

    // 각 채팅방에 상대방 정보, 상품 썸네일, 안 읽은 메시지 수 추가
    const enriched = await Promise.all(rooms.map(async (room) => {
      const otherUserId = room.buyerId === userId ? room.sellerId : room.buyerId;

      // 상대방 정보
      const [otherUser] = await db.select({
        id: users.id,
        nickname: users.nickname,
        profileImage: users.profileImage,
      }).from(users).where(eq(users.id, otherUserId)).limit(1);

      // 상품 썸네일
      let thumbnailUrl: string | null = null;
      if (room.productId) {
        const [img] = await db.select({ imageUrl: productImages.imageUrl })
          .from(productImages)
          .where(and(eq(productImages.productId, room.productId), eq(productImages.displayOrder, 0)))
          .limit(1);
        thumbnailUrl = img?.imageUrl || null;
      }

      // 안 읽은 메시지 수
      const [unread] = await db.select({ count: sql<number>`count(*)::int` })
        .from(messages)
        .where(and(
          eq(messages.chatRoomId, room.id),
          sql`${messages.senderId} != ${userId}`,
          eq(messages.isRead, false)
        ));

      return {
        ...room,
        otherUser: otherUser || null,
        thumbnailUrl,
        unreadCount: unread?.count || 0,
      };
    }));

    res.json(enriched);
  } catch (err) {
    console.error('채팅 목록 조회 오류:', err);
    res.status(500).json({ error: '채팅 목록 조회에 실패했습니다.' });
  }
});

// GET /api/chats/:id — 채팅방 상세 (메시지 목록)
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const roomId = parseInt(req.params.id);

    // 채팅방 접근 권한 확인
    const [room] = await db.select().from(chatRooms).where(eq(chatRooms.id, roomId)).limit(1);
    if (!room) {
      res.status(404).json({ error: '채팅방을 찾을 수 없습니다.' });
      return;
    }
    if (room.buyerId !== userId && room.sellerId !== userId) {
      res.status(403).json({ error: '접근 권한이 없습니다.' });
      return;
    }

    // 상대방 정보
    const otherUserId = room.buyerId === userId ? room.sellerId : room.buyerId;
    const [otherUser] = await db.select({
      id: users.id,
      nickname: users.nickname,
      profileImage: users.profileImage,
    }).from(users).where(eq(users.id, otherUserId)).limit(1);

    // 상품 정보
    let productInfo = null;
    if (room.productId) {
      const [p] = await db.select({
        id: products.id,
        title: products.title,
        price: products.price,
        isFree: products.isFree,
        status: products.status,
      }).from(products).where(eq(products.id, room.productId)).limit(1);

      if (p) {
        const [img] = await db.select({ imageUrl: productImages.imageUrl })
          .from(productImages)
          .where(and(eq(productImages.productId, p.id), eq(productImages.displayOrder, 0)))
          .limit(1);
        productInfo = { ...p, thumbnailUrl: img?.imageUrl || null };
      }
    }

    // 메시지 가져오기
    const msgs = await db.select()
      .from(messages)
      .where(eq(messages.chatRoomId, roomId))
      .orderBy(messages.createdAt);

    // 상대방 메시지 읽음 처리
    await db.update(messages)
      .set({ isRead: true })
      .where(and(
        eq(messages.chatRoomId, roomId),
        sql`${messages.senderId} != ${userId}`,
        eq(messages.isRead, false)
      ));

    res.json({
      room,
      otherUser,
      product: productInfo,
      messages: msgs,
    });
  } catch (err) {
    console.error('채팅방 상세 조회 오류:', err);
    res.status(500).json({ error: '채팅방 조회에 실패했습니다.' });
  }
});

// POST /api/chats/:id/messages — 메시지 전송 (REST fallback)
router.post('/:id/messages', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const roomId = parseInt(req.params.id);
    const { content } = req.body;

    if (!content?.trim()) {
      res.status(400).json({ error: '메시지 내용을 입력하세요.' });
      return;
    }

    // 채팅방 접근 권한 확인
    const [room] = await db.select().from(chatRooms).where(eq(chatRooms.id, roomId)).limit(1);
    if (!room || (room.buyerId !== userId && room.sellerId !== userId)) {
      res.status(403).json({ error: '접근 권한이 없습니다.' });
      return;
    }

    const [newMessage] = await db.insert(messages).values({
      chatRoomId: roomId,
      senderId: userId,
      content: content.trim(),
      type: 'TEXT',
    }).returning();

    // 채팅방 마지막 메시지 업데이트
    await db.update(chatRooms)
      .set({
        lastMessage: content.trim(),
        lastMessageAt: new Date(),
      })
      .where(eq(chatRooms.id, roomId));

    res.status(201).json(newMessage);
  } catch (err) {
    console.error('메시지 전송 오류:', err);
    res.status(500).json({ error: '메시지 전송에 실패했습니다.' });
  }
});

export default router;
