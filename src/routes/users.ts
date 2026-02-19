import { Router, Response, Request } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import { users, products, productImages, regions, likes, reviews } from '../db/schema';

const router = Router();

// GET /api/users/:id — 사용자 프로필 조회
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;

    const [user] = await db.select({
      id: users.id,
      nickname: users.nickname,
      profileImage: users.profileImage,
      regionId: users.regionId,
      mannerTemp: users.mannerTemp,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.id, userId)).limit(1);

    if (!user) {
      res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
      return;
    }

    // 지역 정보
    let regionName = null;
    if (user.regionId) {
      const [region] = await db.select({ name: regions.name }).from(regions).where(eq(regions.id, user.regionId)).limit(1);
      regionName = region?.name || null;
    }

    // 판매 상품 수
    const [productCount] = await db.select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(and(eq(products.sellerId, userId), sql`${products.status} != 'HIDDEN'`));

    // 받은 후기 수
    const [reviewCount] = await db.select({ count: sql<number>`count(*)::int` })
      .from(reviews)
      .where(eq(reviews.revieweeId, userId));

    res.json({
      ...user,
      regionName,
      productCount: productCount?.count || 0,
      reviewCount: reviewCount?.count || 0,
    });
  } catch (err) {
    console.error('사용자 프로필 조회 오류:', err);
    res.status(500).json({ error: '프로필 조회에 실패했습니다.' });
  }
});

// GET /api/users/:id/products — 사용자 판매 상품 목록
router.get('/:id/products', async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const status = (req.query.status as string) || undefined;

    const conditions = [eq(products.sellerId, userId), sql`${products.status} != 'HIDDEN'`];
    if (status) {
      conditions.push(eq(products.status, status));
    }

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
      .from(products)
      .leftJoin(regions, eq(products.regionId, regions.id))
      .where(and(...conditions))
      .orderBy(desc(products.bumpedAt));

    // 썸네일 + 관심 수
    const productIds = result.map((p) => p.id);
    let thumbnails: Record<number, string> = {};
    let likeCounts: Record<number, number> = {};

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

      const likeResults = await db
        .select({ productId: likes.productId, count: sql<number>`count(*)::int` })
        .from(likes)
        .where(sql`${likes.productId} IN (${sql.join(productIds.map(id => sql`${id}`), sql`, `)})`)
        .groupBy(likes.productId);
      for (const like of likeResults) {
        likeCounts[like.productId] = like.count;
      }
    }

    const enriched = result.map((p) => ({
      ...p,
      thumbnailUrl: thumbnails[p.id] || null,
      likeCount: likeCounts[p.id] || 0,
    }));

    res.json(enriched);
  } catch (err) {
    console.error('사용자 상품 목록 조회 오류:', err);
    res.status(500).json({ error: '상품 목록 조회에 실패했습니다.' });
  }
});

export default router;
