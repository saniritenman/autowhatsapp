import { createClient } from '@supabase/supabase-js';
import { createGateway } from './handler.ts';
const env = (name: string) => Deno.env.get(name) || '';
const secret = env('SUPABASE_SECRET_KEYS')
  ? JSON.parse(env('SUPABASE_SECRET_KEYS')).default
  : env('SUPABASE_SERVICE_ROLE_KEY');
const db = createClient(env('SUPABASE_URL'), secret);
// JWT verification is replaced by a 256-bit revocable computer token.
// Its SHA-256 hash is looked up server-side; every operation is scoped to its owner.
Deno.serve(createGateway(db));
