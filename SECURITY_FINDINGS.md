# Security Findings

- No secret value was added to source control.
- Release signing uses GitHub Secrets only.
- Production service-role keys and database passwords must never use `EXPO_PUBLIC_*` names.
- Supabase public/publishable key is client-visible by design; authorization must rely on Row Level Security.
- Firebase service account private keys, if introduced, must remain backend-only.
- The Android release job runs only for version tags and cannot succeed without signing secrets.
- Existing logo/image assets were not replaced or regenerated.
