import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Server-side client — used in API routes
// We use the anon key but bypass RLS with service role when needed
export function getServerClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false }
  });
}

// Admin client with service role for privileged operations
export function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRoleKey) {
    return createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });
  }
  // Fallback to regular client if no service role key
  return getServerClient();
}

export const db = getServerClient();
