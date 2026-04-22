---
title: 'So installieren Sie AI-Agenten-Fähigkeiten in 30 Sekunden'
description: 'Ein schneller Leitfaden zur Installation von Community-AI-Agenten-Fähigkeiten in Claude Code, Cursor oder Windsurf mithilfe des killer-skills-CLI-Tools.'
pubDate: 2026-02-24
author: 'Killer-Skills Team'
tags: ['Tutorial', 'AI Agent Skills', 'CLI', 'Developer Tools', 'Automation']
lang: 'de'
featured: false
category: 'guides'
heroImage: 'https://images.unsplash.com/photo-1629654297299-c8506221ca97?q=80&w=2560&auto=format&fit=crop'
---

# Wie man AI-Agenten-Fähigkeiten installiert

Sie haben eine AI-Agenten-Fähigkeit gefunden, die Sie verwenden möchten. Vielleicht ist es die [docx Automation-Fähigkeit](/en/skills/anthropics/skills/docx) oder vielleicht ein spezialisierter Frontend-UI-Generator. Jetzt müssen Sie sie in Ihr Projekt einfügen, damit Ihr Codier-Agent sie tatsächlich lesen kann.

Sie können den Markdown-Text manuell kopieren und einfügen, die richtigen Verzeichnisse erstellen und die Frontmatter-Formatierung selbst korrigieren. Oder Sie können einen Befehl ausführen, der all dies für Sie erledigt.

## Die killer-skills CLI

Wir haben ein spezielles Kommandozeilen-Tool entwickelt. Es übernimmt das Abrufen der Fähigkeit von GitHub, das Umwandeln in das richtige Format für Ihre IDE (Claude Code, Cursor, Windsurf oder GitHub Copilot) und das Platzieren in das richtige Verzeichnis.

Sie müssen es nicht dauerhaft installieren. Sie können es direkt über `npx` (das mit Node.js mitgeliefert wird) ausführen.

Öffnen Sie Ihr Terminal, wechseln Sie zu Ihrem Projektverzeichnis und führen Sie den folgenden Befehl aus:

```bash
npx killer-skills add owner/repo
```

Zum Beispiel, um die PDF-Automatisierungs-Fähigkeit zu installieren, führen Sie den folgenden Befehl aus:

```bash
npx killer-skills add anthropics/skills/pdf
```

Die CLI erkennt, welche IDE Sie verwenden, indem sie Ihre Projektdateien überprüft. Wenn sie ein `.cursor`-Verzeichnis erkennt, formatiert sie die Fähigkeit als `.mdc`-Datei. Wenn sie ein `.claude`-Verzeichnis erkennt, formatiert sie es als `SKILL.md`.

## Installation auf mehreren IDEs

Wenn Sie mehrere Agenten im gleichen Projekt verwenden (zum Beispiel Claude Code im Terminal und Cursor als Editor), können Sie die CLI zwingen, die Fähigkeit für alle auf einmal zu installieren.

Fügen Sie einfach die `--all`-Flagge hinzu:

```bash
npx killer-skills add anthropics/skills/pdf --all
```

Dies erstellt die erforderlichen Dateien in beiden `.claude/skills/` und `.cursor/rules/`, wobei die Kernanweisungen identisch bleiben, während die Metadaten korrekt für jeden Agenten formatiert werden.

## Fähigkeiten finden und installieren

Wenn Sie wissen, wonach Sie suchen, aber den genauen Repository-Pfad nicht mehr wissen, können Sie direkt aus Ihrem Terminal suchen:

```bash
npx killer-skills search auth
```

Dies gibt eine Abfrage an die Community-Datenbank aus und gibt die besten Übereinstimmungen zurück, einschließlich ihrer Sternenzahlen und vollständigen Installationspfade. Sie können auch das vollständige Open-Source-Verzeichnis auf der [Killer-Skills-Website](/de/skills) durchblättern.

## Fähigkeiten auf dem neuesten Stand halten

Fähigkeiten entwickeln sich weiter. Autoren fügen neue Randfälle hinzu, korrigieren schlechte Anweisungen und verbessern die Zuverlässigkeit von Prompts. Da Sie die Fähigkeit über die CLI installiert haben, können Sie sie genauso einfach aktualisieren.

```bash
npx killer-skills update
```

Dies überprüft alle Fähigkeiten, die Sie installiert haben, vergleicht sie mit der Quelle auf GitHub und wendet Aktualisierungen an, während lokale Modifikationen wo möglich erhalten bleiben.

## Was passiert eigentlich unter der Haube?

Wenn Sie den `add`-Befehl ausführen, installiert die CLI keine ausführbare Software oder npm-Abhängigkeiten. Sie lädt lediglich Text herunter.

Eine Fähigkeit ist einfach eine Markdown-Datei mit Anweisungen für ein Large Language Model. Die CLI lädt diese Markdown-Datei herunter, umhüllt sie mit dem spezifischen YAML- oder JSON-Format, das Ihr Editor erwartet, und schreibt sie in einen lokalen Ordner.

Es gibt keine Hintergrundprozesse, keine Telemetrie, die Daten an einen Server sendet, und keine versteckten Payloads. Es handelt sich lediglich um Dokumentation, die genau dort platziert wird, wo Ihr KI-Agent weiß, dass er nach ihr suchen muss.

---

_Verwandt: [Was sind Fähigkeiten von KI-Agents?](/de/blog/what-are-ai-agent-skills) und [Beste Fähigkeiten von KI-Agents für 2026](/de/blog/best-ai-agent-skills-2026)_
