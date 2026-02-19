import { Router, Response } from 'express';
import { z } from 'zod';
import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../db';
import { reviews, users, products } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AuthRequest } from '../types';

const router = Router();

// 긍정/부정 태그 목록
const POSITIVE_TAGS = [
  '시간 약속을 잘 지켜요',
  '친절하고 매너가 좋아요',
  '응답이 빨라요',
  '제품 상태가 좋아요',
  '좋은 상품을 저렴하게 판매해요',
  '나눔을 잘 해요',
];

const NEGATIVE_TAGS = [
  '시간 약속을 안 지켜요',
  '불친절해요',
  '응답이 느려요',
  '상품 상태가 설명과 달라요',
  '무리한 가격을 요구해요',
];

// 후기 작성 스키마
const createReviewSchema = z.object({
  revieweeId: z.string().uuid(),
  productId: z.number().int().positive(),
  isPositive: z.boolean(),
  tags: z.array(z.string()).min(1, '태그를 하나 이상 선택해주세요.'),
});

// POST /api/reviews — 후기 작성
router.post('/', requireAuth, validate(createReviewSchema), async (req: AuthRequest, res: Response) => {
  try {
    const reviewerId = req.user!.id;
    const { revieweeId, productId, isPositive, tags } = req.body;

    // 자기 자신에게 후기 불가
    if (reviewerId === revieweeId) {
      res.status(400).json({ error: '자신에게는 후기를 작성할 수 없습니다.' });
      return;
    }

    // 상품 존재 확인
    const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!product) {
      res.status(404).json({ error: '상품을 찾을 수 없습니다.' });
      return;
    }

    // 거래완료 상태인지 확인
    if (product.status !== 'SOLD') {
      res.status(400).json({ error: '거래완료된 상품에만 후기를 작성할 수 있습니다.' });
      return;
    }

    // 중복 후기 확인
    const [existing] = await db.select().from(reviews)
      .where(and(eq(reviews.reviewerId, reviewerId), eq(reviews.productId, productId)))
      .limit(1);

    if (existing) {
      res.status(409).json({ error: '이미 후기를 작성했습니다.' });
      return;
    }

    // 후기 저장
    const [newReview] = await db.insert(reviews).values({
      reviewerId,
      revieweeId,
      productId,
      isPositive,
      tags,
    }).returning();

    // 매너온도 업데이트
    const tempChange = isPositive
      ? (0.1 + Math.random() * 0.2)  // +0.1 ~ +0.3
      : -(0.2 + Math.random() * 0.3); // -0.2 ~ -0.5

    await db.execute(sql`
      UPDATE users
      SET manner_temp = GREATEST(0, LEAST(99, CAST(manner_temp AS numeric) + ${tempChange}))
      WHERE id = ${revieweeId}
    `);

    res.status(201).json(newReview);
  } catch (err) {
    console.error('후기 작성 오류:', err);
    res.status(500).json({ error: '후기 작성에 실패했습니다.' });
  }
});

// GET /api/reviews/user/:userId — 받은 후기 조회
router.get('/user/:userId', async (req, res: Response) => {
  try {
    const userId = req.params.userId;

    const result = await db
      .select({
        id: reviews.id,
        reviewerId: reviews.reviewerId,
        productId: reviews.productId,
        isPositive: reviews.isPositive,
        tags: reviews.tags,
        createdAt: reviews.createdAt,
        reviewerNickname: users.nickname,
        reviewerImage: users.profileImage,
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.reviewerId, users.id))
      .where(eq(reviews.revieweeId, userId))
      .orderBy(desc(reviews.createdAt));

    // 태그별 통계
    const tagCounts: Record<string, number> = {};
    let positiveCount = 0;
    let negativeCount = 0;

    for (const r of result) {
      if (r.isPositive) positiveCount++;
      else negativeCount++;

      for (const tag of r.tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }

    res.json({
      reviews: result,
      summary: {
        total: result.length,
        positiveCount,
        negativeCount,
        tagCounts,
      },
    });
  } catch (err) {
    console.error('후기 조회 오류:', err);
    res.status(500).json({ error: '후기 조회에 실패했습니다.' });
  }
});

// GET /api/reviews/tags — 태그 목록 조회
router.get('/tags', (_req, res: Response) => {
  res.json({ positiveTags: POSITIVE_TAGS, negativeTags: NEGATIVE_TAGS });
});

export default router;
