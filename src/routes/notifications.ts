import { Router, Response } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { notifications } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

// GET /api/notifications — 내 알림 목록
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const result = await db.select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    res.json(result);
  } catch (err) {
    console.error('알림 조회 오류:', err);
    res.status(500).json({ error: '알림 조회에 실패했습니다.' });
  }
});

// PATCH /api/notifications/:id/read — 읽음 처리
router.patch('/:id/read', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = parseInt(req.params.id);

    const [notification] = await db.select().from(notifications).where(eq(notifications.id, id)).limit(1);
    if (!notification || notification.userId !== userId) {
      res.status(404).json({ error: '알림을 찾을 수 없습니다.' });
      return;
    }

    const [updated] = await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    console.error('알림 읽음 처리 오류:', err);
    res.status(500).json({ error: '읽음 처리에 실패했습니다.' });
  }
});

// PATCH /api/notifications/read-all — 전체 읽음
router.patch('/read-all', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));

    res.json({ message: '모든 알림을 읽음 처리했습니다.' });
  } catch (err) {
    console.error('전체 읽음 처리 오류:', err);
    res.status(500).json({ error: '읽음 처리에 실패했습니다.' });
  }
});

export default router;
