# Déployer Élan sur Vercel (via GitHub)

Trois prérequis (gratuits) : un compte GitHub, un compte Vercel, une clé API
Anthropic (https://console.anthropic.com/ → API Keys).

## 1. Créer le dépôt GitHub

Le plus simple : va sur https://github.com/new, nomme-le `elan`, laisse-le
**vide** (ne coche ni README ni .gitignore), et crée-le.

Puis, depuis le dossier du projet :

```bash
cd ~/elan
git remote add origin https://github.com/TON_PSEUDO/elan.git
git push -u origin main
```

(Si tu préfères en SSH : `git@github.com:TON_PSEUDO/elan.git`.)

## 2. Importer sur Vercel

1. Va sur https://vercel.com/new et connecte ton compte GitHub.
2. Importe le dépôt `elan`. Vercel détecte Next.js tout seul — ne change rien.
3. **Avant de cliquer Deploy**, ouvre « Environment Variables » et ajoute :

   | Name                | Value                                   |
   | ------------------- | --------------------------------------- |
   | `ANTHROPIC_API_KEY` | ta clé `sk-ant-...`                      |
   | `ACCESS_PASSWORD`   | le code d'accès de ton choix            |

4. Clique **Deploy**. Au bout d'une minute tu obtiens une URL `…vercel.app`.

## 3. Utiliser l'app

Ouvre l'URL : tu tombes sur l'écran de code d'accès. Entre ton `ACCESS_PASSWORD`.
Sur ton iPhone, dans Safari : Partager → « Sur l'écran d'accueil » pour
l'installer comme une vraie app.

## Ensuite

- Chaque `git push` sur `main` redéploie automatiquement.
- Surveille ta consommation API sur https://console.anthropic.com/. Le code
  d'accès empêche un usage public, mais garde un œil dessus au début.
- Pour changer le code d'accès : modifie `ACCESS_PASSWORD` dans les réglages
  Vercel (Settings → Environment Variables) puis redéploie.
