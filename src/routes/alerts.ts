import { Router, Response } from 'express';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { keywordAlerts } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AuthRequest } from '../types';

const router = Router();

const createAlertSchema = z.object({
  keyword: z.string().min(1, '키워드를 입력하세요.').max(50),
  regionId: z.number().int().positive().nullable().optional(),
});

// POST /api/alerts — 키워드 알림 등록
router.post('/', requireAuth, validate(createAlertSchema), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { keyword, regionId } = req.body;

    // 같은 키워드 중복 확인
    const [existing] = await db.select().from(keywordAlerts)
      .where(and(eq(keywordAlerts.userId, userId), eq(keywordAlerts.keyword, keyword)))
      .limit(1);

    if (existing) {
      res.status(409).json({ error: '이미 등록된 키워드입니다.' });
      return;
    }

    // 최대 30개 제한
    const allAlerts = await db.select().from(keywordAlerts).where(eq(keywordAlerts.userId, userId));
    if (allAlerts.length >= 30) {
      res.status(400).json({ error: '키워드 알림은 최대 30개까지 등록할 수 있습니다.' });
      return;
    }

    const [alert] = await db.insert(keywordAlerts).values({
      userId,
      keyword,
      regionId: regionId || null,
    }).returning();

    res.status(201).json(alert);
  } catch (err) {
    console.error('키워드 알림 등록 오류:', err);
    res.status(500).json({ error: '알림 등록에 실패했습니다.' });
  }
});

// GET /api/alerts — 내 키워드 알림 목록
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const alerts = await db.select()
      .from(keywordAlerts)
      .where(eq(keywordAlerts.userId, userId))
      .orderBy(desc(keywordAlerts.createdAt));

    res.json(alerts);
  } catch (err) {
    console.error('키워드 알림 조회 오류:', err);
    res.status(500).json({ error: '알림 목록 조회에 실패했습니다.' });
  }
});

// DELETE /api/alerts/:id — 키워드 알림 삭제
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = parseInt(req.params.id);

    const [alert] = await db.select().from(keywordAlerts).where(eq(keywordAlerts.id, id)).limit(1);
    if (!alert || alert.userId !== userId) {
      res.status(404).json({ error: '알림을 찾을 수 없습니다.' });
      return;
    }

    await db.delete(keywordAlerts).where(eq(keywordAlerts.id, id));
    res.json({ message: '알림이 삭제되었습니다.' });
  } catch (err) {
    console.error('키워드 알림 삭제 오류:', err);
    res.status(500).json({ error: '알림 삭제에 실패했습니다.' });
  }
});

export default router;
