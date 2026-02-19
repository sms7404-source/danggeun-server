import { Router, Response } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../utils/supabase';
import { AuthRequest } from '../types';

const router = Router();

// multer 메모리 스토리지 (파일을 버퍼로 받기)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 10,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'));
    }
  },
});

// POST /api/upload/images — 이미지 업로드 (최대 10장)
router.post('/images', requireAuth, upload.array('images', 10), async (req: AuthRequest, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({ error: '업로드할 이미지가 없습니다.' });
      return;
    }

    const uploadPromises = files.map(async (file) => {
      const ext = file.originalname.split('.').pop() || 'jpg';
      const fileName = `products/${randomUUID()}.${ext}`;

      const { error } = await supabaseAdmin.storage
        .from('images')
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (error) {
        throw new Error(`이미지 업로드 실패: ${error.message}`);
      }

      const { data: { publicUrl } } = supabaseAdmin.storage
        .from('images')
        .getPublicUrl(fileName);

      return publicUrl;
    });

    const urls = await Promise.all(uploadPromises);
    res.json({ urls });
  } catch (err: any) {
    console.error('이미지 업로드 오류:', err);
    res.status(500).json({ error: err.message || '이미지 업로드에 실패했습니다.' });
  }
});

export default router;
