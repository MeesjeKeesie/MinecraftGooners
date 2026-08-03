// Centrale plek voor de Supabase-configuratie.
//
// De ANON/"publishable" key hieronder is BEDOELD om openbaar in de
// broncode te staan (net als bij elke Supabase-frontend). Dat is geen
// lek — de echte beveiliging zit in de Row Level Security (RLS)
// policies die in Supabase zelf zijn ingesteld (zie supabase-setup.sql).
const SUPABASE_URL = "https://rgyodowqouaofkmtwpjq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_dWyuf2mJhOtKIYPRQgzXdA_PnBZ3w5N";

// `supabase` hier is de globale variabele die het CDN-script
// (supabase-js) aanmaakt. We geven onze eigen client een andere naam
// (supabaseClient) zodat er geen naamsbotsing ontstaat.
export const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
