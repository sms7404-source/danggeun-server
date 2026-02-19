import { Router, Request, Response } from 'express';
import { ilike, eq } from 'drizzle-orm';
import { db } from '../db';
import { regions } from '../db/schema';

const router = Router();

// GET /api/regions/search?q=다산 — 지역 검색
router.get('/search', async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string;

    if (!q || q.trim().length === 0) {
      res.json([]);
      return;
    }

    const results = await db
      .select()
      .from(regions)
      .where(ilike(regions.fullName, `%${q.trim()}%`))
      .limit(20);

    res.json(results);
  } catch (err) {
    console.error('지역 검색 오류:', err);
    res.status(500).json({ error: '지역 검색에 실패했습니다.' });
  }
});

// GET /api/regions/:id — 지역 상세
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ error: '올바른 지역 ID가 아닙니다.' });
      return;
    }

    const [region] = await db
      .select()
      .from(regions)
      .where(eq(regions.id, id))
      .limit(1);

    if (!region) {
      res.status(404).json({ error: '지역을 찾을 수 없습니다.' });
      return;
    }

    res.json(region);
  } catch (err) {
    console.error('지역 조회 오류:', err);
    res.status(500).json({ error: '지역 조회에 실패했습니다.' });
  }
});

export default router;
