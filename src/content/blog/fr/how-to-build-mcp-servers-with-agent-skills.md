---
title: "Comment construire des serveurs MCP : Guide complet avec les Agent Skills"
description: "Apprenez à construire des serveurs MCP prêts pour la production pour les agents IA en utilisant la skill officielle mcp-builder. Couvre la configuration, la conception d'outils, les tests et le déploiement avec TypeScript et Python."
pubDate: 2026-02-13
author: "Équipe Killer-Skills"
tags: ["MCP", "Tutoriel", "Agent Skills", "Claude Code"]
lang: "fr"
featured: false
category: "developer-experience"
heroImage: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=2560&auto=format&fit=crop"
---

# Comment construire des serveurs MCP que les agents IA utilisent réellement

Et si votre agent de codage IA pouvait faire plus que simplement écrire du code ? S'il pouvait envoyer des messages Slack, interroger des bases de données, déployer en production et gérer l'ensemble de votre pipeline DevOps — tout cela via un protocole standardisé ?

C'est exactement ce que les **serveurs MCP** (Model Context Protocol) permettent de faire. Et avec la skill officielle **mcp-builder** du dépôt d'Anthropic, vous pouvez construire des serveurs MCP de qualité production en quelques minutes au lieu de plusieurs heures.

```bash
# Installez la skill mcp-builder en une commande
npx killer-skills add anthropics/skills/mcp-builder
```

Dans ce guide, vous apprendrez tout ce que vous devez savoir sur la construction de serveurs MCP — de la compréhension du protocole au déploiement de votre premier serveur.

## Qu'est-ce qu'un serveur MCP ?

Un **serveur MCP** est un service standardisé qui expose des outils, des ressources et des messages pour les agents IA. Considérez-le comme un pont entre votre assistant IA et le monde réel — bases de données, API, systèmes de fichiers, services cloud, etc.

Le **Model Context Protocol** (MCP) a été créé par Anthropic pour résoudre un problème fondamental : les agents IA ont besoin d'un moyen universel d'interagir avec les services externes. Avant le MCP, chaque intégration nécessitait du code personnalisé. Désormais, un protocole unique gère tout.

Voici pourquoi le MCP est important :

-   **Compatibilité universelle** — Fonctionne avec Claude, Cursor, Windsurf et n'importe quel client compatible MCP.
-   **Interface standardisée** — Les outils, ressources et messages suivent un schéma cohérent.
-   **Conception axée sur la sécurité** — Authentification intégrée, validation des entrées et contrôle des permissions.
-   **Workflows composables** — Les agents peuvent enchaîner plusieurs outils MCP.

## Pourquoi utiliser la skill mcp-builder ?

La skill **mcp-builder** est l'une des plus puissantes du dépôt officiel d'Anthropic. Elle transforme Claude en un développeur spécialisé dans les serveurs MCP en fournissant :

1.  **Connaissance approfondie du protocole** — La skill charge la spécification complète du MCP afin que Claude en comprenne chaque détail.
2.  **Meilleures pratiques intégrées** — Le nommage des outils, la gestion des erreurs et les modèles de pagination sont pré-configurés.
3.  **Guides par framework** — Des modèles optimisés pour TypeScript et Python.
4.  **Génération d'évaluations** — Crée automatiquement des suites de tests pour votre serveur MCP.

Contrairement à une construction à partir de zéro, la skill mcp-builder suit un workflow structuré en 4 phases :

| Phase | Ce qui se passe |
|:------|:-------------|
| **Phase 1: Recherche** | Étudie l'API, planifie la couverture des outils, conçoit le schéma. |
| **Phase 2: Construction** | Implémente le serveur avec une gestion des erreurs et une authentification appropriées. |
| **Phase 3: Révision** | Teste tous les outils, valide les réponses, vérifie les cas limites. |
| **Phase 4: Évaluation** | Crée des évaluations automatisées pour vérifier la qualité. |

## Guide de démarrage : Construisez votre premier serveur MCP

### Étape 1 : Installer la skill

Tout d'abord, assurez-vous d'avoir installé la CLI Killer-Skills :

```bash
npm install -g killer-skills
```

Ensuite, ajoutez la skill mcp-builder à votre projet :

```bash
npx killer-skills add anthropics/skills/mcp-builder
```

La skill sera ajoutée à votre répertoire `.claude/skills/` et activée automatiquement lorsque Claude détectera des tâches de développement de serveur MCP.

### Étape 2 : Choisir votre stack

La skill mcp-builder prend en charge deux stacks principaux :

**TypeScript (Recommandé)**
```bash
npm init -y
npm install @modelcontextprotocol/sdk zod
```

TypeScript est recommandé pour plusieurs raisons :
-   Support SDK de haute qualité de l'équipe officielle MCP.
-   Le typage statique détecte les erreurs avant l'exécution.
-   Forte compatibilité avec les environnements d'exécution.
-   Les modèles d'IA excellent dans la génération de code TypeScript.

**Python**
```bash
pip install mcp pydantic
```

Python est un excellent choix si votre équipe utilise déjà Python ou si vous intégrez des API fortement basées sur Python.

### Étape 3 : Définir vos outils

La clé d'un excellent serveur MCP réside dans des outils bien conçus. Voici un modèle :

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
  name: "mon-serveur-api",
  version: "1.0.0",
});

server.tool(
  "create_item",
  "Crée un nouvel élément dans le système",
  {
    name: z.string().describe("Nom de l'élément à créer"),
    description: z.string().optional().describe("Description facultative"),
    tags: z.array(z.string()).optional().describe("Tags pour la catégorisation"),
  },
  async ({ name, description, tags }) => {
    const result = await api.createItem({ name, description, tags });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);
```

### Étape 4 : Implémenter les meilleures pratiques

La skill mcp-builder impose plusieurs patterns critiques :

**Convention de nommage des outils**
```
✅ github_create_issue
✅ slack_send_message
✅ db_query_users

❌ createIssue
❌ send
❌ doStuff
```

Utilisez des préfixes cohérents (nom du service) + des verbes orientés action. Cela aide les agents à découvrir et à sélectionner rapidement les bons outils.

**Messages d'erreur exploitables**
```typescript
// ❌ Mauvais
throw new Error("Not found");

// ✅ Bon
throw new Error(
  `Dépôt "${owner}/${repo}" non trouvé. ` +
  `Vérifiez que le dépôt existe et que vous y avez accès. ` +
  `Essayez de lister vos dépôts d'abord avec github_list_repos.`
);
```

**Annotations d'outils**

Chaque outil doit inclure des annotations qui aident les agents à comprendre son comportement :

```typescript
server.tool(
  "delete_item",
  "Supprime définitivement un élément",
  { id: z.string() },
  async ({ id }) => { /* ... */ },
  {
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    }
  }
);
```

## Exemple concret : Construire un serveur MCP GitHub

Voyons un exemple réaliste. Supposons que vous souhaitiez construire un serveur MCP qui permette aux agents IA de gérer des dépôts GitHub.

**Demandez à Claude avec la skill mcp-builder active :**

> "Construis-moi un serveur MCP pour l'API GitHub. Il doit prendre en charge la création d'issues, la liste des dépôts, la gestion des pull requests et la recherche de code."

Claude va :
1.  Rechercher la documentation de l'API REST de GitHub.
2.  Planifier les endpoints à couvrir (généralement 15-25 outils).
3.  Construire le serveur complet avec une authentification OAuth appropriée.
4.  Générer des évaluations de test pour chaque outil.

Le résultat est un serveur prêt pour la production avec une gestion appropriée des erreurs, de la pagination, des limites de débit et de l'authentification — ce qui prendrait normalement des jours à construire manuellement.

## Principes de conception clés pour les serveurs MCP

### Couverture API vs Outils de workflow

La skill mcp-builder enseigne un équilibre important :

-   **Une couverture complète** donne aux agents la flexibilité de composer des opérations.
-   **Les outils de workflow** regroupent des opérations multi-étapes courantes en un seul appel.
-   En cas de doute, donnez la priorité à une couverture API complète.

### Gestion du contexte

Les agents fonctionnent mieux avec des données ciblées et pertinentes :

-   Ne retournez que les champs dont les agents ont besoin, pas l'intégralité des réponses de l'API.
-   Prenez en charge la pagination pour les opérations de liste.
-   Incluez des filtres pour affiner les résultats.

### Tests et évaluation

La skill mcp-builder génère des évaluations automatisées qui testent :

-   **Le chemin nominal** — Fonctionnement normal avec des entrées valides.
-   **Les cas limites** — Résultats vides, ensembles de données volumineux, caractères spéciaux.
-   **La gestion des erreurs** — Entrées invalides, échecs d'authentification, limites de débit.
-   **Les scénarios réels** — Workflows multi-étapes qui enchaînent des outils.

## Installation via Killer-Skills

Le moyen le plus rapide de commencer est d'utiliser le marketplace Killer-Skills :

```bash
# Parcourir les skills officielles
npx killer-skills search mcp

# Installer mcp-builder
npx killer-skills add anthropics/skills/mcp-builder

# Vérifier l'installation
npx killer-skills list
```

Une fois installée, la skill est automatiquement disponible dans Claude Code, Claude.ai et toute intégration de l'API Claude. Commencez simplement une conversation sur la construction d'un serveur MCP et Claude chargera les instructions de la skill.

## Et après ?

Les serveurs MCP sont en train de devenir le standard pour permettre aux agents IA d'interagir avec le monde. Avec la skill mcp-builder, vous n'avez pas besoin d'être un expert du protocole MCP — Claude gère la complexité pendant que vous vous concentrez sur ce que votre serveur doit faire.

Prêt à construire votre premier serveur MCP ? Voici comment commencer aujourd'hui :

1.  **Installez la skill** : `npx killer-skills add anthropics/skills/mcp-builder`
2.  **Choisissez votre API** : Choisissez un service que vous souhaitez intégrer (Slack, Notion, JIRA, etc.)
3.  **Décrivez vos besoins** : Dites à Claude de quels outils vous avez besoin, et il construira l'intégralité du serveur.
4.  **Déployez et testez** : Utilisez les évaluations générées pour valider votre serveur.

L'avenir du développement de l'IA ne consiste pas à écrire plus de code, mais à donner aux agents IA les bons outils pour travailler. Les serveurs MCP et les Agent Skills rendent cet avenir possible aujourd'hui.

---

*Vous voulez explorer d'autres skills ? Parcourez le [Marketplace Killer-Skills](https://killer-skills.com/fr/skills) pour découvrir des centaines d'Agent Skills vérifiées pour votre workflow de codage IA.*
