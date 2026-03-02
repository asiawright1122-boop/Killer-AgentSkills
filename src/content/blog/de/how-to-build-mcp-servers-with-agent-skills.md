---
title: "So bauen Sie MCP-Server: Ein umfassender Leitfaden mit Agentenfähigkeiten"
description: "Erfahren Sie, wie Sie produktionsbereite MCP-Server für KI-Agents mit der offiziellen mcp-builder-Fähigkeit erstellen. Enthält Einrichtung, Werkzeugdesign, Tests und Deployment mit TypeScript und Python."
pubDate: 2026-02-13
author: "Killer-Skills Team"
tags: ["MCP", "Tutorial", "Agent Skills", "Claude Code"]
lang: "de"
featured: false
category: "developer-experience"
heroImage: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=2560&auto=format&fit=crop"
---
# Wie man MCP-Server erstellt, die von KI-Agents tatsächlich genutzt werden

Was wäre, wenn Ihr KI-Coding-Agent mehr als nur Code schreiben könnte? Was wäre, wenn es Slack-Nachrichten senden, Datenbanken abfragen, in die Produktion deployen und Ihre gesamte DevOps-Pipeline verwalten könnte — all dies über ein standardisiertes Protokoll?

Genau das machen **MCP-Server** (Model Context Protocol) möglich. Und mit dem offiziellen **mcp-builder**-Skill aus Anthropics Skills-Repository können Sie produktionssichere MCP-Server in Minuten statt Stunden erstellen.

```bash
# Installieren Sie den mcp-builder-Skill mit einem Befehl
npx killer-skills add anthropics/skills/mcp-builder
```

In diesem Leitfaden erfahren Sie alles, was Sie wissen müssen, um MCP-Server zu erstellen — von der Verständnis des Protokolls bis zum Deployen Ihres ersten Servers.
## Was ist ein MCP-Server?

Ein **MCP-Server** ist ein standardisierter Dienst, der Tools, Ressourcen und Prompts für KI-Agents zur Verfügung stellt. Denken Sie daran als eine Brücke zwischen Ihrem KI-Assistenten und der realen Welt — Datenbanken, APIs, Dateisysteme, Cloud-Dienste und mehr.

Das **Model Context Protocol** (MCP) wurde von Anthropic erstellt, um ein grundlegendes Problem zu lösen: KI-Agents benötigen eine universelle Möglichkeit, mit externen Diensten zu interagieren. Vor MCP erforderte jede Integration benutzerdefinierten Code. Jetzt handhabt ein einzelnes Protokoll alles.

Hier sind die Gründe, warum MCP wichtig ist:

- **Universelle Kompatibilität** — Funktioniert mit Claude, Cursor, Windsurf und jedem MCP-kompatiblen Client
- **Standardisierte Schnittstelle** — Tools, Ressourcen und Prompts folgen einem konsistenten Schema
- **Sicherheitsorientiertes Design** — Integrierte Authentifizierung, Eingabevalidierung und Berechtigungssteuerung
- **Zusammensetzbare Workflows** — Agents können mehrere MCP-Tools zusammenketten
## Warum den mcp-builder-Skill verwenden?

Der **mcp-builder**-Skill ist einer der leistungsstärksten Skills im offiziellen Repository von Anthropic. Er verwandelt Claude in einen spezialisierten MCP-Server-Entwickler, indem er Folgendes bereitstellt:

1. **Tiefes Protokollwissen** — Der Skill lädt die vollständige MCP-Spezifikation, so dass Claude jeden Detail versteht
2. **Best Practices sind bereits enthalten** — Tool-Namensgebung, Fehlerbehandlung und Paginierungsmuster sind alle vorab konfiguriert
3. **Framework-spezifische Anleitungen** — Optimierte Vorlagen für TypeScript und Python
4. **Erstellung von Bewertungen** — Erstellt automatisch Test-Suites für Ihren MCP-Server

Im Gegensatz zum Aufbau von Grund auf folgt der mcp-builder-Skill einem strukturierten 4-Phasen-Workflow:

| Phase | Was passiert |
|:------|:-------------|
| **Phase 1: Recherche** | Untersucht die API, plant die Tool-Abdeckung, entwirft das Schema |
| **Phase 2: Erstellung** | Implementiert den Server mit ordnungsgemäßer Fehlerbehandlung und Authentifizierung |
| **Phase 3: Überprüfung** | Testet alle Tools, validiert Antworten, überprüft Randfälle |
| **Phase 4: Bewertung** | Erstellt automatisierte Bewertungen, um die Qualität zu überprüfen |
## Erste Schritte: Erstellen Sie Ihren ersten MCP-Server

### Schritt 1: Installieren Sie die Fähigkeit

Stellen Sie zunächst sicher, dass die Killer-Skills-CLI installiert ist:

```bash
npm install -g killer-skills
```

Fügen Sie dann die mcp-builder-Fähigkeit Ihrem Projekt hinzu:

```bash
npx killer-skills add anthropics/skills/mcp-builder
```

Die Fähigkeit wird Ihrem `.claude/skills/`-Verzeichnis hinzugefügt und automatisch aktiviert, wenn Claude MCP-Server-Entwicklungsaufgaben erkennt.

### Schritt 2: Wählen Sie Ihren Stack

Die mcp-builder-Fähigkeit unterstützt zwei primäre Stacks:

**TypeScript (Empfohlen)**
```bash
npm init -y
npm install @modelcontextprotocol/sdk zod
```

TypeScript wird aus mehreren Gründen empfohlen:
- Hochwertige SDK-Unterstützung durch das offizielle MCP-Team
- Statische Typisierung findet Fehler vor der Laufzeit
- Starke Kompatibilität mit Ausführungsumgebungen
- KI-Modelle sind gut darin, TypeScript-Code zu generieren

**Python**
```bash
pip install mcp pydantic
```

Python ist eine gute Wahl, wenn Ihr Team bereits Python verwendet oder wenn Sie mit Python-lastigen APIs integrieren.

### Schritt 3: Definieren Sie Ihre Tools

Der Schlüssel zu einem großartigen MCP-Server sind gut entworfene Tools. Hier ist ein Template:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
  name: "my-api-server",
  version: "1.0.0",
});

server.tool(
  "create_item",
  "Erstellt ein neues Element im System",
  {
    name: z.string().describe("Name des zu erstellenden Elements"),
    description: z.string().optional().describe("Optionaler Beschreibungstext"),
    tags: z.array(z.string()).optional().describe("Tags für die Kategorisierung"),
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

### Schritt 4: Implementieren Sie Best Practices

Die mcp-builder-Fähigkeit erzwingt mehrere kritische Muster:

**Tool-Namenskonvention**
```
✅ github_create_issue
✅ slack_send_message
✅ db_query_users

❌ createIssue
❌ send
❌ doStuff
```

Verwenden Sie konsistente Präfixe (Dienstname) + aktionsorientierte Verben. Dies hilft Agenten, die richtigen Tools schnell zu entdecken und auszuwählen.

**Aktionsorientierte Fehlermeldungen**
```typescript
// ❌ Schlecht
throw new Error("Nicht gefunden");

// ✅ Gut
throw new Error(
  `Repository "${owner}/${repo}" nicht gefunden. ` +
  `Überprüfen Sie, ob das Repository existiert und Sie Zugriff haben. ` +
  `Versuchen Sie, Ihre Repositorys zuerst mit github_list_repos aufzulisten.`
);
```

**Tool-Anmerkungen**

Jedes Tool sollte Anmerkungen enthalten, die Agenten helfen, ihr Verhalten zu verstehen:

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
## Reales Beispiel: Erstellung eines GitHub-MCP-Servers

Lassen Sie uns ein realistisches Beispiel durchgehen. Angenommen, Sie möchten einen MCP-Server erstellen, der es KI-Agents ermöglicht, GitHub-Repositorys zu verwalten.

**Fragen Sie Claude mit der aktiven mcp-builder-Fähigkeit:**

> "Bauen Sie mir einen MCP-Server für die GitHub-API. Er sollte das Erstellen von Problemen, Auflisten von Repositorys, Verwalten von Pull-Anfragen und Suchen von Code unterstützen."

Claude wird:
1. Die GitHub-REST-API-Dokumentation recherchieren
2. Planen, welche Endpunkte abgedeckt werden sollen (typischerweise 15-25 Tools)
3. Den kompletten Server mit ordnungsgemäßer OAuth-Authentifizierung erstellen
4. Testbewertungen für jedes Tool generieren

Das Ergebnis ist ein produktionsreifer Server mit ordnungsgemäßer Fehlerbehandlung, Paginierung, Rate Limiting und Authentifizierung — etwas, das normalerweise Tage dauern würde, um es manuell zu erstellen.
## Schlüssel-Designprinzipien für MCP-Server

### API-Abdeckung vs. Workflow-Tools

Die mcp-builder-Fähigkeit vermittelt ein wichtiges Gleichgewicht:

- **Umfassende Abdeckung** gibt Agenten die Flexibilität, Operationen zu komponieren
- **Workflow-Tools** bündeln häufige mehrschrittige Operationen in einzelne Aufrufe
- Wenn man unsicher ist, priorisiert man die umfassende API-Abdeckung

### Kontextverwaltung

Agenten arbeiten am besten mit fokussierten, relevanten Daten:

- Geben Sie nur die Felder zurück, die die Agenten benötigen, nicht die gesamten API-Antworten
- Unterstützen Sie die Paginierung für Listenvorgänge
- Enthalten Sie Filter, um die Ergebnisse einzugrenzen

### Testen und Bewertung

Die mcp-builder-Fähigkeit generiert automatisierte Bewertungen, die testen:

- **Happy Path** — Normale Ausführung mit gültigen Eingaben
- **Randfälle** — Leere Ergebnisse, große Datensätze, Sonderzeichen
- **Fehlerbehandlung** — Ungültige Eingaben, Authentifizierungsfehler, Rate Limits
- **Reale Szenarien** — Mehrschrittige Workflows, die Tools zusammenketten
## Installation über Killer-Skills

Der schnellste Weg, loszulegen, ist über den Killer-Skills-Marktplatz:

```bash
# Browse die offiziellen Skills
npx killer-skills search mcp

# Installiere mcp-builder
npx killer-skills add anthropics/skills/mcp-builder

# Überprüfe die Installation
npx killer-skills list
```

Sobald installiert, ist das Skill automatisch in Claude Code, Claude.ai und jeder Claude-API-Integration verfügbar. Beginne einfach ein Gespräch über den Aufbau eines MCP-Servers und Claude lädt die Anweisungen des Skills.
## Was kommt als Nächstes?

MCP-Server werden zum Standard, wie KI-Agenten mit der Welt interagieren. Mit der mcp-builder-Skill müssen Sie kein MCP-Protokoll-Experte sein – Claude übernimmt die Komplexität, während Sie sich darauf konzentrieren, was Ihr Server tun soll.

Bereit, Ihren ersten MCP-Server zu bauen? So starten Sie noch heute:

1. **Installieren Sie die Skill**: `npx killer-skills add anthropics/skills/mcp-builder`
2. **Wählen Sie Ihre API**: Wählen Sie einen Dienst, den Sie integrieren möchten (Slack, Notion, JIRA, etc.)
3. **Beschreiben Sie Ihre Anforderungen**: Erklären Sie Claude, welche Tools Sie benötigen, und es baut den gesamten Server
4. **Deployen und testen**: Verwenden Sie die generierten Evaluationen, um Ihren Server zu validieren

Die Zukunft der KI-Entwicklung besteht nicht darin, mehr Code zu schreiben – sondern KI-Agenten die richtigen Werkzeuge an die Hand zu geben. MCP-Server und Agent Skills machen diese Zukunft heute schon möglich.

---

*Möchten Sie weitere Skills erkunden? Durchstöbern Sie den [Killer-Skills Marketplace](https://killer-skills.com/de/skills), um Hunderte von verifizierten Agent Skills für Ihren KI-Coding-Workflow zu entdecken.*

---

*Verwandt: [Was sind KI-Agent-Skills?](/de/blog/what-are-ai-agent-skills) und [Die besten KI-Agent-Skills für 2026](/de/blog/best-ai-agent-skills-2026)*