---
title: "Wie man MCP-Server baut: Ein vollständiger Leitfaden mit Agent Skills"
description: "Erfahren Sie, wie Sie mit der offiziellen mcp-builder-Skill produktionsreife MCP-Server für KI-Agenten erstellen. Deckt Setup, Tool-Design, Tests und Deployment mit TypeScript und Python ab."
pubDate: 2026-02-13
author: "Killer-Skills Team"
tags: ["MCP", "Tutorial", "Agent Skills", "Claude Code"]
lang: "de"
featured: false
category: "developer-experience"
heroImage: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=2560&auto=format&fit=crop"
---

# Wie man MCP-Server baut, die KI-Agenten tatsächlich nutzen

Was wäre, wenn Ihr KI-Coding-Agent mehr tun könnte als nur Code zu schreiben? Was wäre, wenn er Slack-Nachrichten senden, Datenbanken abfragen, in die Produktion deployen und Ihre gesamte DevOps-Pipeline verwalten könnte – alles über ein standardisiertes Protokoll?

Genau das machen **MCP-Server** (Model Context Protocol) möglich. Und mit der offiziellen **mcp-builder**-Skill aus dem Anthropic-Skill-Repository können Sie produktionsreife MCP-Server in Minuten statt Stunden erstellen.

```bash
# Installieren Sie die mcp-builder-Skill mit einem Befehl
npx killer-skills add anthropics/skills/mcp-builder
```

In diesem Leitfaden lernen Sie alles, was Sie über den Bau von MCP-Servern wissen müssen – vom Verständnis des Protokolls bis hin zum Deployment Ihres ersten Servers.

## Was ist ein MCP-Server?

Ein **MCP-Server** ist ein standardisierter Dienst, der Tools, Ressourcen und Prompts für KI-Agenten zur Verfügung stellt. Betrachten Sie ihn als Brücke zwischen Ihrem KI-Assistenten und der realen Welt – Datenbanken, APIs, Dateisysteme, Cloud-Dienste und mehr.

Das **Model Context Protocol** (MCP) wurde von Anthropic entwickelt, um ein grundlegendes Problem zu lösen: KI-Agenten benötigen eine universelle Art der Interaktion mit externen Diensten. Vor MCP erforderte jede Integration benutzerdefinierten Code. Jetzt übernimmt ein einziges Protokoll alles.

Hier ist, warum MCP wichtig ist:

-   **Universelle Kompatibilität** – Funktioniert mit Claude, Cursor, Windsurf und jedem MCP-kompatiblen Client.
-   **Standardisierte Schnittstelle** – Tools, Ressourcen und Prompts folgen einem konsistenten Schema.
-   **Security-First Design** – Integrierte Authentifizierung, Eingabe-Validierung und Berechtigungssteuerung.
-   **Kombinierbare Workflows** – Agenten können mehrere MCP-Tools miteinander verknüpfen.

## Warum die mcp-builder-Skill nutzen?

Die **mcp-builder**-Skill ist eine der leistungsstärksten Skills im offiziellen Repository von Anthropic. Sie verwandelt Claude in einen spezialisierten MCP-Server-Entwickler, indem sie Folgendes bietet:

1.  **Tiefes Protokollwissen** – Die Skill lädt die vollständige MCP-Spezifikation, sodass Claude jedes Detail versteht.
2.  **Best Practices inklusive** – Benennung von Tools, Fehlerbehandlung und Paginierungsmuster sind vorkonfiguriert.
3.  **Framework-spezifische Leitfäden** – Optimierte Vorlagen sowohl für TypeScript als auch für Python.
4.  **Generierung von Evaluationen** – Erstellt automatisch Test-Suites für Ihren MCP-Server.

Im Gegensatz zum Aufbau von Grund auf folgt die mcp-builder-Skill einem strukturierten 4-Phasen-Workflow:

| Phase | Was passiert |
|:------|:-------------|
| **Phase 1: Recherche** | Analyse der API, Planung der Tool-Abdeckung, Design des Schemas |
| **Phase 2: Build** | Implementierung des Servers mit korrekter Fehlerbehandlung und Auth |
| **Phase 3: Review** | Testen aller Tools, Validierung der Antworten, Prüfung von Edge-Cases |
| **Phase 4: Evaluierung** | Erstellung automatisierter Tests zur Qualitätssicherung |

## Erste Schritte: Bauen Sie Ihren ersten MCP-Server

### Schritt 1: Skill installieren

Stellen Sie zunächst sicher, dass Sie die Killer-Skills CLI installiert haben:

```bash
npm install -g killer-skills
```

Fügen Sie dann die mcp-builder-Skill zu Ihrem Projekt hinzu:

```bash
npx killer-skills add anthropics/skills/mcp-builder
```

Die Skill wird in Ihr `.claude/skills/`-Verzeichnis hinzugefügt und automatisch aktiviert, wenn Claude MCP-Server-Entwicklungsaufgaben erkennt.

### Schritt 2: Wählen Sie Ihren Stack

Die mcp-builder-Skill unterstützt zwei primäre Stacks:

**TypeScript (Empfohlen)**
```bash
npm init -y
npm install @modelcontextprotocol/sdk zod
```

TypeScript wird aus mehreren Gründen empfohlen:
-   Hochwertige SDK-Unterstützung durch das offizielle MCP-Team.
-   Statische Typisierung fängt Fehler vor der Laufzeit ab.
-   Starke Kompatibilität mit Ausführungsumgebungen.
-   KI-Modelle sind exzellent darin, TypeScript-Code zu generieren.

**Python**
```bash
pip install mcp pydantic
```

Python ist eine gute Wahl, wenn Ihr Team bereits Python nutzt oder Sie in Python-lastige APIs integrieren.

### Schritt 3: Definieren Sie Ihre Tools

Der Schlüssel zu einem großartigen MCP-Server sind gut gestaltete Tools. Hier ist eine Vorlage:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
  name: "mein-api-server",
  version: "1.0.0",
});

server.tool(
  "create_item",
  "Erstellt ein neues Element im System",
  {
    name: z.string().describe("Name des zu erstellenden Elements"),
    description: z.string().optional().describe("Optionale Beschreibung"),
    tags: z.array(z.string()).optional().describe("Tags zur Kategorisierung"),
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

### Schritt 4: Best Practices implementieren

Die mcp-builder-Skill erzwingt mehrere kritische Muster:

**Benennungskonvention für Tools**
```
✅ github_create_issue
✅ slack_send_message
✅ db_query_users

❌ createIssue
❌ send
❌ doStuff
```

Verwenden Sie konsistente Präfixe (Servicename) + aktionsorientierte Verben. Dies hilft Agenten, schnell die richtigen Tools zu finden und auszuwählen.

**Aussagekräftige Fehlermeldungen**
```typescript
// ❌ Schlecht
throw new Error("Not found");

// ✅ Gut
throw new Error(
  `Repository "${owner}/${repo}" nicht gefunden. ` +
  `Prüfen Sie, ob das Repository existiert und Sie Zugriff haben. ` +
  `Versuchen Sie, Ihre Repositories zuerst mit github_list_repos aufzulisten.`
);
```

**Tool-Annotationen**

Jedes Tool sollte Annotationen enthalten, die Agenten helfen, ihr Verhalten zu verstehen:

```typescript
server.tool(
  "delete_item",
  "Löscht ein Element dauerhaft",
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

## Praxisbeispiel: Bau eines GitHub MCP-Servers

Gehen wir ein realistisches Beispiel durch. Angenommen, Sie möchten einen MCP-Server bauen, mit dem KI-Agenten GitHub-Repositories verwalten können.

**Fragen Sie Claude mit aktiver mcp-builder-Skill:**

> "Baue mir einen MCP-Server für die GitHub-API. Er soll das Erstellen von Issues, das Auflisten von Repositories, das Verwalten von Pull Requests und das Durchsuchen von Code unterstützen."

Claude wird:
1.  Die GitHub REST API Dokumentation recherchieren.
2.  Planen, welche Endpunkte abgedeckt werden sollen (typischerweise 15-25 Tools).
3.  Den vollständigen Server mit korrekter OAuth-Authentifizierung bauen.
4.  Test-Evaluationen für jedes Tool generieren.

Das Ergebnis ist ein produktionsreifer Server mit korrekter Fehlerbehandlung, Paginierung, Rate-Limiting und Authentifizierung – etwas, für dessen manuelle Erstellung man normalerweise Tage benötigen würde.

## Kern-Designprinzipien für MCP-Server

### API-Abdeckung vs. Workflow-Tools

Die mcp-builder-Skill lehrt eine wichtige Balance:

-   **Umfassende Abdeckung** gibt Agenten Flexibilität, Operationen zu kombinieren.
-   **Workflow-Tools** bündeln gängige mehrstufige Operationen in einzelnen Aufrufen.
-   Im Zweifelsfall priorisieren Sie eine umfassende API-Abdeckung.

### Kontext-Management

Agenten arbeiten am besten mit fokussierten, relevanten Daten:

-   Geben Sie nur die Felder zurück, die Agenten benötigen, nicht die gesamte API-Antwort.
-   Unterstützen Sie Paginierung für Listen-Operationen.
-   Binden Sie Filter ein, um Ergebnisse einzugrenzen.

### Testen und Evaluierung

Die mcp-builder-Skill generiert automatisierte Evaluationen, die Folgendes testen:

-   **Happy Path** – Normaler Betrieb mit gültigen Eingaben.
-   **Edge Cases** – Leere Ergebnisse, große Datensätze, Sonderzeichen.
-   **Fehlerbehandlung** – Ungültige Eingaben, Authentifizierungsfehler, Rate-Limits.
-   **Real-World-Szenarien** – Mehrstufige Workflows, die Tools miteinander verknüpfen.

## Installation via Killer-Skills

Der schnellste Weg zum Einstieg ist über den Killer-Skills Marketplace:

```bash
# Durchsuchen Sie die offiziellen Skills
npx killer-skills search mcp

# mcp-builder installieren
npx killer-skills add anthropics/skills/mcp-builder

# Installation verifizieren
npx killer-skills list
```

Einmal installiert, ist die Skill automatisch in Claude Code, Claude.ai und jeder Claude-API-Integration verfügbar. Starten Sie einfach ein Gespräch über den Bau eines MCP-Servers und Claude lädt die Anweisungen der Skill.

## Was kommt als Nächstes?

MCP-Server werden zum Standard für die Interaktion von KI-Agenten mit der Welt. Mit der mcp-builder-Skill müssen Sie kein MCP-Protokoll-Experte sein – Claude übernimmt die Komplexität, während Sie sich darauf konzentrieren, was Ihr Server tun soll.

Bereit, Ihren ersten MCP-Server zu bauen? So starten Sie heute:

1.  **Skill installieren**: `npx killer-skills add anthropics/skills/mcp-builder`
2.  **Wählen Sie Ihre API**: Wählen Sie einen Dienst, den Sie integrieren möchten (Slack, Notion, JIRA usw.).
3.  **Beschreiben Sie Ihre Bedürfnisse**: Sagen Sie Claude, welche Tools Sie benötigen, und es baut den gesamten Server.
4.  **Deployment und Test**: Nutzen Sie die generierten Evaluationen, um Ihren Server zu validieren.

Bei der Zukunft der KI-Entwicklung geht es nicht darum, mehr Code zu schreiben – es geht darum, KI-Agenten die richtigen Werkzeuge an die Hand zu geben. MCP-Server und Agent Skills machen diese Zukunft heute möglich.

---

*Möchten Sie mehr Skills erkunden? Besuchen Sie den [Killer-Skills Marketplace](https://killer-skills.com/de/skills), um hunderte verifizierte Agent Skills für Ihren KI-Coding-Workflow zu entdecken.*
