// Supabase URL and publishable key are public client configuration, protected by
// Supabase Auth + Row Level Security. Vercel environment variables override these
// fallbacks in Preview/Production whenever they are configured.
const fallbackSupabaseUrl = 'https://ljcuhwcyeijfiwpbkdsn.supabase.co';
const fallbackSupabasePublishableKey = 'sb_publishable_zBx0iAibiz8HyiemgX074A_UtiCkU43';
const fallbackAuthRedirectUrl = 'https://colorjet-management-suite-colorjet-pro.vercel.app';

export const productionConfig = {
  supabaseUrl: (process.env.EXPO_PUBLIC_SUPABASE_URL ?? fallbackSupabaseUrl).replace(/\/$/, ''),
  supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? fallbackSupabasePublishableKey,
  authRedirectUrl: (process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL ?? fallbackAuthRedirectUrl).replace(/\/$/, ''),
};

export function isProductionConfigured(): boolean {
  return Boolean(productionConfig.supabaseUrl && productionConfig.supabasePublishableKey);
}
