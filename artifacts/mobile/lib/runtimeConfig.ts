const fallbackAuthRedirectUrl = 'https://colorjet-management-suite-git-supabase-prod-3ef3c0-colorjet-pro.vercel.app';

export const productionConfig = {
  supabaseUrl: (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, ''),
  supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
  authRedirectUrl: (process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL ?? fallbackAuthRedirectUrl).replace(/\/$/, ''),
};

export function isProductionConfigured(): boolean {
  return Boolean(productionConfig.supabaseUrl && productionConfig.supabasePublishableKey);
}
