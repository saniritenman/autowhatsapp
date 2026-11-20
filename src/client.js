import {createClient} from '@supabase/supabase-js';
import config from './config.json';
export const db=createClient(config.url,config.key);
