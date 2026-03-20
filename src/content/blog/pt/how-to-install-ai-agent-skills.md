---
title: "Como instalar habilidades de agente de IA em 30 segundos"
description: "Um guia rápido para instalar habilidades de agente de IA da comunidade no Claude Code, Cursor ou Windsurf usando a ferramenta CLI killer-skills."
pubDate: 2026-02-24
author: "Killer-Skills Team"
tags: ["Tutorial", "AI Agent Skills", "CLI", "Developer Tools", "Automation"]
lang: "pt"
featured: false
category: "guides"
heroImage: "https://images.unsplash.com/photo-1629654297299-c8506221ca97?q=80&w=2560&auto=format&fit=crop"
---
# Como instalar habilidades de agente de IA

Você encontrou uma habilidade de agente de IA que deseja usar. Talvez seja a [habilidade de automação de docx](/en/skills/anthropics/skills/docx), ou talvez um gerador de interface de usuário de frontend especializado. Agora você precisa adicioná-la ao seu projeto para que o agente de codificação possa lê-la.

Você pode copiar e colar manualmente o texto em markdown, criar os diretórios certos e corrigir o formato de frontmatter você mesmo. Ou pode executar um comando que faz isso por você.
## A ferramenta de linha de comando killer-skills

Construímos uma ferramenta de linha de comando especificamente para isso. Ela lida com a obtenção da habilidade do GitHub, converte-a para o formato correto para o seu IDE (Claude Code, Cursor, Windsurf ou GitHub Copilot) e a coloca no diretório correto.

Você não precisa instalá-la permanentemente. Você pode executá-la diretamente via `npx` (que vem com o Node.js).

Abra o seu terminal, vá para o diretório do seu projeto e execute:

```bash
npx killer-skills add owner/repo
```

Por exemplo, para instalar a habilidade de automação de PDF, você executa:

```bash
npx killer-skills add anthropics/skills/pdf
```

A CLI detecta qual IDE você está usando, olhando para os arquivos do seu projeto. Se ela vê um diretório `.cursor`, formata a habilidade como um arquivo `.mdc`. Se ela vê um diretório `.claude`, formata-a como `SKILL.md`.
## Instalando em múltiplos IDEs

Se você usa vários agentes no mesmo projeto (por exemplo, Claude Code no terminal e Cursor como editor), você pode forçar a CLI a instalar a habilidade para todos eles de uma vez.

Basta adicionar a flag `--all`:

```bash
npx killer-skills add anthropics/skills/pdf --all
```

Isso cria os arquivos necessários em `.claude/skills/` e `.cursor/rules/`, mantendo as instruções principais idênticas enquanto formata os metadados corretamente para cada agente.
## Encontrando habilidades para instalar

Se você sabe o que está procurando, mas não lembra do caminho exato do repositório, pode pesquisar diretamente do terminal:

```bash
npx killer-skills search auth
```

Isso consulta o banco de dados da comunidade e retorna as principais correspondências, incluindo a contagem de estrelas e os caminhos de instalação completos. Você também pode navegar pelo diretório de código aberto completo no site [Killer-Skills](/pt/skills).
## Mantendo as habilidades atualizadas

As habilidades evoluem. Os autores adicionam novos casos de bordo, corrigem instruções ruins e melhoram a confiabilidade das solicitações. Como você instalou a habilidade via CLI, você pode atualizá-la com a mesma facilidade.

```bash
npx killer-skills update
```

Isso verifica todas as habilidades que você instalou, compara-as com a fonte upstream no GitHub e aplica quaisquer atualizações preservando as modificações locais sempre que possível.
## O que está realmente acontecendo por trás dos panos?

Quando você executa o comando `add`, a CLI não está instalando software executável ou dependências do npm. Está apenas baixando texto.

Uma habilidade é simplesmente um arquivo markdown com instruções para um Modelo de Linguagem Grande. A CLI busca esse markdown, envolve-o no formato YAML ou JSON específico que o seu editor espera, e o escreve em uma pasta local.

Não há processos em segundo plano, nenhuma telemetria de telefone para casa e nenhum payload oculto. É apenas documentação, colocada exatamente onde o seu agente de IA sabe procurar por ela.

---
*Relacionado: [O que são habilidades de agente de IA?](/pt/blog/what-are-ai-agent-skills) e [Melhores habilidades de agente de IA para 2026](/pt/blog/best-ai-agent-skills-2026)*