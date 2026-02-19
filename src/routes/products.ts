import { Router, Response } from 'express';
import { z } from 'zod';
import { eq, and, desc, lt, sql, ilike } from 'drizzle-orm';
import { db } from '../db';
import { products, productImages, users, regions, likes } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AuthRequest } from '../types';

const router = Router();

// 상품 등록 스키마
const createProductSchema = z.object({
  title: z.string().min(1, '제목을 입력하세요.').max(100, '제목은 100자 이하여야 합니다.'),
  description: z.string().optional(),
  price: z.number().int().min(0).nullable().optional(),
  isFree: z.boolean().optional().default(false),
  categoryId: z.number().int().positive().nullable().optional(),
  locationText: z.string().optional(),
  allowOffer: z.boolean().optional().default(true),
  imageUrls: z.array(z.string().url()).optional().default([]),
});

// 상품 수정 스키마
const updateProductSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  price: z.number().int().min(0).nullable().optional(),
  isFree: z.boolean().optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  locationText: z.string().optional(),
  allowOffer: z.boolean().optional(),
  imageUrls: z.array(z.string().url()).optional(),
});

// POST /api/products — 상품 등록
router.post('/', requireAuth, validate(createProductSchema), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { title, description, price, isFree, categoryId, locationText, allowOffer, imageUrls } = req.body;

    // 사용자의 regionId 가져오기
    const [user] = await db.select({ regionId: users.regionId }).from(users).where(eq(users.id, userId)).limit(1);

    const [newProduct] = await db.insert(products).values({
      sellerId: userId,
      title,
      description: description || null,
      price: isFree ? 0 : (price ?? null),
      isFree: isFree || false,
      categoryId: categoryId || null,
      regionId: user?.regionId || null,
      locationText: locationText || null,
      allowOffer: allowOffer ?? true,
    }).returning();

    // 이미지 저장
    if (imageUrls && imageUrls.length > 0) {
      await db.insert(productImages).values(
        imageUrls.map((url: string, index: number) => ({
          productId: newProduct.id,
          imageUrl: url,
          displayOrder: index,
        }))
      );
    }

    res.status(201).json(newProduct);
  } catch (err) {
    console.error('상품 등록 오류:', err);
    res.status(500).json({ error: '상품 등록에 실패했습니다.' });
  }
});

// GET /api/products — 상품 목록 (커서 기반 페이지네이션)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const regionId = req.query.regionId ? parseInt(req.query.regionId as string) : undefined;
    const status = (req.query.status as string) || undefined;
    const search = (req.query.search as string) || undefined;
    const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
    const cursor = req.query.cursor ? parseInt(req.query.cursor as string) : undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    const conditions = [];

    if (regionId) {
      conditions.push(eq(products.regionId, regionId));
    }
    if (status) {
      conditions.push(eq(products.status, status));
    }
    if (search) {
      conditions.push(ilike(products.title, `%${search}%`));
    }
    if (categoryId) {
      conditions.push(eq(products.categoryId, categoryId));
    }
    if (cursor) {
      conditions.push(lt(products.id, cursor));
    }
    // HIDDEN 상품 제외
    conditions.push(sql`${products.status} != 'HIDDEN'`);

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const result = await db
      .select({
        id: products.id,
        title: products.title,
        price: products.price,
        isFree: products.isFree,
        status: products.status,
        regionId: products.regionId,
        viewCount: products.viewCount,
        createdAt: products.createdAt,
        bumpedAt: products.bumpedAt,
        sellerId: products.sellerId,
        regionName: regions.name,
      })
      .from(products)
      .leftJoin(regions, eq(products.regionId, regions.id))
      .where(where)
      .orderBy(desc(products.bumpedAt))
      .limit(limit + 1);

    const hasMore = result.length > limit;
    const items = hasMore ? result.slice(0, limit) : result;

    // 각 상품의 썸네일과 관심 수 가져오기
    const productIds = items.map((p) => p.id);

    let thumbnails: Record<number, string> = {};
    let likeCounts: Record<number, number> = {};

    if (productIds.length > 0) {
      // 썸네일 (displayOrder가 0인 이미지)
      const images = await db
        .select({
          productId: productImages.productId,
          imageUrl: productImages.imageUrl,
        })
        .from(productImages)
        .where(
          and(
            sql`${productImages.productId} IN (${sql.join(productIds.map(id => sql`${id}`), sql`, `)})`,
            eq(productImages.displayOrder, 0)
          )
        );

      for (const img of images) {
        thumbnails[img.productId] = img.imageUrl;
      }

      // 관심 수
      const likeResults = await db
        .select({
          productId: likes.productId,
          count: sql<number>`count(*)::int`,
        })
        .from(likes)
        .where(sql`${likes.productId} IN (${sql.join(productIds.map(id => sql`${id}`), sql`, `)})`)
        .groupBy(likes.productId);

      for (const like of likeResults) {
        likeCounts[like.productId] = like.count;
      }
    }

    const enrichedProducts = items.map((p) => ({
      ...p,
      thumbnailUrl: thumbnails[p.id] || null,
      likeCount: likeCounts[p.id] || 0,
    }));

    res.json({
      products: enrichedProducts,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    });
  } catch (err) {
    console.error('상품 목록 조회 오류:', err);
    res.status(500).json({ error: '상품 목록 조회에 실패했습니다.' });
  }
});

// GET /api/products/:id — 상품 상세
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: '올바른 상품 ID가 아닙니다.' });
      return;
    }

    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!product) {
      res.status(404).json({ error: '상품을 찾을 수 없습니다.' });
      return;
    }

    // 이미지 가져오기
    const images = await db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, id))
      .orderBy(productImages.displayOrder);

    // 판매자 정보
    const [seller] = await db
      .select({
        id: users.id,
        nickname: users.nickname,
        profileImage: users.profileImage,
        regionId: users.regionId,
        mannerTemp: users.mannerTemp,
      })
      .from(users)
      .where(eq(users.id, product.sellerId))
      .limit(1);

    // 지역 정보
    let regionName = null;
    if (product.regionId) {
      const [region] = await db
        .select({ name: regions.name })
        .from(regions)
        .where(eq(regions.id, product.regionId))
        .limit(1);
      regionName = region?.name || null;
    }

    // 관심 수
    const [likeResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(likes)
      .where(eq(likes.productId, id));

    // 조회수 +1
    await db.update(products)
      .set({ viewCount: sql`${products.viewCount} + 1` })
      .where(eq(products.id, id));

    res.json({
      ...product,
      viewCount: (product.viewCount || 0) + 1,
      images,
      seller,
      regionName,
      likeCount: likeResult?.count || 0,
    });
  } catch (err) {
    console.error('상품 상세 조회 오류:', err);
    res.status(500).json({ error: '상품 상세 조회에 실패했습니다.' });
  }
});

// PUT /api/products/:id — 상품 수정 (본인만)
router.put('/:id', requireAuth, validate(updateProductSchema), async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;

    const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!product) {
      res.status(404).json({ error: '상품을 찾을 수 없습니다.' });
      return;
    }
    if (product.sellerId !== userId) {
      res.status(403).json({ error: '본인의 상품만 수정할 수 있습니다.' });
      return;
    }

    const { imageUrls, ...updates } = req.body;

    const [updated] = await db.update(products)
      .set(updates)
      .where(eq(products.id, id))
      .returning();

    // 이미지 변경 시
    if (imageUrls !== undefined) {
      await db.delete(productImages).where(eq(productImages.productId, id));
      if (imageUrls.length > 0) {
        await db.insert(productImages).values(
          imageUrls.map((url: string, index: number) => ({
            productId: id,
            imageUrl: url,
            displayOrder: index,
          }))
        );
      }
    }

    res.json(updated);
  } catch (err) {
    console.error('상품 수정 오류:', err);
    res.status(500).json({ error: '상품 수정에 실패했습니다.' });
  }
});

// DELETE /api/products/:id — 상품 삭제 (본인만)
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;

    const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!product) {
      res.status(404).json({ error: '상품을 찾을 수 없습니다.' });
      return;
    }
    if (product.sellerId !== userId) {
      res.status(403).json({ error: '본인의 상품만 삭제할 수 있습니다.' });
      return;
    }

    await db.delete(products).where(eq(products.id, id));
    res.json({ message: '상품이 삭제되었습니다.' });
  } catch (err) {
    console.error('상품 삭제 오류:', err);
    res.status(500).json({ error: '상품 삭제에 실패했습니다.' });
  }
});

// PATCH /api/products/:id/status — 상태 변경 (본인만)
router.patch('/:id/status', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const { status } = req.body;

    const validStatuses = ['SALE', 'RESERVED', 'SOLD', 'HIDDEN'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: '올바른 상태값이 아닙니다.' });
      return;
    }

    const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!product) {
      res.status(404).json({ error: '상품을 찾을 수 없습니다.' });
      return;
    }
    if (product.sellerId !== userId) {
      res.status(403).json({ error: '본인의 상품만 변경할 수 있습니다.' });
      return;
    }

    const [updated] = await db.update(products)
      .set({ status })
      .where(eq(products.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    console.error('상품 상태 변경 오류:', err);
    res.status(500).json({ error: '상품 상태 변경에 실패했습니다.' });
  }
});

// PATCH /api/products/:id/bump — 끌어올리기 (본인만, 3일 경과 시)
router.patch('/:id/bump', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;

    const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!product) {
      res.status(404).json({ error: '상품을 찾을 수 없습니다.' });
      return;
    }
    if (product.sellerId !== userId) {
      res.status(403).json({ error: '본인의 상품만 끌올할 수 있습니다.' });
      return;
    }

    // 3일 경과 체크
    const bumpedAt = product.bumpedAt ? new Date(product.bumpedAt) : new Date(product.createdAt!);
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    if (bumpedAt > threeDaysAgo) {
      res.status(400).json({ error: '끌어올리기는 3일에 한 번만 가능합니다.' });
      return;
    }

    const [updated] = await db.update(products)
      .set({ bumpedAt: new Date() })
      .where(eq(products.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    console.error('끌올 오류:', err);
    res.status(500).json({ error: '끌어올리기에 실패했습니다.' });
  }
});

export default router;
