import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/auth';
import regionRoutes from './routes/regions';
import categoryRoutes from './routes/categories';
import productRoutes from './routes/products';
import uploadRoutes from './routes/upload';
import likesRoutes from './routes/likes';
import chatRoutes from './routes/chats';
import userRoutes from './routes/users';
import reviewRoutes from './routes/reviews';
import alertRoutes from './routes/alerts';
import notificationRoutes from './routes/notifications';
import reportRoutes from './routes/reports';
import blockRoutes from './routes/blocks';
import offerRoutes from './routes/offers';
import { errorHandler } from './middleware/errorHandler';
import { supabaseAdmin } from './utils/supabase';
import { db } from './db';
import { messages, chatRooms } from './db/schema';
import { eq, and } from 'drizzle-orm';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 4000;
const CLIENT_URLS = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((u) => u.trim());

// Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_URLS,
    credentials: true,
  },
});

// Middleware
app.use(helmet());
app.use(cors({ origin: CLIENT_URLS, credentials: true }));
app.use(morgan('dev'));
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/regions', regionRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/likes', likesRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/blocks', blockRoutes);
app.use('/api/offers', offerRoutes);

// Socket.io 인스턴스를 라우트에서 접근할 수 있도록 공유
app.set('io', io);

// Error handler
app.use(errorHandler);

// Socket.io 인증 미들웨어
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('인증 토큰이 필요합니다.'));
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return next(new Error('인증에 실패했습니다.'));
    }

    (socket as any).userId = user.id;
    next();
  } catch (err) {
    next(new Error('인증 처리 중 오류가 발생했습니다.'));
  }
});

// Socket.io 이벤트
io.on('connection', (socket) => {
  const userId = (socket as any).userId;
  console.log(`Socket connected: ${userId}`);

  // 유저 전용 룸에 조인 (개인 알림용)
  socket.join(`user:${userId}`);

  // 채팅방 입장
  socket.on('join_room', (roomId: number) => {
    socket.join(`chat:${roomId}`);
    console.log(`User ${userId} joined room ${roomId}`);
  });

  // 채팅방 퇴장
  socket.on('leave_room', (roomId: number) => {
    socket.leave(`chat:${roomId}`);
  });

  // 메시지 전송
  socket.on('send_message', async (data: { roomId: number; content: string }) => {
    try {
      const { roomId, content } = data;
      if (!content?.trim()) return;

      // 채팅방 접근 권한 확인
      const [room] = await db.select().from(chatRooms).where(eq(chatRooms.id, roomId)).limit(1);
      if (!room || (room.buyerId !== userId && room.sellerId !== userId)) return;

      // 메시지 저장
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

      // 채팅방 참가자 모두에게 메시지 전송
      io.to(`chat:${roomId}`).emit('new_message', newMessage);

      // 상대방에게 채팅 목록 업데이트 알림
      const otherUserId = room.buyerId === userId ? room.sellerId : room.buyerId;
      io.to(`user:${otherUserId}`).emit('chat_updated', { roomId, lastMessage: content.trim() });
    } catch (err) {
      console.error('Socket 메시지 전송 오류:', err);
    }
  });

  // 메시지 읽음 처리
  socket.on('read_messages', async (roomId: number) => {
    try {
      await db.update(messages)
        .set({ isRead: true })
        .where(and(
          eq(messages.chatRoomId, roomId),
          eq(messages.isRead, false),
          // senderId가 본인이 아닌 메시지만
        ));
    } catch (err) {
      console.error('읽음 처리 오류:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${userId}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export { io };
export default app;
