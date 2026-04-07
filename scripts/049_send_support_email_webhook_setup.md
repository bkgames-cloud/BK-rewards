## Mise en place Edge Function `send-support-email`

### 1) Déployer la fonction
- Dossier : `supabase/functions/send-support-email/index.ts`
- Variables à définir dans Supabase (Project Settings → Functions → Secrets) :
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `RESEND_API_KEY`

Déploiement (CLI Supabase) :

```bash
supabase functions deploy send-support-email
```

### 2) Créer le Database Webhook (Dashboard Supabase)
- Aller dans **Database → Webhooks**
- **Create webhook**
  - **Name** : `support_messages_insert_send_email`
  - **Table** : `support_messages`
  - **Events** : `INSERT`
  - **Type** : `Supabase Edge Function`
  - **Function** : `send-support-email`

### 3) Comportement attendu
- L’app (export statique) fait seulement l’INSERT dans `support_messages`.
- Le webhook déclenche l’Edge Function.
- La fonction :
  - relit la ligne via service role,
  - envoie l’email via Resend vers `support.bkgamers@gmail.com`,
  - met à jour `support_messages.resend_sent` / `support_messages.resend_error`.

