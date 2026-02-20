import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/auth';
import regionRoutes from './routes/regions';
import categoryRoutes from './routes/categories';
import productRoutes from './routes/products';
import uploadRoutes from './routes/upload';
import likesRoutes from './routes/likes';
import chatRoutes from './routes/chats';
import userRoutes from './routes/users';
import reviewRoutes from './routes/reviews';
import alertRoutes from './routes/alerts';
import notificationRoutes from './routes/notifications';
import reportRoutes from './routes/reports';
import blockRoutes from './routes/blocks';
import offerRoutes from './routes/offers';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const CLIENT_URLS = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((u) => u.trim());

// Middleware
app.use(helmet());
app.use(cors({ origin: CLIENT_URLS, credentials: true }));
app.use(morgan('dev'));
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/regions', regionRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/likes', likesRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/blocks', blockRoutes);
app.use('/api/offers', offerRoutes);

// Error handler
app.use(errorHandler);

export default app;
