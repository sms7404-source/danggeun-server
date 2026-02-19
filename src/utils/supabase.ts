import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Admin client for JWT verification & Storage
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
