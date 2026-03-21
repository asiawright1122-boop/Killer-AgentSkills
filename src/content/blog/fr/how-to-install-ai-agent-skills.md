---
title: "Comment installer des compétences d'agent IA en 30 secondes"
description: "Un guide rapide pour installer des compétences d'agent IA communautaires dans Claude Code, Cursor ou Windsurf en utilisant l'outil CLI killer-skills."
pubDate: 2026-02-24
author: 'Killer-Skills Team'
tags: ['Tutorial', 'AI Agent Skills', 'CLI', 'Developer Tools', 'Automation']
lang: 'fr'
featured: false
category: 'guides'
heroImage: 'https://images.unsplash.com/photo-1629654297299-c8506221ca97?q=80&w=2560&auto=format&fit=crop'
---

# Comment installer les compétences d'agent IA

Vous avez trouvé une compétence d'agent IA que vous souhaitez utiliser. Peut-être s'agit-il de la [compétence d'automatisation docx](/fr/skills/anthropics/skills/docx), ou peut-être d'un générateur d'interface utilisateur frontend spécialisé. Maintenant, vous devez l'intégrer dans votre projet afin que votre agent de codage puisse réellement le lire.

Vous pouvez copier et coller manuellement le texte markdown, créer les répertoires appropriés et corriger le formatage du frontmatter vous-même. Ou vous pouvez exécuter une commande qui le fait pour vous.

## L'outil en ligne de commande killer-skills

Nous avons créé un outil en ligne de commande spécifiquement pour cela. Il gère la récupération de la compétence depuis GitHub, la conversion au bon format pour votre IDE (Claude Code, Cursor, Windsurf ou GitHub Copilot) et la place dans le répertoire correct.

Vous n'avez pas besoin de l'installer de manière permanente. Vous pouvez l'exécuter directement via `npx` (qui vient avec Node.js).

Ouvrez votre terminal, accédez à votre répertoire de projet et exécutez :

```bash
npx killer-skills add owner/repo
```

Par exemple, pour installer la compétence d'automatisation de PDF, vous exécutez :

```bash
npx killer-skills add anthropics/skills/pdf
```

L'outil en ligne de commande détecte quel IDE vous utilisez en regardant vos fichiers de projet. Si cela voit un répertoire `.cursor`, il formate la compétence sous forme de fichier `.mdc`. Si cela voit un répertoire `.claude`, il la formate sous forme de `SKILL.md`.

## Installation sur plusieurs IDE

Si vous utilisez plusieurs agents sur le même projet (par exemple, Claude Code dans le terminal et Cursor comme éditeur), vous pouvez forcer la CLI à installer la compétence pour tous en même temps.

Il suffit d'ajouter le drapeau `--all` :

```bash
npx killer-skills add anthropics/skills/pdf --all
```

Cela crée les fichiers nécessaires à la fois dans `.claude/skills/` et `.cursor/rules/`, en gardant les instructions de base identiques tout en formattant les métadonnées correctement pour chaque agent.

## Recherche de compétences à installer

Si vous savez ce que vous cherchez mais n'avez pas retenu le chemin de dépôt exact, vous pouvez effectuer une recherche directement depuis votre terminal :

```bash
npx killer-skills search auth
```

Ceci interroge la base de données de la communauté et retourne les meilleures correspondances, y compris leurs comptes d'étoiles et les chemins d'installation complets. Vous pouvez également parcourir le répertoire open-source complet sur le site [Killer-Skills](/fr/skills).

## Maintenir les compétences à jour

Les compétences évoluent. Les auteurs ajoutent de nouveaux cas limites, corrigent les mauvaises instructions et améliorent la fiabilité des invites. Puisque vous avez installé la compétence via la CLI, vous pouvez la mettre à jour tout aussi facilement.

```bash
npx killer-skills update
```

Ceci vérifie toutes les compétences que vous avez installées, les compare à la source en amont sur GitHub, et applique les mises à jour tout en préservant les modifications locales lorsque cela est possible.

## Qu'est-ce qui se passe réellement sous le capot ?

Lorsque vous exécutez la commande `add`, la CLI n'installe pas de logiciels exécutables ou de dépendances npm. Elle télécharge simplement du texte.

Une compétence est simplement un fichier markdown contenant des instructions pour un Grand Modèle de Langage. La CLI récupère ce markdown, l'entoure du format YAML ou JSON spécifique attendu par votre éditeur, et l'écrit dans un dossier local.

Il n'y a pas de processus en arrière-plan, pas de télémétrie de rappel, et pas de charges utiles cachées. Il s'agit simplement de documentation, placée exactement où votre agent IA sait où la trouver.

---

_Liens associés : [Qu'est-ce qu'une compétence d'agent IA ?](/fr/blog/what-are-ai-agent-skills) et [Meilleures compétences d'agent IA pour 2026](/fr/blog/best-ai-agent-skills-2026)_
