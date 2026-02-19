import { pgTable, bigserial, text, integer, decimal, boolean, timestamp, uuid, unique } from 'drizzle-orm/pg-core';

// ── 지역 ──
export const regions = pgTable('regions', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  name: text('name').notNull(),
  fullName: text('full_name').notNull(),
  parentId: integer('parent_id'),
  lat: decimal('lat'),
  lng: decimal('lng'),
});

// ── 사용자 프로필 ──
export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  nickname: text('nickname').notNull().unique(),
  profileImage: text('profile_image'),
  regionId: integer('region_id').references(() => regions.id),
  mannerTemp: decimal('manner_temp').default('36.5'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ── 카테고리 ──
export const categories = pgTable('categories', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').default(0),
});

// ── 상품 ──
export const products = pgTable('products', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  sellerId: uuid('seller_id').references(() => users.id).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  price: integer('price'),
  isFree: boolean('is_free').default(false),
  categoryId: integer('category_id').references(() => categories.id),
  status: text('status').default('SALE'),
  regionId: integer('region_id').references(() => regions.id),
  locationText: text('location_text'),
  allowOffer: boolean('allow_offer').default(true),
  viewCount: integer('view_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  bumpedAt: timestamp('bumped_at').defaultNow(),
});

// ── 상품 이미지 ──
export const productImages = pgTable('product_images', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  imageUrl: text('image_url').notNull(),
  displayOrder: integer('display_order').default(0),
});

// ── 찜 (Phase 2) ──
export const likes = pgTable('likes', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  uniqueLike: unique().on(table.userId, table.productId),
}));

// ── 채팅방 (Phase 2) ──
export const chatRooms = pgTable('chat_rooms', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  productId: integer('product_id').references(() => products.id),
  buyerId: uuid('buyer_id').references(() => users.id).notNull(),
  sellerId: uuid('seller_id').references(() => users.id).notNull(),
  lastMessage: text('last_message'),
  lastMessageAt: timestamp('last_message_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  uniqueRoom: unique().on(table.productId, table.buyerId),
}));

// ── 메시지 (Phase 2) ──
export const messages = pgTable('messages', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  chatRoomId: integer('chat_room_id').references(() => chatRooms.id, { onDelete: 'cascade' }).notNull(),
  senderId: uuid('sender_id').references(() => users.id).notNull(),
  content: text('content'),
  imageUrl: text('image_url'),
  type: text('type').default('TEXT'),
  isRead: boolean('is_read').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// ── 거래 후기 (Phase 3) ──
export const reviews = pgTable('reviews', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  reviewerId: uuid('reviewer_id').references(() => users.id).notNull(),
  revieweeId: uuid('reviewee_id').references(() => users.id).notNull(),
  productId: integer('product_id').references(() => products.id),
  isPositive: boolean('is_positive').notNull(),
  tags: text('tags').array().notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  uniqueReview: unique().on(table.reviewerId, table.productId),
}));

// ── 키워드 알림 (Phase 3) ──
export const keywordAlerts = pgTable('keyword_alerts', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  keyword: text('keyword').notNull(),
  regionId: integer('region_id').references(() => regions.id),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// ── 알림 (Phase 3) ──
export const notifications = pgTable('notifications', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  type: text('type').notNull(),
  title: text('title'),
  body: text('body'),
  link: text('link'),
  isRead: boolean('is_read').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// ── 신고 (Phase 3) ──
export const reports = pgTable('reports', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  reporterId: uuid('reporter_id').references(() => users.id).notNull(),
  targetType: text('target_type').notNull(), // PRODUCT | USER
  targetId: text('target_id').notNull(),     // productId or userId
  reason: text('reason').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ── 차단 (Phase 3) ──
export const blocks = pgTable('blocks', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  blockerId: uuid('blocker_id').references(() => users.id).notNull(),
  blockedId: uuid('blocked_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  uniqueBlock: unique().on(table.blockerId, table.blockedId),
}));
