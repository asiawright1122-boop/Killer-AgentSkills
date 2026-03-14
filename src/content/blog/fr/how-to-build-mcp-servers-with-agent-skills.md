---
title: "Comment créer des serveurs MCP : Un guide complet utilisant les compétences Agent"
description: "Créez des serveurs MCP complets pour les agents IA avec mcp-builder. Découvrez la configuration, la conception d'outils, les tests et le déploiement avec T"
pubDate: 2026-02-13
author: "Killer-Skills Team"
tags: ["MCP", "Tutorial", "Agent Skills", "Claude Code"]
lang: "fr"
featured: false
category: "developer-experience"
heroImage: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=2560&auto=format&fit=crop"
---
# Comment construire des serveurs MCP que les agents IA utilisent réellement

Qu'est-ce qui se passerait si votre agent de codage IA pouvait faire plus que simplement écrire du code ? Qu'est-ce qui se passerait si il pouvait envoyer des messages Slack, interroger des bases de données, déployer en production et gérer l'ensemble de votre pipeline DevOps — le tout via un protocole standardisé ?

C'est exactement ce que les **serveurs MCP** (Protocole de contexte de modèle) rendent possible. Et avec la compétence officielle **mcp-builder** du référentiel de compétences d'Anthropic, vous pouvez construire des serveurs MCP de production en quelques minutes au lieu de plusieurs heures.

```bash
# Installez la compétence mcp-builder avec une seule commande
npx killer-skills add anthropics/skills/mcp-builder
```

Dans ce guide, vous apprendrez tout ce que vous devez savoir sur la construction de serveurs MCP — desde la compréhension du protocole jusqu'au déploiement de votre premier serveur.
## Qu'est-ce qu'un serveur MCP ?

Un **serveur MCP** est un service standardisé qui expose des outils, des ressources et des invites pour que les agents IA les consomment. Pensez-y comme un pont entre votre assistant IA et le monde réel — bases de données, API, systèmes de fichiers, services cloud, et plus.

Le **Protocole de contexte de modèle** (MCP) a été créé par Anthropic pour résoudre un problème fondamental : les agents IA ont besoin d'un moyen universel pour interagir avec des services externes. Avant MCP, chaque intégration nécessitait un code personnalisé. Maintenant, un seul protocole gère tout.

Voici pourquoi MCP compte :

- **Compatibilité universelle** — Fonctionne avec Claude, Cursor, Windsurf, et tout client compatible MCP
- **Interface standardisée** — Outils, ressources et invites suivent un schéma cohérent
- **Conception sécurisée** — Authentification intégrée, validation des entrées et contrôles de permissions
- **Workflows composables** — Les agents peuvent enchaîner plusieurs outils MCP ensemble
## Pourquoi utiliser la compétence mcp-builder ?

La compétence **mcp-builder** est l'une des compétences les plus puissantes du référentiel officiel d'Anthropic. Elle transforme Claude en développeur de serveur MCP spécialisé en fournissant :

1. **Connaissances approfondies du protocole** — La compétence charge la spécification complète du MCP afin que Claude comprenne chaque détail
2. **Meilleures pratiques intégrées** — Le nommage des outils, la gestion des erreurs et les modèles de pagination sont tous préconfigurés
3. **Guides spécifiques au framework** — Modèles optimisés pour TypeScript et Python
4. **Génération d'évaluations** — Crée automatiquement des suites de tests pour votre serveur MCP

Contrairement à une construction à partir de zéro, la compétence mcp-builder suit un flux de travail structuré en 4 phases :

| Phase | Ce qui se passe |
|:------|:-------------|
| **Phase 1 : Recherche** | Étudie l'API, planifie la couverture des outils, conçoit le schéma |
| **Phase 2 : Construction** | Implémente le serveur avec une gestion des erreurs et une authentification appropriées |
| **Phase 3 : Révision** | Teste tous les outils, valide les réponses, vérifie les cas limites |
| **Phase 4 : Évaluation** | Crée des évaluations automatisées pour vérifier la qualité |
## Premiers Pas : Créez Votre Premier Serveur MCP

### Étape 1 : Installer la Compétence

Tout d'abord, assurez-vous d'avoir installé l'interface de ligne de commande Killer-Skills :

```bash
npm install -g killer-skills
```

Ensuite, ajoutez la compétence mcp-builder à votre projet :

```bash
npx killer-skills add anthropics/skills/mcp-builder
```

La compétence sera ajoutée à votre répertoire `.claude/skills/` et activée automatiquement lorsque Claude détecte des tâches de développement de serveur MCP.

### Étape 2 : Choisissez Votre Stack

La compétence mcp-builder prend en charge deux stacks principales :

**TypeScript (Recommandé)**
```bash
npm init -y
npm install @modelcontextprotocol/sdk zod
```

TypeScript est recommandé pour plusieurs raisons :
- Une prise en charge de haute qualité de l'SDK officiel de l'équipe MCP
- La saisie statique des erreurs détecte les erreurs avant l'exécution
- Une forte compatibilité avec les environnements d'exécution
- Les modèles d'IA excellent pour générer du code TypeScript

**Python**
```bash
pip install mcp pydantic
```

Python est un excellent choix si votre équipe utilise déjà Python ou que vous intégrez avec des API lourdes en Python.

### Étape 3 : Définissez Vos Outils

La clé d'un excellent serveur MCP réside dans des outils bien conçus. Voici un modèle :

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
  name: "my-api-server",
  version: "1.0.0",
});

server.tool(
  "create_item",
  "Crée un nouvel élément dans le système",
  {
    name: z.string().describe("Nom de l'élément à créer"),
    description: z.string().optional().describe("Description facultative"),
    tags: z.array(z.string()).optional().describe("Étiquettes pour la catégorisation"),
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

### Étape 4 : Mettre en Œuvre les Meilleures Pratiques

La compétence mcp-builder impose plusieurs modèles critiques :

**Convention de Nommage des Outils**
```
✅ github_create_issue
✅ slack_send_message
✅ db_query_users

❌ createIssue
❌ send
❌ doStuff
```

Utilisez des préfixes cohérents (nom du service) + verbes orientés vers l'action. Cela aide les agents à découvrir et sélectionner rapidement les bons outils.

**Messages d'Erreur Actionnables**
```typescript
// ❌ Mauvais
throw new Error("Non trouvé");

// ✅ Bon
throw new Error(
  `Référentiel "${owner}/${repo}" non trouvé. ` +
  `Vérifiez que le référentiel existe et que vous avez accès. ` +
  `Essayez de lister vos référentiels d'abord avec github_list_repos.`
);
```

**Annotations des Outils**

Chaque outil doit inclure des annotations qui aident les agents à comprendre leur comportement :

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
## Exemple Réel : Création d'un Serveur MCP GitHub

Commençons par un exemple réaliste. Supposons que vous vouliez créer un serveur MCP qui permet aux agents IA de gérer des référentiels GitHub.

**Demandez à Claude avec la compétence mcp-builder active :**

> "Créez-moi un serveur MCP pour l'API GitHub. Il devrait prendre en charge la création de problèmes, la liste des référentiels, la gestion des demandes de tirage et la recherche de code."

Claude va :
1. Rechercher la documentation de l'API REST GitHub
2. Planifier quels points de terminaison couvrir (typiquement 15-25 outils)
3. Construire le serveur complet avec une authentification OAuth appropriée
4. Générer des évaluations de test pour chaque outil

Le résultat est un serveur prêt pour la production avec une gestion d'erreurs appropriée, une pagination, une limitation de débit et une authentification — quelque chose qui prendrait normalement des jours à construire manuellement.
## Principes de conception clés pour les serveurs MCP

### Couverture de l'API vs. Outils de workflow

La compétence mcp-builder enseigne un équilibre important :

- **Couverture complète** donne aux agents la flexibilité de composer des opérations
- **Outils de workflow** regroupent des opérations multi-étapes courantes en appels uniques
- Lorsque vous êtes incertain, priorisez la couverture complète de l'API

### Gestion du contexte

Les agents fonctionnent mieux avec des données ciblées et pertinentes :

- Renvoyez uniquement les champs dont les agents ont besoin, et non les réponses API complètes
- Prenez en charge la pagination pour les opérations de liste
- Incluez des filtres pour restreindre les résultats

### Tests et évaluation

La compétence mcp-builder génère des évaluations automatisées qui testent :

- **Chemin heureux** — Fonctionnement normal avec des entrées valides
- **Cas limites** — Résultats vides, grands ensembles de données, caractères spéciaux
- **Gestion des erreurs** — Entrées invalides, échecs d'authentification, limites de débit
- **Scénarios du monde réel** — Workflows multi-étapes qui enchaînent des outils ensemble
## Installation via Killer-Skills

Le moyen le plus rapide pour commencer est de passer par le marché Killer-Skills :

```bash
# Browse the official skills
npx killer-skills search mcp

# Install mcp-builder
npx killer-skills add anthropics/skills/mcp-builder

# Verify installation
npx killer-skills list
```

Une fois installé, la compétence est automatiquement disponible dans Claude Code, Claude.ai et toute intégration d'API Claude. Il suffit de commencer une conversation sur la construction d'un serveur MCP et Claude chargera les instructions de la compétence.
## Qu'est-ce qui vient ensuite ?

Les serveurs MCP deviennent la norme pour les interactions entre les agents IA et le monde. Avec la compétence mcp-builder, vous n'avez pas besoin d'être un expert du protocole MCP — Claude gère la complexité tandis que vous vous concentrez sur ce que votre serveur devrait faire.

Prêt à créer votre premier serveur MCP ? Voici comment commencer aujourd'hui :

1. **Installez la compétence** : `npx killer-skills add anthropics/skills/mcp-builder`
2. **Choisissez votre API** : Sélectionnez un service que vous souhaitez intégrer (Slack, Notion, JIRA, etc.)
3. **Décrivez vos besoins** : Dites à Claude quels outils vous nécessitez, et il créera l'ensemble du serveur
4. **Déployez et testez** : Utilisez les évaluations générées pour valider votre serveur

Le futur du développement IA n'est pas à propos d'écrire plus de code — c'est à propos de donner aux agents IA les bons outils pour travailler. Les serveurs MCP et les compétences d'agent rendent ce futur possible aujourd'hui.

---

*Vous souhaitez explorer plus de compétences ? Parcourez le [Marché des compétences Killer-Skills](https://killer-skills.com/fr/skills) pour découvrir des centaines de compétences d'agent vérifiées pour votre flux de travail de codage IA.*

---

*Liens liés : [Qu'est-ce que les compétences d'agent IA ?](/fr/blog/what-are-ai-agent-skills) et [Meilleures compétences d'agent IA pour 2026](/fr/blog/best-ai-agent-skills-2026)*