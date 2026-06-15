# Élan — beta

Ton compagnon santé & bien-être, sans pression. Quatre IA qui t'accompagnent :

- **Le Guide** — le sens, le mental, la réécriture de « santé = punition » en plaisir.
- **Sam** — l'ami passé par le même chemin, qui t'interpelle dans les moments pièges.
- **Le Coach** — sport & nutrition, doux et adaptatif, jamais 6j/7.
- **Le Confident** — il écoute, et ce que tu lui confies adapte le reste.

PWA Next.js installable sur iPhone (Partager → « Sur l'écran d'accueil »).

## Lancer en local

```bash
cd elan
npm install
cp .env.local.example .env.local   # puis colle ta clé ANTHROPIC_API_KEY
npm run dev
```

Ouvre http://localhost:3000 (sur ton téléphone, remplace `localhost` par
l'IP locale de ton Mac, ex. http://192.168.1.20:3000).

## Clé API

Crée une clé sur https://console.anthropic.com/ (Settings → API Keys) et
colle-la dans `.env.local`. Elle reste **côté serveur** — jamais exposée au
navigateur. Modèle utilisé : `claude-opus-4-8`.

## Où vit quoi

- `lib/personas.ts` — l'ADN des 4 compagnons (voix, garde-fous, philosophie
  commune anti-yoyo). C'est le fichier le plus important du projet.
- `app/api/chat/route.ts` — l'API qui parle à Claude (streaming).
- `app/page.tsx` — l'interface mobile (accueil + conversations).

## Limites de la beta

- Pas de compte ni de base de données : les conversations restent en local
  (localStorage) sur l'appareil.
- Le « suivi d'actions » de l'accueil est encore visuel (non connecté).
- Les notifications de Sam (le moment piège de 18h) ne sont pas branchées.
