---
title: "Cómo construir servidores MCP: Una guía completa usando Agent Skills"
description: "Aprenda a construir servidores MCP listos para producción para agentes de IA utilizando la habilidad oficial mcp-builder. Cubre la configuración, el diseño de herramientas, las pruebas y el despliegue con TypeScript y Python."
pubDate: 2026-02-13
author: "Equipo de Killer-Skills"
tags: ["MCP", "Tutorial", "Agent Skills", "Claude Code"]
lang: "es"
featured: false
category: "developer-experience"
heroImage: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=2560&auto=format&fit=crop"
---

# Cómo construir servidores MCP que los agentes de IA realmente usen

¿Qué pasaría si tu agente de codificación de IA pudiera hacer algo más que escribir código? ¿Qué pasaría si pudiera enviar mensajes de Slack, consultar bases de datos, desplegar en producción y gestionar todo tu pipeline de DevOps, todo a través de un protocolo estandarizado?

Eso es exactamente lo que los **servidores MCP** (Model Context Protocol) hacen posible. Y con la habilidad oficial **mcp-builder** del repositorio de habilidades de Anthropic, puedes construir servidores MCP de grado de producción en minutos en lugar de horas.

```bash
# Instala la habilidad mcp-builder con un solo comando
npx killer-skills add anthropics/skills/mcp-builder
```

En esta guía, aprenderás todo lo que necesitas saber sobre la construcción de servidores MCP, desde la comprensión del protocolo hasta el despliegue de tu primero.

## ¿Qué es un servidor MCP?

Un **servidor MCP** es un servicio estandarizado que expone herramientas, recursos y mensajes para que los agentes de IA los consuman. Piensa en él como un puente entre tu asistente de IA y el mundo real: bases de datos, APIs, sistemas de archivos, servicios en la nube y más.

El **Model Context Protocol** (MCP) fue creado por Anthropic para resolver un problema fundamental: los agentes de IA necesitan una forma universal de interactuar con servicios externos. Antes de MCP, cada integración requería código personalizado. Ahora, un solo protocolo lo maneja todo.

He aquí por qué MCP es importante:

-   **Compatibilidad universal**: Funciona con Claude, Cursor, Windsurf y cualquier cliente compatible con MCP.
-   **Interfaz estandarizada**: Las herramientas, los recursos y los mensajes siguen un esquema consistente.
-   **Diseño centrado en la seguridad**: Autenticación integrada, validación de entrada y controles de permisos.
-   **Flujos de trabajo componibles**: Los agentes pueden encadenar múltiples herramientas MCP.

## ¿Por qué usar la habilidad mcp-builder?

La habilidad **mcp-builder** es una de las más poderosas del repositorio oficial de Anthropic. Transforma a Claude en un desarrollador especializado de servidores MCP al proporcionar:

1.  **Conocimiento profundo del protocolo**: La habilidad carga la especificación completa de MCP para que Claude entienda cada detalle.
2.  **Mejores prácticas integradas**: El nombramiento de herramientas, manejo de errores y patrones de paginación están preconfigurados.
3.  **Guías específicas por framework**: Plantillas optimizadas tanto para TypeScript como para Python.
4.  **Generación de evaluaciones**: Crea automáticamente suites de pruebas para tu servidor MCP.

A diferencia de construir desde cero, la habilidad mcp-builder sigue un flujo de trabajo estructurado de 4 fases:

| Fase | Qué sucede |
|:------|:-------------|
| **Fase 1: Investigación** | Estudia la API, planifica la cobertura de herramientas, diseña el esquema. |
| **Fase 2: Construcción** | Implementa el servidor con el manejo de errores y autenticación adecuados. |
| **Fase 3: Revisión** | Prueba todas las herramientas, valida las respuestas, verifica casos extremos. |
| **Fase 4: Evaluación** | Crea evaluaciones automatizadas para verificar la calidad. |

## Comenzando: Construye tu primer servidor MCP

### Paso 1: Instala la habilidad

Primero, asegúrate de tener instalada la CLI de Killer-Skills:

```bash
npm install -g killer-skills
```

Luego, añade la habilidad mcp-builder a tu proyecto:

```bash
npx killer-skills add anthropics/skills/mcp-builder
```

La habilidad se añadirá a tu directorio `.claude/skills/` y se activará automáticamente cuando Claude detecte tareas de desarrollo de servidores MCP.

### Paso 2: Elige tu Stack

La habilidad mcp-builder soporta dos stacks principales:

**TypeScript (Recomendado)**
```bash
npm init -y
npm install @modelcontextprotocol/sdk zod
```

Se recomienda TypeScript por varias razones:
-   Soporte de SDK de alta calidad del equipo oficial de MCP.
-   El tipado estático detecta errores antes del tiempo de ejecución.
-   Fuerte compatibilidad con entornos de ejecución.
-   Los modelos de IA destacan generando código TypeScript.

**Python**
```bash
pip install mcp pydantic
```

Python es una excelente opción si tu equipo ya usa Python o si estás integrando con APIs que dependen mucho de Python.

### Paso 3: Define tus herramientas

La clave para un gran servidor MCP son herramientas bien diseñadas. Aquí tienes una plantilla:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
  name: "mi-servidor-api",
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

La habilidad mcp-builder impone varios patrones críticos:

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

**Mensajes de error accionables**
```typescript
// ❌ Mal
throw new Error("No encontrado");

// ✅ Bien
throw new Error(
  `Repositorio "${owner}/${repo}" no encontrado. ` +
  `Verifica que el repositorio existe y tienes acceso. ` +
  `Intenta listar tus repositorios primero con github_list_repos.`
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

## Ejemplo del mundo real: Construyendo un servidor MCP de GitHub

Caminemos por un ejemplo realista. Supongamos que quieres construir un servidor MCP que permita a los agentes de IA gestionar repositorios de GitHub.

**Pregunta a Claude con la habilidad mcp-builder activa:**

> "Constrúyeme un servidor MCP para la API de GitHub. Debe soportar la creación de issues, el listado de repositorios, la gestión de pull requests y la búsqueda de código."

Claude hará:
1.  Investigará la documentación de la API REST de GitHub.
2.  Planificará qué endpoints cubrir (típicamente 15-25 herramientas).
3.  Construirá el servidor completo con la autenticación OAuth adecuada.
4.  Generará evaluaciones de prueba para cada herramienta.

El resultado es un servidor listo para producción con el manejo de errores, paginación, límites de tasa y autenticación adecuados, algo que normalmente llevaría días construir manualmente.

## Principios clave de diseño para servidores MCP

### Cobertura de API vs. Herramientas de flujo de trabajo

La habilidad mcp-builder enseña un equilibrio importante:

-   **La cobertura completa** da a los agentes flexibilidad para componer operaciones.
-   **Las herramientas de flujo de trabajo** agrupan operaciones comunes de múltiples pasos en llamadas individuales.
-   Cuando tengas dudas, prioriza la cobertura completa de la API.

### Gestión de contexto

Los agentes funcionan mejor con datos enfocados y relevantes:

-   Devuelve solo los campos que los agentes necesitan, no las respuestas completas de la API.
-   Soporta paginación para operaciones de listado.
-   Incluye filtros para estrechar los resultados.

### Pruebas y evaluación

La habilidad mcp-builder genera evaluaciones automatizadas que prueban:

-   **Camino feliz**: Operación normal con entradas válidas.
-   **Casos extremos**: Resultados vacíos, grandes conjuntos de datos, caracteres especiales.
-   **Manejo de errores**: Entradas inválidas, fallos de autenticación, límites de tasa.
-   **Escenarios del mundo real**: Flujos de trabajo de múltiples pasos que encadenan herramientas.

## Instalación a través de Killer-Skills

La forma más rápida de comenzar es a través del marketplace de Killer-Skills:

```bash
# Explora las habilidades oficiales
npx killer-skills search mcp

# Instala mcp-builder
npx killer-skills add anthropics/skills/mcp-builder

# Verifica la instalación
npx killer-skills list
```

Una vez instalada, la habilidad está disponible automáticamente en Claude Code, Claude.ai y cualquier integración de la API de Claude. Simplemente inicia una conversación sobre la construcción de un servidor MCP y Claude cargará las instrucciones de la habilidad.

## ¿Qué sigue?

Los servidores MCP se están convirtiendo en la forma estándar en que los agentes de IA interactúan con el mundo. Con la habilidad mcp-builder, no necesitas ser un experto en el protocolo MCP: Claude maneja la complejidad mientras tú te enfocas en lo que tu servidor debe hacer.

¿Listo para construir tu primer servidor MCP? He aquí cómo empezar hoy mismo:

1.  **Instala la habilidad**: `npx killer-skills add anthropics/skills/mcp-builder`
2.  **Elige tu API**: Elige un servicio que quieras integrar (Slack, Notion, JIRA, etc.)
3.  **Describe tus necesidades**: Dile a Claude qué herramientas necesitas y él construirá todo el servidor.
4.  **Despliega y prueba**: Usa las evaluaciones generadas para validar tu servidor.

El futuro del desarrollo de IA no se trata de escribir más código, sino de dar a los agentes de IA las herramientas adecuadas para trabajar. Los servidores MCP y Agent Skills hacen que ese futuro sea posible hoy.

---

*¿Quieres explorar más habilidades? Explora el [Marketplace de Killer-Skills](https://killer-skills.com/es/skills) para descubrir cientos de Agent Skills verificadas para tu flujo de trabajo de codificación de IA.*
