# COLORJET Supabase Mobile Setup

Use only the Supabase Project URL and Publishable key in the Expo mobile app.

```env
EXPO_PUBLIC_SUPABASE_URL=https://ljcuhwcyeijfiwpbkdsn.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=replace_with_publishable_key
```

Never commit a service-role key, database password, or any private credential to GitHub, the mobile APK, or frontend source code.

The app must authenticate staff through Supabase Auth and rely on RLS policies for database access.
