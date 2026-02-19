import { Router, Request, Response } from 'express';
import { asc } from 'drizzle-orm';
import { db } from '../db';
import { categories } from '../db/schema';

const router = Router();

// GET /api/categories — 전체 카테고리 목록
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await db
      .select()
      .from(categories)
      .orderBy(asc(categories.sortOrder));

    res.json(result);
  } catch (err) {
    console.error('카테고리 조회 오류:', err);
    res.status(500).json({ error: '카테고리 조회에 실패했습니다.' });
  }
});

export default router;
