import { Router, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { reports } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AuthRequest } from '../types';

const router = Router();

const REPORT_REASONS = [
  '비매너 사용자예요',
  '욕설을 해요',
  '거래/환불 분쟁',
  '사기가 의심돼요',
  '전문판매업자 같아요',
  '상품 정보가 부정확해요',
  '광고 게시글이에요',
  '기타',
];

const createReportSchema = z.object({
  targetType: z.enum(['PRODUCT', 'USER']),
  targetId: z.string().min(1),
  reason: z.string().min(1),
  description: z.string().max(500).optional(),
});

// POST /api/reports — 신고 접수
router.post('/', requireAuth, validate(createReportSchema), async (req: AuthRequest, res: Response) => {
  try {
    const reporterId = req.user!.id;
    const { targetType, targetId, reason, description } = req.body;

    const [report] = await db.insert(reports).values({
      reporterId,
      targetType,
      targetId,
      reason,
      description: description || null,
    }).returning();

    res.status(201).json(report);
  } catch (err) {
    console.error('신고 접수 오류:', err);
    res.status(500).json({ error: '신고 접수에 실패했습니다.' });
  }
});

// GET /api/reports/reasons — 신고 사유 목록
router.get('/reasons', (_req, res: Response) => {
  res.json({ reasons: REPORT_REASONS });
});

export default router;
