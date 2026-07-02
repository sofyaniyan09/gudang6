import { createClient } from '@supabase/supabase-js';

// Support running without Vite (static server) by falling back to window globals
const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL)
	|| (typeof window !== 'undefined' && (window.VITE_SUPABASE_URL || window.SUPABASE_URL))
	|| "https://ubfseivosripbfongkcp.supabase.co";

const supabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY)
	|| (typeof window !== 'undefined' && (window.VITE_SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY))
	|| "sb_publishable_kabeekdg65dyS86snIaTVA_ihsnp0u1";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
