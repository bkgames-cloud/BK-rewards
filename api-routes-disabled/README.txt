Routes API Next.js déplacées ici pour permettre `output: export` (build Capacitor / dossier out/).

Remise en place pour Vercel / `next start` :
- Recréer les dossiers sous app/api/ et y recopier chaque route.ts depuis les sous-dossiers (mission-action-claims, delete-account, send-email, admin/winner-email, stripe/portal, verify-google-purchase, winner-email).

Le build mobile (`npm run build:mobile`) ne doit pas contenir de Route Handlers dans app/api.
