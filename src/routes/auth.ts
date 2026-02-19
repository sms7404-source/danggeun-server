import { Router, Response } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AuthRequest } from '../types';

const router = Router();

// 프로필 생성 스키마
const createProfileSchema = z.object({
  nickname: z.string().min(2, '닉네임은 2자 이상이어야 합니다.').max(20, '닉네임은 20자 이하여야 합니다.'),
});

// 프로필 수정 스키마
const updateProfileSchema = z.object({
  nickname: z.string().min(2).max(20).optional(),
  profileImage: z.string().nullable().optional(),
  regionId: z.number().int().positive().nullable().optional(),
});

// POST /api/auth/profile — 프로필 생성 (가입 직후)
router.post('/profile', requireAuth, validate(createProfileSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { nickname } = req.body;
    const userId = req.user!.id;

    // 이미 프로필이 있는지 확인
    const existing = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: '이미 프로필이 존재합니다.' });
      return;
    }

    // 닉네임 중복 확인
    const nicknameExists = await db.select().from(users).where(eq(users.nickname, nickname)).limit(1);
    if (nicknameExists.length > 0) {
      res.status(409).json({ error: '이미 사용 중인 닉네임입니다.' });
      return;
    }

    const [newUser] = await db.insert(users).values({
      id: userId,
      nickname,
    }).returning();

    res.status(201).json(newUser);
  } catch (err) {
    console.error('프로필 생성 오류:', err);
    res.status(500).json({ error: '프로필 생성에 실패했습니다.' });
  }
});

// GET /api/auth/profile — 내 프로필 조회
router.get('/profile', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const [profile] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!profile) {
      res.status(404).json({ error: '프로필을 찾을 수 없습니다.' });
      return;
    }

    res.json(profile);
  } catch (err) {
    console.error('프로필 조회 오류:', err);
    res.status(500).json({ error: '프로필 조회에 실패했습니다.' });
  }
});

// PUT /api/auth/profile — 프로필 수정
router.put('/profile', requireAuth, validate(updateProfileSchema), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const updates = req.body;

    // 닉네임 변경 시 중복 확인
    if (updates.nickname) {
      const nicknameExists = await db.select().from(users)
        .where(eq(users.nickname, updates.nickname)).limit(1);
      if (nicknameExists.length > 0 && nicknameExists[0].id !== userId) {
        res.status(409).json({ error: '이미 사용 중인 닉네임입니다.' });
        return;
      }
    }

    const [updated] = await db.update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: '프로필을 찾을 수 없습니다.' });
      return;
    }

    res.json(updated);
  } catch (err) {
    console.error('프로필 수정 오류:', err);
    res.status(500).json({ error: '프로필 수정에 실패했습니다.' });
  }
});

export default router;
