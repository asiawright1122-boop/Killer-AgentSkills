---
title: "Como Construir Servidores MCP: Um Guia Completo Usando Agent Skills"
description: "Aprenda a construir servidores MCP prontos para produção para agentes de IA usando a skill oficial mcp-builder. Abrange configuração, design de ferramentas, testes e implantação com TypeScript e Python."
pubDate: 2026-02-13
author: "Equipe Killer-Skills"
tags: ["MCP", "Tutorial", "Agent Skills", "Claude Code"]
lang: "pt"
featured: false
category: "developer-experience"
heroImage: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=2560&auto=format&fit=crop"
---

# Como Construir Servidores MCP que Agentes de IA Realmente Utilizam

E se o seu agente de codificação de IA pudesse fazer mais do que apenas escrever código? E se ele pudesse enviar mensagens no Slack, consultar bancos de dados, implantar em produção e gerenciar todo o seu pipeline de DevOps — tudo por meio de um protocolo padronizado?

É exatamente isso que os **servidores MCP** (Model Context Protocol) tornam possível. E com a skill oficial **mcp-builder** do repositório de habilidades da Anthropic, você pode construir servidores MCP de nível de produção em minutos, em vez de horas.

```bash
# Instale a skill mcp-builder com um único comando
npx killer-skills add anthropics/skills/mcp-builder
```

Neste guia, você aprenderá tudo o que precisa saber sobre a construção de servidores MCP — desde a compreensão do protocolo até a implantação do seu primeiro servidor.

## O Que É um Servidor MCP?

Um **servidor MCP** é um serviço padronizado que expõe ferramentas, recursos e prompts para que os agentes de IA os consumam. Pense nele como uma ponte entre seu assistente de IA e o mundo real — bancos de dados, APIs, sistemas de arquivos, serviços em nuvem e muito mais.

O **Model Context Protocol** (MCP) foi criado pela Anthropic para resolver um problema fundamental: os agentes de IA precisam de uma maneira universal de interagir com serviços externos. Antes do MCP, cada integração exigia código personalizado. Agora, um único protocolo lida com tudo.

Veja por que o MCP é importante:

-   **Compatibilidade universal** — Funciona com Claude, Cursor, Windsurf e qualquer cliente compatível com MCP.
-   **Interface padronizada** — Ferramentas, recursos e prompts seguem um esquema consistente.
-   **Design focado em segurança** — Autenticação integrada, validação de entrada e controles de permissão.
-   **Fluxos de trabalho combináveis** — Os agentes podem encadear várias ferramentas MCP.

## Por Que Usar a Skill mcp-builder?

A skill **mcp-builder** é uma das mais poderosas no repositório oficial da Anthropic. Ela transforma o Claude em um desenvolvedor especializado em servidores MCP ao fornecer:

1.  **Conhecimento profundo do protocolo** — A skill carrega a especificação completa do MCP para que o Claude entenda cada detalhe.
2.  **Melhores práticas integradas** — Nomeação de ferramentas, tratamento de erros e padrões de paginação são pré-configurados.
3.  **Guias específicos para frameworks** — Modelos otimizados para TypeScript e Python.
4.  **Geração de avaliações** — Cria automaticamente suítes de testes para o seu servidor MCP.

Diferente de construir do zero, a skill mcp-builder segue um fluxo de trabalho estruturado em 4 fases:

| Fase | O Que Acontece |
|:------|:-------------|
| **Fase 1: Pesquisa** | Estuda a API, planeja a cobertura de ferramentas, projeta o esquema |
| **Fase 2: Construção** | Implementa o servidor com tratamento de erros e autenticação adequados |
| **Fase 3: Revisão** | Testa todas as ferramentas, valida as respostas, verifica casos extremos |
| **Fase 4: Avaliação** | Cria avaliações automatizadas para verificar a qualidade |

## Primeiros Passos: Construa Seu Primeiro Servidor MCP

### Passo 1: Instale a Skill

Primeiro, certifique-se de ter a CLI Killer-Skills instalada:

```bash
npm install -g killer-skills
```

Em seguida, adicione a skill mcp-builder ao seu projeto:

```bash
npx killer-skills add anthropics/skills/mcp-builder
```

A skill será adicionada ao seu diretório `.claude/skills/` e ativada automaticamente quando o Claude detectar tarefas de desenvolvimento de servidor MCP.

### Passo 2: Escolha o Seu Stack

A skill mcp-builder suporta dois stacks principais:

**TypeScript (Recomendado)**
```bash
npm init -y
npm install @modelcontextprotocol/sdk zod
```

O TypeScript é recomendado por vários motivos:
-   Suporte de SDK de alta qualidade da equipe oficial do MCP.
-   A tipagem estática detecta erros antes do tempo de execução.
-   Forte compatibilidade com ambientes de execução.
-   Os modelos de IA são excelentes em gerar código TypeScript.

**Python**
```bash
pip install mcp pydantic
```

O Python é uma ótima escolha se sua equipe já usa Python ou se você está integrando APIs com muito uso de Python.

### Passo 3: Defina Suas Ferramentas

A chave para um ótimo servidor MCP são ferramentas bem projetadas. Aqui está um modelo:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
  name: "meu-servidor-api",
  version: "1.0.0",
});

server.tool(
  "create_item",
  "Cria um novo item no sistema",
  {
    name: z.string().describe("Nome do item a ser criado"),
    description: z.string().optional().describe("Descrição opcional"),
    tags: z.array(z.string()).optional().describe("Tags para categorização"),
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

### Passo 4: Implemente Boas Práticas

A skill mcp-builder impõe vários padrões críticos:

**Convenção de Nomenclatura de Ferramentas**
```
✅ github_create_issue
✅ slack_send_message
✅ db_query_users

❌ createIssue
❌ send
❌ doStuff
```

Use prefixos consistentes (nome do serviço) + verbos orientados à ação. Isso ajuda os agentes a descobrir e selecionar rapidamente as ferramentas certas.

**Mensagens de Erro Acionáveis**
```typescript
// ❌ Ruim
throw new Error("Not found");

// ✅ Bom
throw new Error(
  `Repositório "${owner}/${repo}" não encontrado. ` +
  `Verifique se o repositório existe e se você tem acesso. ` +
  `Tente listar seus repositórios primeiro com github_list_repos.`
);
```

**Anotações de Ferramentas**

Cada ferramenta deve incluir anotações que ajudem os agentes a entender seu comportamento:

```typescript
server.tool(
  "delete_item",
  "Exclui permanentemente um item",
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

## Exemplo do Mundo Real: Construindo um Servidor MCP do GitHub

Vamos passar por um exemplo realista. Suponha que você queira construir um servidor MCP que permita aos agentes de IA gerenciar repositórios do GitHub.

**Pergunte ao Claude com a skill mcp-builder ativa:**

> "Construa para mim um servidor MCP para a API do GitHub. Ele deve suportar a criação de issues, listagem de repositórios, gerenciamento de pull requests e busca de código."

O Claude irá:
1.  Pesquisar a documentação da API REST do GitHub.
2.  Planejar quais endpoints cobrir (normalmente de 15 a 25 ferramentas).
3.  Construir o servidor completo com autenticação OAuth adequada.
4.  Gerar avaliações de teste para cada ferramenta.

O resultado é um servidor pronto para produção com tratamento de erros, paginação, limite de taxa e autenticação adequados — algo que normalmente levaria dias para construir manualmente.

## Princípios Chave de Design para Servidores MCP

### Cobertura de API vs. Ferramentas de Fluxo de Trabalho

A skill mcp-builder ensina um equilíbrio importante:

-   **Cobertura abrangente** dá aos agentes flexibilidade para compor operações.
-   **Ferramentas de fluxo de trabalho** agrupam operações comuns de várias etapas em chamadas únicas.
-   Quando estiver em dúvida, priorize a cobertura abrangente da API.

### Gerenciamento de Contexto

Os agentes funcionam melhor com dados focados e relevantes:

-   Retorne apenas os campos que os agentes precisam, não respostas inteiras da API.
-   Ofereça suporte à paginação para operações de listagem.
-   Inclua filtros para restringir os resultados.

### Testes e Avaliação

A skill mcp-builder gera avaliações automatizadas que testam:

-   **Caminho feliz** — Operação normal com entradas válidas.
-   **Casos extremos** — Resultados vazios, grandes conjuntos de dados, caracteres especiais.
-   **Tratamento de erros** — Entradas inválidas, falhas de autenticação, limites de taxa.
-   **Cenários do mundo real** — Fluxos de trabalho de várias etapas que encadeiam ferramentas.

## Instalação via Killer-Skills

A maneira mais rápida de começar é pelo marketplace do Killer-Skills:

```bash
# Navegue pelas skills oficiais
npx killer-skills search mcp

# Instale o mcp-builder
npx killer-skills add anthropics/skills/mcp-builder

# Verifique a instalação
npx killer-skills list
```

Uma vez instalada, a skill fica disponível automaticamente no Claude Code, Claude.ai e em qualquer integração com a API do Claude. Basta iniciar uma conversa sobre a construção de um servidor MCP e o Claude carregará as instruções da skill.

## O Que Vem a Seguir?

Os servidores MCP estão se tornando a forma padrão pela qual os agentes de IA interagem com o mundo. Com a skill mcp-builder, você não precisa ser um especialista no protocolo MCP — o Claude cuida da complexidade enquanto você se concentra no que seu servidor deve fazer.

Pronto para construir seu primeiro servidor MCP? Veja como começar hoje:

1.  **Instale a skill**: `npx killer-skills add anthropics/skills/mcp-builder`
2.  **Escolha sua API**: Escolha um serviço que você deseja integrar (Slack, Notion, JIRA, etc.)
3.  **Descreva suas necessidades**: Diga ao Claude quais ferramentas você precisa e ele construirá todo o servidor.
4.  **Implante e teste**: Use as avaliações geradas para validar seu servidor.

O futuro do desenvolvimento da IA não consiste em escrever mais código — consiste em dar aos agentes de IA as ferramentas certas para trabalhar. Servidores MCP e Agent Skills tornam esse futuro possível hoje.

---

*Quer explorar mais skills? Navegue pelo [Marketplace do Killer-Skills](https://killer-skills.com/pt/skills) para descobrir centenas de Agent Skills verificadas para o seu fluxo de trabalho de codificação de IA.*
