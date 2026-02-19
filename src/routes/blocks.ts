import { Router, Response } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { blocks, users } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

// POST /api/blocks/:userId — 사용자 차단
router.post('/:userId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const blockerId = req.user!.id;
    const blockedId = req.params.userId;

    if (blockerId === blockedId) {
      res.status(400).json({ error: '자기 자신을 차단할 수 없습니다.' });
      return;
    }

    // 이미 차단 확인
    const [existing] = await db.select().from(blocks)
      .where(and(eq(blocks.blockerId, blockerId), eq(blocks.blockedId, blockedId)))
      .limit(1);

    if (existing) {
      res.status(409).json({ error: '이미 차단한 사용자입니다.' });
      return;
    }

    const [block] = await db.insert(blocks).values({
      blockerId,
      blockedId,
    }).returning();

    res.status(201).json(block);
  } catch (err) {
    console.error('차단 오류:', err);
    res.status(500).json({ error: '차단에 실패했습니다.' });
  }
});

// DELETE /api/blocks/:userId — 차단 해제
router.delete('/:userId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const blockerId = req.user!.id;
    const blockedId = req.params.userId;

    const [existing] = await db.select().from(blocks)
      .where(and(eq(blocks.blockerId, blockerId), eq(blocks.blockedId, blockedId)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: '차단 내역을 찾을 수 없습니다.' });
      return;
    }

    await db.delete(blocks).where(eq(blocks.id, existing.id));
    res.json({ message: '차단이 해제되었습니다.' });
  } catch (err) {
    console.error('차단 해제 오류:', err);
    res.status(500).json({ error: '차단 해제에 실패했습니다.' });
  }
});

// GET /api/blocks — 차단 목록
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const blockerId = req.user!.id;

    const result = await db
      .select({
        id: blocks.id,
        blockedId: blocks.blockedId,
        nickname: users.nickname,
        profileImage: users.profileImage,
        createdAt: blocks.createdAt,
      })
      .from(blocks)
      .innerJoin(users, eq(blocks.blockedId, users.id))
      .where(eq(blocks.blockerId, blockerId))
      .orderBy(desc(blocks.createdAt));

    res.json(result);
  } catch (err) {
    console.error('차단 목록 조회 오류:', err);
    res.status(500).json({ error: '차단 목록 조회에 실패했습니다.' });
  }
});

// GET /api/blocks/check/:userId — 차단 여부 확인
router.get('/check/:userId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const blockerId = req.user!.id;
    const blockedId = req.params.userId;

    const [existing] = await db.select().from(blocks)
      .where(and(eq(blocks.blockerId, blockerId), eq(blocks.blockedId, blockedId)))
      .limit(1);

    res.json({ blocked: !!existing });
  } catch (err) {
    res.status(500).json({ error: '확인에 실패했습니다.' });
  }
});

export default router;
