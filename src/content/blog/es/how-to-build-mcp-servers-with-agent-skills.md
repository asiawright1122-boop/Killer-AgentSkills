---
title: "Cómo construir servidores MCP: Una guía completa utilizando habilidades de agente"
description: "Aprende a construir servidores MCP de producción listos para agentes de inteligencia artificial utilizando la habilidad oficial mcp-builder. Cubre la configuración, el diseño de herramientas, las pruebas y la implementación con TypeScript y Python."
pubDate: 2026-02-13
author: "Killer-Skills Team"
tags: ["MCP", "Tutorial", "Agent Skills", "Claude Code"]
lang: "es"
featured: false
category: "developer-experience"
heroImage: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=2560&auto=format&fit=crop"
---
# Cómo construir servidores MCP que los agentes de inteligencia artificial realmente utilizan

¿Qué pasa si su agente de codificación de inteligencia artificial pudiera hacer más que solo escribir código? ¿Qué pasa si pudiera enviar mensajes de Slack, consultar bases de datos, implementar en producción y administrar toda su canalización de DevOps — todo a través de un protocolo estandarizado?

Eso es exactamente lo que los **servidores MCP** (Protocolo de contexto de modelo) hacen posible. Y con la habilidad oficial **mcp-builder** del repositorio de habilidades de Anthropic, puede construir servidores MCP de grado de producción en minutos en lugar de horas.

```bash
# Instalar la habilidad mcp-builder con un solo comando
npx killer-skills add anthropics/skills/mcp-builder
```

En esta guía, aprenderá todo lo que necesita saber sobre la construcción de servidores MCP — desde la comprensión del protocolo hasta la implementación de su primer servidor.
## ¿Qué es un servidor MCP?

Un **servidor MCP** es un servicio estandarizado que expone herramientas, recursos y solicitudes para que los agentes de inteligencia artificial los consuman. Piénsalo como un puente entre tu asistente de inteligencia artificial y el mundo real — bases de datos, API, sistemas de archivos, servicios en la nube y más.

El **Protocolo de Contexto de Modelo** (MCP) fue creado por Anthropic para resolver un problema fundamental: los agentes de inteligencia artificial necesitan una forma universal de interactuar con servicios externos. Antes de MCP, cada integración requería código personalizado. Ahora, un solo protocolo maneja todo.

Aquí está por qué MCP es importante:

- **Compatibilidad universal** — Funciona con Claude, Cursor, Windsurf y cualquier cliente compatible con MCP
- **Interfaz estandarizada** — Herramientas, recursos y solicitudes siguen un esquema consistente
- **Diseño con seguridad** — Autenticación integrada, validación de entrada y controles de permisos
- **Flujos de trabajo componibles** — Los agentes pueden encadenar múltiples herramientas MCP juntas
## Por qué usar la habilidad mcp-builder?

La habilidad **mcp-builder** es una de las habilidades más potentes en el repositorio oficial de Anthropic. Transforma a Claude en un desarrollador de servidor MCP especializado al proporcionar:

1. **Conocimiento profundo del protocolo** — La habilidad carga la especificación completa de MCP para que Claude comprenda cada detalle
2. **Mejores prácticas integradas** — El nombramiento de herramientas, el manejo de errores y los patrones de paginación están todos preconfigurados
3. **Guías específicas del marco de trabajo** — Plantillas optimizadas para TypeScript y Python
4. **Generación de evaluaciones** — Crea automáticamente suites de pruebas para su servidor MCP

A diferencia de construir desde cero, la habilidad mcp-builder sigue un flujo de trabajo estructurado de 4 fases:

| Fase | Qué sucede |
|:------|:-------------|
| **Fase 1: Investigación** | Estudia la API, planea la cobertura de herramientas, diseña el esquema |
| **Fase 2: Construcción** | Implementa el servidor con manejo de errores y autenticación adecuados |
| **Fase 3: Revisión** | Prueba todas las herramientas, valida respuestas, verifica casos límite |
| **Fase 4: Evaluación** | Crea evaluaciones automatizadas para verificar la calidad |
## Introducción: Crea tu primer servidor MCP

### Paso 1: Instala la habilidad

Primero, asegúrate de tener instalada la CLI de Killer-Skills:

```bash
npm install -g killer-skills
```

Luego agrega la habilidad de mcp-builder a tu proyecto:

```bash
npx killer-skills add anthropics/skills/mcp-builder
```

La habilidad se agregará al directorio `.claude/skills/` y se activará automáticamente cuando Claude detecte tareas de desarrollo de servidores MCP.

### Paso 2: Elige tu pila

La habilidad de mcp-builder admite dos pilas principales:

**TypeScript (Recomendado)**
```bash
npm init -y
npm install @modelcontextprotocol/sdk zod
```

TypeScript es recomendado por varias razones:
- Soporte de SDK de alta calidad del equipo oficial de MCP
- La tipificación estática detecta errores antes de la ejecución
- Fuerte compatibilidad con entornos de ejecución
- Los modelos de AI excelan en la generación de código TypeScript

**Python**
```bash
pip install mcp pydantic
```

Python es una excelente opción si tu equipo ya utiliza Python o estás integrando con APIs que utilizan mucho Python.

### Paso 3: Define tus herramientas

La clave para un gran servidor MCP es tener herramientas bien diseñadas. Aquí tienes una plantilla:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
  name: "my-api-server",
  version: "1.0.0",
});

server.tool(
  "create_item",
  "Crea un nuevo elemento en el sistema",
  {
    name: z.string().describe("Nombre del elemento a crear"),
    description: z.string().optional().describe("Descripción opcional"),
    tags: z.array(z.string()).optional().describe("Etiquetas para categorización"),
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

### Paso 4: Implementa las mejores prácticas

La habilidad de mcp-builder impone varios patrones críticos:

**Convención de nomenclatura de herramientas**
```
✅ github_create_issue
✅ slack_send_message
✅ db_query_users

❌ createIssue
❌ send
❌ doStuff
```

Usa prefijos consistentes (nombre del servicio) + verbos orientados a la acción. Esto ayuda a los agentes a descubrir y seleccionar rápidamente las herramientas adecuadas.

**Mensajes de error que se pueden actuar**
```typescript
// ❌ Mal
throw new Error("No encontrado");

// ✅ Bueno
throw new Error(
  `Repositorio "${owner}/${repo}" no encontrado. ` +
  `Verifica que el repositorio exista y tengas acceso. ` +
  `Intenta enumerar tus repositorios primero con github_list_repos.`
);
```

**Anotaciones de herramientas**

Cada herramienta debe incluir anotaciones que ayuden a los agentes a entender su comportamiento:

```typescript
server.tool(
  "delete_item",
  "Elimina permanentemente un elemento",
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
## Ejemplo en el Mundo Real: Construyendo un Servidor MCP de GitHub

Pasemos por un ejemplo realista. Supongamos que deseas construir un servidor MCP que permita a los agentes de inteligencia artificial administrar repositorios de GitHub.

**Pregúntale a Claude con la habilidad mcp-builder activa:**

> "Constrúyeme un servidor MCP para la API de GitHub. Debe soportar la creación de incidencias, la lista de repositorios, la administración de solicitudes de extracción y la búsqueda de código."

Claude hará:
1. Investigará la documentación de la API REST de GitHub
2. Planificará qué endpoints cubrir (típicamente 15-25 herramientas)
3. Construirá el servidor completo con autenticación OAuth adecuada
4. Generará evaluaciones de prueba para cada herramienta

El resultado es un servidor listo para producción con control de errores adecuado, paginación, limitación de velocidad y autenticación — algo que normalmente tomaría días construir manualmente.
## Principios de Diseño Clave para Servidores MCP

### Cobertura de API vs. Herramientas de Flujo de Trabajo

La habilidad mcp-builder enseña un equilibrio importante:

- **Cobertura integral** brinda a los agentes flexibilidad para componer operaciones
- **Herramientas de flujo de trabajo** agrupan operaciones multi-paso comunes en llamadas únicas
- Cuando esté en duda, priorice la cobertura integral de la API

### Administración de Contexto

Los agentes funcionan mejor con datos enfocados y relevantes:

- Devuelva solo los campos que los agentes necesitan, no respuestas API completas
- Admita paginación para operaciones de lista
- Incluya filtros para reducir los resultados

### Pruebas y Evaluación

La habilidad mcp-builder genera evaluaciones automatizadas que prueban:

- **Ruta feliz** — Operación normal con entradas válidas
- **Casos límite** — Resultados vacíos, conjuntos de datos grandes, caracteres especiales
- **Control de errores** — Entradas inválidas, fallos de autenticación, límites de velocidad
- **Escenarios del mundo real** — Flujos de trabajo multi-paso que encadenan herramientas juntas
## Instalación vía Killer-Skills

La forma más rápida de empezar es a través del mercado de Killer-Skills:

```bash
# Browse the official skills
npx killer-skills search mcp

# Install mcp-builder
npx killer-skills add anthropics/skills/mcp-builder

# Verify installation
npx killer-skills list
```

Una vez instalado, la habilidad está automáticamente disponible en Claude Code, Claude.ai y cualquier integración de la API de Claude. Simplemente inicie una conversación sobre la construcción de un servidor MCP y Claude cargará las instrucciones de la habilidad.
## ¿Qué sigue?

Los servidores MCP se están convirtiendo en el estándar para que los agentes de IA interactúen con el mundo. Con la skill `mcp-builder`, no necesitas ser un experto en el protocolo MCP: Claude maneja la complejidad mientras tú te enfocas en lo que debe hacer tu servidor.

¿Listo para construir tu primer servidor MCP? Así puedes empezar hoy:

1.  **Instala la skill**: `npx killer-skills add anthropics/skills/mcp-builder`
2.  **Elige tu API**: Selecciona un servicio que quieras integrar (Slack, Notion, JIRA, etc.)
3.  **Describe tus necesidades**: Dile a Claude qué herramientas necesitas y él construirá el servidor completo
4.  **Implementa y prueba**: Utiliza las evaluaciones generadas para validar tu servidor

El futuro del desarrollo de IA no se trata de escribir más código, sino de dar a los agentes de IA las herramientas correctas para trabajar. Los servidores MCP y las Agent Skills hacen que ese futuro sea posible hoy.

---

*¿Quieres explorar más skills? Navega por el [Killer-Skills Marketplace](https://killer-skills.com/es/skills) para descubrir cientos de Agent Skills verificadas para tu flujo de trabajo de codificación con IA.*

---

*Relacionado: [¿Qué son las skills para agentes de IA?](/es/blog/what-are-ai-agent-skills) y [Mejores skills para agentes de IA para 2026](/es/blog/best-ai-agent-skills-2026)*