// Public client configuration. Secret keys must never be embedded in the APK.
// The cPanel/PHP REST API is the primary integration endpoint for hosting-backed
// business forms. Existing Supabase Auth/RLS remains available for the current
// production modules while the hosting API receives the same authenticated JWT.
const fallbackSupabaseUrl = 'https://ljcuhwcyeijfiwpbkdsn.supabase.co';
const fallbackSupabasePublishableKey = 'sb_publishable_zBx0iAibiz8HyiemgX074A_UtiCkU43';
const fallbackAuthRedirectUrl = 'https://colorjet-management-suite-colorjet-pro.vercel.app';
const fallbackErpApiBaseUrl = 'https://erp.colorjetbd.com/api/v1';

export const productionConfig = {
  supabaseUrl: (process.env.EXPO_PUBLIC_SUPABASE_URL ?? fallbackSupabaseUrl).replace(/\/$/, ''),
  supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? fallbackSupabasePublishableKey,
  authRedirectUrl: (process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL ?? fallbackAuthRedirectUrl).replace(/\/$/, ''),
  erpApiBaseUrl: (process.env.EXPO_PUBLIC_ERP_API_BASE_URL ?? fallbackErpApiBaseUrl).replace(/\/$/, ''),
};

export function isProductionConfigured(): boolean {
  return Boolean(productionConfig.supabaseUrl && productionConfig.supabasePublishableKey);
}

export function isHostingApiConfigured(): boolean {
  return /^https:\/\//i.test(productionConfig.erpApiBaseUrl);
}
