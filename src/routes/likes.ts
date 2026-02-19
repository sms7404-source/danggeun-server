import { Router, Response } from 'express';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db';
import { likes, products, productImages, regions } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

// POST /api/likes/:productId — 찜하기
router.post('/:productId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const productId = parseInt(req.params.productId);

    if (isNaN(productId)) {
      res.status(400).json({ error: '올바른 상품 ID가 아닙니다.' });
      return;
    }

    // 이미 찜했는지 확인
    const existing = await db.select().from(likes)
      .where(and(eq(likes.userId, userId), eq(likes.productId, productId)))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: '이미 찜한 상품입니다.' });
      return;
    }

    await db.insert(likes).values({ userId, productId });
    res.status(201).json({ message: '찜 완료' });
  } catch (err) {
    console.error('찜하기 오류:', err);
    res.status(500).json({ error: '찜하기에 실패했습니다.' });
  }
});

// DELETE /api/likes/:productId — 찜 해제
router.delete('/:productId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const productId = parseInt(req.params.productId);

    await db.delete(likes)
      .where(and(eq(likes.userId, userId), eq(likes.productId, productId)));

    res.json({ message: '찜 해제 완료' });
  } catch (err) {
    console.error('찜 해제 오류:', err);
    res.status(500).json({ error: '찜 해제에 실패했습니다.' });
  }
});

// GET /api/likes — 내 찜 목록
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const result = await db
      .select({
        id: products.id,
        title: products.title,
        price: products.price,
        isFree: products.isFree,
        status: products.status,
        regionId: products.regionId,
        bumpedAt: products.bumpedAt,
        regionName: regions.name,
      })
      .from(likes)
      .innerJoin(products, eq(likes.productId, products.id))
      .leftJoin(regions, eq(products.regionId, regions.id))
      .where(eq(likes.userId, userId))
      .orderBy(sql`${likes.createdAt} DESC`);

    // 썸네일 가져오기
    const productIds = result.map((p) => p.id);
    let thumbnails: Record<number, string> = {};

    if (productIds.length > 0) {
      const images = await db
        .select({ productId: productImages.productId, imageUrl: productImages.imageUrl })
        .from(productImages)
        .where(and(
          sql`${productImages.productId} IN (${sql.join(productIds.map(id => sql`${id}`), sql`, `)})`,
          eq(productImages.displayOrder, 0)
        ));
      for (const img of images) {
        thumbnails[img.productId] = img.imageUrl;
      }
    }

    const enriched = result.map((p) => ({
      ...p,
      thumbnailUrl: thumbnails[p.id] || null,
      likeCount: 0, // 찜 목록에서는 생략
    }));

    res.json(enriched);
  } catch (err) {
    console.error('찜 목록 조회 오류:', err);
    res.status(500).json({ error: '찜 목록 조회에 실패했습니다.' });
  }
});

// GET /api/products/:productId/liked — 특정 상품 찜 여부
router.get('/check/:productId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const productId = parseInt(req.params.productId);

    const existing = await db.select().from(likes)
      .where(and(eq(likes.userId, userId), eq(likes.productId, productId)))
      .limit(1);

    res.json({ liked: existing.length > 0 });
  } catch (err) {
    console.error('찜 여부 확인 오류:', err);
    res.status(500).json({ error: '찜 여부 확인에 실패했습니다.' });
  }
});

export default router;
