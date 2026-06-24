export const productionConfig = {
  supabaseUrl: (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, ''),
  supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
};

export function isProductionConfigured(): boolean {
  return Boolean(productionConfig.supabaseUrl && productionConfig.supabasePublishableKey);
}
