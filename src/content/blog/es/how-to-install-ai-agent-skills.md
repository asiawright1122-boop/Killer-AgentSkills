---
title: "Cómo instalar habilidades de agente de IA en 30 segundos"
description: "Una guía rápida para instalar habilidades comunitarias de agentes de IA en Claude Code, Cursor o Windsurf utilizando la herramienta CLI killer-skills."
pubDate: 2026-02-24
author: "Killer-Skills Team"
tags: ["Tutorial", "AI Agent Skills", "CLI", "Developer Tools", "Automation"]
lang: "es"
featured: false
category: "guides"
heroImage: "https://images.unsplash.com/photo-1629654297299-c8506221ca97?q=80&w=2560&auto=format&fit=crop"
---
# Cómo instalar habilidades de agente de IA

Encontraste una habilidad de agente de IA que deseas utilizar. Tal vez sea la [habilidad de automatización de docx](/en/skills/anthropics/skills/docx), o tal vez un generador de interfaz de usuario frontend especializado. Ahora necesitas incorporarla a tu proyecto para que tu agente de codificación pueda leerla realmente.

Puedes copiar y pegar manualmente el texto en markdown, crear los directorios correctos y corregir el formato de frontmatter tú mismo. O puedes ejecutar un solo comando que lo haga por ti.
## La herramienta de línea de comandos killer-skills

Creamos una herramienta de línea de comandos específicamente para esto. Maneja la descarga de la habilidad desde GitHub, la convierte al formato adecuado para tu IDE (Claude Code, Cursor, Windsurf o GitHub Copilot) y la coloca en el directorio correcto.

No necesitas instalarla permanentemente. Puedes ejecutarla directamente mediante `npx` (que viene con Node.js).

Abre tu terminal, ve a tu directorio de proyecto y ejecuta:

```bash
npx killer-skills add owner/repo
```

Por ejemplo, para instalar la habilidad de automatización de PDF, ejecutas:

```bash
npx killer-skills add anthropics/skills/pdf
```

La CLI detecta qué IDE estás utilizando al examinar tus archivos de proyecto. Si ve un directorio `.cursor`, formatea la habilidad como un archivo `.mdc`. Si ve un directorio `.claude`, la formatea como `SKILL.md`.
## Instalación en múltiples IDEs

Si utilizas múltiples agentes en el mismo proyecto (por ejemplo, Claude Code en la terminal y Cursor como tu editor), puedes forzar a la CLI a instalar la habilidad para todos ellos a la vez.

Solo añade el flag `--all`:

```bash
npx killer-skills add anthropics/skills/pdf --all
```

Esto crea los archivos necesarios tanto en `.claude/skills/` como en `.cursor/rules/`, manteniendo las instrucciones principales idénticas mientras formatea los metadatos correctamente para cada agente.
## Encontrar habilidades para instalar

Si sabes lo que estás buscando pero no recuerdas la ruta exacta del repositorio, puedes buscar directamente desde tu terminal:

```bash
npx killer-skills search auth
```

Esto consulta la base de datos de la comunidad y devuelve las mejores coincidencias, incluyendo sus recuentos de estrellas y rutas de instalación completas. También puedes explorar el directorio de código abierto completo en el sitio web de [Killer-Skills](/es/skills).
## Mantener las habilidades actualizadas

Las habilidades evolucionan. Los autores agregan nuevos casos de borde, corrigen instrucciones incorrectas y mejoran la confiabilidad de las solicitudes. Dado que instaló la habilidad a través de la CLI, puede actualizarla con la misma facilidad.

```bash
npx killer-skills update
```

Esto verifica todas las habilidades que ha instalado, las compara con la fuente de upstream en GitHub y aplica las actualizaciones mientras preserva las modificaciones locales cuando sea posible.
## ¿Qué está sucediendo realmente bajo el capó?

Cuando ejecutas el comando `add`, la CLI no está instalando software ejecutable ni dependencias de npm. Simplemente está descargando texto.

Una habilidad es simplemente un archivo de markdown con instrucciones para un Modelo de Lenguaje Grande. La CLI recupera ese markdown, lo envuelve en el formato YAML o JSON específico que tu editor espera, y lo escribe en una carpeta local.

No hay procesos en segundo plano, no hay telemetría de llamada a casa, ni hay payloads ocultos. Es simplemente documentación, colocada exactamente donde tu agente de inteligencia artificial sabe buscarla.

---
*Relacionado: [¿Qué son las habilidades de los agentes de inteligencia artificial?](/es/blog/what-are-ai-agent-skills) y [Las mejores habilidades para agentes de inteligencia artificial en 2026](/es/blog/best-ai-agent-skills-2026)*