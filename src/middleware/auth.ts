import { Response, NextFunction } from 'express';
import { supabaseAdmin } from '../utils/supabase';
import { AuthRequest } from '../types';

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: '인증 토큰이 필요합니다.' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
      return;
    }

    req.user = { id: user.id, email: user.email! };
    next();
  } catch (err) {
    res.status(401).json({ error: '인증 처리 중 오류가 발생했습니다.' });
  }
};
