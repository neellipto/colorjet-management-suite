import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { isProductionConfigured, productionConfig } from '@/lib/runtimeConfig';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isProductionConfigured()) {
    throw new Error('Production connection is not configured.');
  }

  if (!client) {
    client = createClient(
      productionConfig.supabaseUrl,
      productionConfig.supabasePublishableKey,
      {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: Platform.OS === 'web',
        },
      },
    );
  }

  return client;
}
