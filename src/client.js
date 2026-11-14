import { createClient } from '@supabase/supabase-js';
import config from './config.json';
const url=import.meta.env.VITE_SUPABASE_URL||config.url;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||config.key;
export const configured=!!(url && key);
export const db=configured?createClient(url,key):null;
