// Public production endpoints for the COLORJET Management Suite.
// Authentication and business data remain protected by Supabase Auth + Row Level Security.
const fallbackPublicAppUrl = 'https://x.ept.com.bd';
const fallbackSupabaseUrl = 'https://ljcuhwcyeijfiwpbkdsn.supabase.co';
const fallbackSupabasePublishableKey = 'sb_publishable_zBx0iAibiz8HyiemgX074A_UtiCkU43';

export const productionConfig = {
  publicAppUrl: (process.env.EXPO_PUBLIC_APP_URL ?? fallbackPublicAppUrl).replace(/\/$/, ''),
  supabaseUrl: (process.env.EXPO_PUBLIC_SUPABASE_URL ?? fallbackSupabaseUrl).replace(/\/$/, ''),
  supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? fallbackSupabasePublishableKey,
  authRedirectUrl: (process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL ?? fallbackPublicAppUrl).replace(/\/$/, ''),
};

export function isProductionConfigured(): boolean {
  return Boolean(
    productionConfig.publicAppUrl &&
    productionConfig.supabaseUrl &&
    productionConfig.supabasePublishableKey
  );
}
