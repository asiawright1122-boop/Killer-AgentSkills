---
title: "Como Construir Servidores MCP: Um Guia Completo Usando Habilidades de Agente"
description: "Construa servidores MCP prontos para produção com habilidades de agente. Aprenda configuração, design de ferramentas, teste e implantação com TypeScript e"
pubDate: 2026-02-13
author: "Killer-Skills Team"
tags: ["MCP", "Tutorial", "Agent Skills", "Claude Code"]
lang: "pt"
featured: false
category: "developer-experience"
heroImage: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=2560&auto=format&fit=crop"
---
# Como Construir Servidores MCP Que Agentes de IA Realmente Usam

O que aconteceria se o seu agente de codificação de IA pudesse fazer mais do que apenas escrever código? O que aconteceria se ele pudesse enviar mensagens do Slack, consultar bancos de dados, implantar em produção e gerenciar toda a pipeline de DevOps — tudo por meio de um protocolo padronizado?

É exatamente isso que os **servidores MCP** (Protocolo de Contexto de Modelo) tornam possível. E com a habilidade oficial **mcp-builder** do repositório de habilidades da Anthropic, você pode construir servidores MCP de nível de produção em minutos em vez de horas.

```bash
# Instale a habilidade mcp-builder com um comando
npx killer-skills add anthropics/skills/mcp-builder
```

Mais do que seguir um tutorial linear, o ponto central ao construir um servidor MCP é decidir quais capacidades realmente merecem virar ferramentas, como descrevê-las para agentes e como manter autenticação, limites e observabilidade sob controle desde o início.

## O que é um Servidor MCP?

Um **servidor MCP** é um serviço padronizado que expõe ferramentas, recursos e prompts para agentes de IA consumirem. Pense nele como uma ponte entre seu assistente de IA e o mundo real — bancos de dados, APIs, sistemas de arquivos, serviços de nuvem e muito mais.

O **Protocolo de Contexto de Modelo** (MCP) foi criado pela Anthropic para resolver um problema fundamental: os agentes de IA precisam de uma forma universal de interagir com serviços externos. Antes do MCP, cada integração exigia código personalizado. Agora, um único protocolo lida com tudo.

Aqui está por que o MCP é importante:

- **Compatibilidade universal** — Funciona com Claude, Cursor, Windsurf e qualquer cliente compatível com MCP
- **Interface padronizada** — Ferramentas, recursos e prompts seguem um esquema consistente
- **Projeto com segurança em primeiro lugar** — Autenticação integrada, validação de entrada e controles de permissão
- **Fluxos de trabalho compostos** — Agentes podem encadear várias ferramentas MCP juntas
## Por que usar a habilidade mcp-builder?

A habilidade **mcp-builder** é uma das habilidades mais poderosas no repositório oficial da Anthropic. Ela transforma o Claude em um desenvolvedor de servidor MCP especializado, fornecendo:

1. **Conhecimento profundo do protocolo** — A habilidade carrega a especificação completa do MCP, para que o Claude entenda todos os detalhes
2. **Melhores práticas integradas** — Nomenclatura de ferramentas, tratamento de erros e padrões de paginação estão todos pré-configurados
3. **Guias específicos de framework** — Modelos otimizados para TypeScript e Python
4. **Geração de avaliações** — Cria automaticamente conjuntos de testes para o servidor MCP

Ao contrário de construir do zero, a habilidade mcp-builder segue um fluxo de trabalho estruturado em 4 fases:

| Fase | O que acontece |
|:------|:-------------|
| **Fase 1: Pesquisa** | Estuda a API, planeja a cobertura de ferramentas, projeta o esquema |
| **Fase 2: Construção** | Implementa o servidor com tratamento de erros e autenticação adequados |
| **Fase 3: Revisão** | Testa todas as ferramentas, valida respostas, verifica casos limite |
| **Fase 4: Avaliação** | Cria avaliações automatizadas para verificar a qualidade |
## Primeiros passos com uma base sólida

### Instalar a Habilidade

Você não precisa de uma instalação global da CLI. Adicione a habilidade mcp-builder diretamente com `npx`:

```bash
npx killer-skills add anthropics/skills/mcp-builder
```

A habilidade será adicionada ao diretório `.claude/skills/` e ativada automaticamente quando o Claude detectar tarefas de desenvolvimento de servidor MCP.

### Escolha sua pilha

A habilidade mcp-builder suporta duas pilhas principais:

**TypeScript (Recomendado)**
```bash
npm init -y
npm install @modelcontextprotocol/sdk zod
```

TypeScript é recomendado por várias razões:
- Suporte de SDK de alta qualidade da equipe oficial do MCP
- Tipagem estática detecta erros antes da execução
- Forte compatibilidade com ambientes de execução
- Modelos de IA excelentes em gerar código TypeScript

**Python**
```bash
pip install mcp pydantic
```

Python é uma ótima escolha se sua equipe já usa Python ou está integrando com APIs pesadas em Python.

### Definir ferramentas

A chave para um ótimo servidor MCP é ferramentas bem projetadas. Aqui está um modelo:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
  name: "my-api-server",
  version: "1.0.0",
});

server.tool(
  "create_item",
  "Cria um novo item no sistema",
  {
    name: z.string().describe("Nome do item a criar"),
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

### Aplicar as práticas mais importantes

A habilidade mcp-builder impõe vários padrões críticos:

**Convenção de Nomenclatura de Ferramentas**
```
✅ github_create_issue
✅ slack_send_message
✅ db_query_users

❌ createIssue
❌ send
❌ doStuff
```

Use prefixos consistentes (nome do serviço) + verbos orientados à ação. Isso ajuda os agentes a descobrir e selecionar as ferramentas certas rapidamente.

**Mensagens de Erro Ação**
```typescript
// ❌ Ruim
throw new Error("Não encontrado");

// ✅ Bom
throw new Error(
  `Repositório "${owner}/${repo}" não encontrado. ` +
  `Verifique se o repositório existe e você tem acesso. ` +
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

Vamos passar por um exemplo realista. Suponha que você queira construir um servidor MCP que permita que agentes de IA gerenciem repositórios do GitHub.

**Pergunte a Claude com a habilidade mcp-builder ativa:**

> "Construa para mim um servidor MCP para a API do GitHub. Ele deve suportar a criação de problemas, listagem de repositórios, gerenciamento de solicitações de pull e busca de código."

Claude fará:
1. Pesquisar a documentação da API REST do GitHub
2. Planejar quais endpoints cobrir (tipicamente 15-25 ferramentas)
3. Construir o servidor completo com autenticação OAuth adequada
4. Gerar avaliações de teste para cada ferramenta

O resultado é um servidor pronto para produção com tratamento de erros adequado, paginação, limitação de taxa e autenticação — algo que normalmente levaria dias para ser construído manualmente.
## Princípios de Design Chave para Servidores MCP

### Cobertura da API vs. Ferramentas de Fluxo de Trabalho

A habilidade mcp-builder ensina um importante equilíbrio:

- **Cobertura abrangente** fornece aos agentes flexibilidade para compor operações
- **Ferramentas de fluxo de trabalho** agrupam operações multi-etapa comuns em chamadas únicas
- Quando incerto, priorize a cobertura abrangente da API

### Gerenciamento de Contexto

Os agentes funcionam melhor com dados focados e relevantes:

- Retorne apenas os campos que os agentes precisam, não respostas de API inteiras
- Suporte à paginação para operações de lista
- Inclua filtros para estreitar os resultados

### Testes e Avaliação

A habilidade mcp-builder gera avaliações automatizadas que testam:

- **Caminho feliz** — Operação normal com entradas válidas
- **Casos de bordo** — Resultados vazios, conjuntos de dados grandes, caracteres especiais
- **Tratamento de erros** — Entradas inválidas, falhas de autenticação, limites de taxa
- **Cenários do mundo real** — Fluxos de trabalho multi-etapa que encadeiam ferramentas juntas
## Instalação via Killer-Skills

A maneira mais rápida de começar é pelo diretório de skills do Killer-Skills:

```bash
# Browse the official skills
npx killer-skills search mcp

# Install mcp-builder
npx killer-skills add anthropics/skills/mcp-builder

# Verify installation
npx killer-skills list
```

Uma vez instalado, a habilidade estará automaticamente disponível no Claude Code, Claude.ai e em qualquer integração da API Claude. Basta iniciar uma conversa sobre construir um servidor MCP e o Claude carregará as instruções da habilidade.
## O que vem a seguir?

Os servidores MCP estão se tornando a forma padrão como os agentes de IA interagem com o mundo. Com a habilidade mcp-builder, você não precisa ser um especialista no protocolo MCP — Claude lida com a complexidade enquanto você se concentra no que seu servidor deve fazer.

Pronto para criar seu primeiro servidor MCP? Aqui está como começar hoje:

1. **Instale a habilidade**: `npx killer-skills add anthropics/skills/mcp-builder`
2. **Escolha sua API**: Escolha um serviço que você deseja integrar (Slack, Notion, JIRA, etc.)
3. **Descreva suas necessidades**: Diga a Claude quais ferramentas você precisa, e ele construirá o servidor inteiro
4. **Implante e teste**: Use as avaliações geradas para validar seu servidor

O futuro do desenvolvimento de IA não é sobre escrever mais código — é sobre dar aos agentes de IA as ferramentas certas para trabalhar. Os servidores MCP e as Habilidades de Agente tornam esse futuro possível hoje.

---

*Quer explorar mais habilidades? Navegue pelo [diretório de skills do Killer-Skills](https://killer-skills.com/pt/skills) para descobrir centenas de Habilidades de Agente verificadas para seu fluxo de trabalho de codificação de IA.*

---

*Relacionado: [O que são habilidades de agente de IA?](/pt/blog/what-are-ai-agent-skills) e [Melhores habilidades de agente de IA para 2026](/pt/blog/best-ai-agent-skills-2026)*