---
title: "MCP "
description: "MCP AI , mcp-builder , TypeScript Python "
pubDate: 2026-02-13
author: "Killer-Skills Team"
tags: ["MCP", "Tutorial", "Agent Skills", "Claude Code"]
lang: "ko"
featured: false
category: "developer-experience"
heroImage: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=2560&auto=format&fit=crop"
---
# MCP 서버 구축 방법: AI 에이전트가 실제 사용하는 서버

코드 작성만이 아니라 슬랙 메시지를 보낼 수 있고, 데이터베이스를 조회하고, 프로덕션에 배포하며, 전체 DevOps 파이프라인을 관리할 수 있는 AI 코딩 에이전트를 상상해 보십시오. 표준화된 프로토콜을 통해 이러한 모든 작업을 수행할 수 있습니다.

정확히 이러한 기능을 **MCP 서버** (Model Context Protocol)가 제공합니다. 또한 Anthropic의 스킬 저장소에서 공식 **mcp-builder** 스킬을 사용하면 몇 분 만에 프로덕션급 MCP 서버를 구축할 수 있습니다.

```bash
# mcp-builder 스킬을 한 명령어로 설치합니다
npx killer-skills add anthropics/skills/mcp-builder
```

이 가이드에서는 MCP 서버 구축에 필요한 모든 것을 배울 수 있습니다. 프로토콜을 이해하는 것부터 첫 번째 서버를 배포하는 것까지 모든 과정을 다룹니다.
## MCP 서버란?

MCP 서버는 AI 에이전트가 사용할 수 있는 도구, 리소스, 프롬프트를 노출하는 표준화된 서비스입니다. 이는 AI 어시스턴트와 현실 세계 — 데이터베이스, API, 파일 시스템, 클라우드 서비스 등 — 를 연결하는 다리라고 생각할 수 있습니다.

**모델 컨텍스트 프로토콜(Model Context Protocol, MCP)** 은 앤트로픽에서 기본적인 문제를 해결하기 위해 만들어졌습니다. AI 에이전트는 외부 서비스와 상호작용할 수 있는 보편적인 방법이 필요합니다. MCP 이전에는 각 통합에 대해 사용자 지정 코드가 필요했습니다. 이제 단일 프로토콜이 모든 것을 처리합니다.

MCP가 중요한 이유는 다음과 같습니다:

- **보편적인 호환성** — 클라우드, 커서, 윈드서핑 및 기타 MCP 호환 클라이언트와 함께 작동합니다.
- **표준화된 인터페이스** — 도구, 리소스, 프롬프트는 일관된 스키마를 따릅니다.
- **보안 우선 설계** — 내장된 인증, 입력 유효성 검사, 권한 제어가 포함되어 있습니다.
- **조합 워크플로** — 에이전트는 여러 MCP 도구를 함께 연결할 수 있습니다.
## MCP-빌더 スキルの 사용 이유

**mcp-builder** 스킬은 Anthropic의 공식 저장소에서 가장 강력한 스킬 중 하나입니다. Claude를 전문 MCP 서버 개발자로 변환하여 다음을 제공합니다:

1. **깊은 프로토콜 지식** — 스킬은 전체 MCP 사양을 로드하여 Claude가 모든 세부 사항을 이해하도록 함
2. **베스트 프랙티스 포함** — 툴 이름 지정, 오류 처리, 페이징 패턴이 모두 사전 구성됨
3. **프레임워크별 가이드** — TypeScript와 Python을 위한 최적화된 템플릿
4. **평가 생성** — MCP 서버를 위한 테스트 스위트를 자동으로 생성

스크래치부터 빌드하는 것과는 달리, mcp-builder 스킬은 구조화된 4단계 워크플로를 따릅니다:

| 단계 | 설명 |
|:------|:-------------|
| **1단계: 연구** | API를 연구하고, 툴 범위를 계획하고, 스키마를 설계 |
| **2단계: 빌드** | 적절한 오류 처리와 인증을 사용하여 서버를 구현 |
| **3단계: 검토** | 모든 툴을 테스트하고, 응답을 검증하고, 에지 케이스를 확인 |
| **4단계: 평가** | 품질을 검증하기 위한 자동화된 평가를 생성 |
## 시작하기: 첫 번째 MCP 서버 구축

### 1단계: 스킬 설치

먼저 Killer-Skills CLI가 설치되어 있는지 확인하세요:

```bash
npm install -g killer-skills
```

그런 다음 mcp-builder 스킬을 프로젝트에 추가합니다:

```bash
npx killer-skills add anthropics/skills/mcp-builder
```

스킬은 `.claude/skills/` 디렉토리에 추가되고 Claude가 MCP 서버 개발 작업을 обнаруж하면 자동으로 활성화됩니다.

### 2단계: 스택 선택

mcp-builder 스킬은 두 가지 주요 스택을 지원합니다:

**TypeScript (추천)**
```bash
npm init -y
npm install @modelcontextprotocol/sdk zod
```

TypeScript는 여러 가지 이유로 추천됩니다:
- 공식 MCP 팀의 고급 SDK 지원
- 정적 타이핑은 런타임 전에 오류를 捕获합니다
- 실행 환경과 강력한 호환성
- AI 모델은 TypeScript 코드 생성에 탁월합니다

**Python**
```bash
pip install mcp pydantic
```

Python은 팀이 이미 Python을 사용하거나 Python 기반 API와 통합하는 경우 좋은 선택입니다.

### 3단계: 도구 정의

훌륭한 MCP 서버의 핵심은 잘 설계된 도구입니다. 여기 템플릿이 있습니다:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
  name: "my-api-server",
  version: "1.0.0",
});

server.tool(
  "create_item",
  "시스템에 새 항목을 생성합니다",
  {
    name: z.string().describe("생성할 항목의 이름"),
    description: z.string().optional().describe("선택적 설명"),
    tags: z.array(z.string()).optional().describe("분류를 위한 태그"),
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

### 4단계: 모범 사례 구현

mcp-builder 스킬은 여러 가지 중요한 패턴을 적용합니다:

**도구 이름 규칙**
```
github_create_issue
slack_send_message
db_query_users

createIssue
send
doStuff
```

일관된 접두사(서비스 이름) + 동작 지향 동사를 사용하세요. 이렇게 하면 에이전트가 올바른 도구를 빠르게 발견하고 선택할 수 있습니다.

**실행 가능한 오류 메시지**
```typescript
// 나쁨
throw new Error("찾을 수 없음");

// 좋음
throw new Error(
  `"${owner}/${repo}" 리포지토리가 찾을 수 없습니다. ` +
  `리포지토리가 존재하고 접근할 수 있는지 확인하세요. ` +
  `github_list_repos를 사용하여 리포지토리를 나열해 보세요.`
);
```

**도구 주석**

모든 도구에는 에이전트가 그들의 동작을 이해하는 데 도움이 되는 주석을 포함해야 합니다:

```typescript
server.tool(
  "delete_item",
  "항목을 영구적으로 삭제합니다",
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
## 실제 예시: GitHub MCP 서버 구축

실제적인 예시를 살펴보겠습니다. GitHub 저장소를 관리하는 AI 에이전트용 MCP 서버를 구축하고 싶다고 가정해 보세요.

**mcp-builder 스킬을 활성화한 Claude에게 질문해 보세요:**

> "GitHub API용 MCP 서버를 구축해 주세요. 이슈 생성, 저장소 목록, 풀 리퀘스트 관리, 코드 검색 등을 지원해야 합니다."

Claude는:
1. GitHub REST API 문서를 조사합니다
2. 커버할 엔드포인트를 계획합니다 (일반적으로 15-25개의 도구)
3. 적절한 OAuth 인증이 포함된完整한 서버를 구축합니다
4. 각 도구에 대한 테스트 평가를 생성합니다

결과는 적절한 오류 처리, 페이징, 속도 제한 및 인증이 포함된 프로덕션 레디 서버입니다. 이는 수동으로 구축하는 경우 일반적으로 며칠이 걸리는 작업입니다.
## 주요 디자인 원칙 for MCP 서버

### API 범위 대 워크플로우 툴

mcp-builder 스킬은 중요한 균형을 가르칩니다:

- **전체적인 범위**가 에이전트에게 작업을 구성할 수 있는 유연성을 제공합니다
- **워크플로우 툴**이 일반적인 다단계 작업을 단일 호출로 묶습니다
- 확실하지 않으면 전체적인 API 범위를 우선시합니다

### 컨텍스트 관리

에이전트는 집중적이고 관련된 데이터로 최善의 성능을 발휘합니다:

- 에이전트가 필요한 필드만 반환하고, 전체 API 응답은 반환하지 않습니다
- 목록 작업을 위해 페이지네이션을 지원합니다
- 결과를 좁히기 위해 필터를 포함합니다

### 테스트 및 평가

mcp-builder 스킬은 자동 평가를 생성하여 다음을 테스트합니다:

- **행복한 경로** — 유효한 입력과 함께 정상적인 작업
- **경계 경우** — 빈 결과, 대형 데이터 세트, 특수 문자
- **오류 처리** — 유효하지 않은 입력, 인증 실패, 속도 제한
- **실제 세계 시나리오** — 툴을 연쇄하여 함께 연결하는 다단계 워크플로우
## Killer-Skills를 통해 설치하기

시작하는 가장 빠른 방법은 Killer-Skills 마켓플레이스를 통해 하는 것입니다:

```bash
# 공식 스킬을 브라우징합니다
npx killer-skills search mcp

# mcp-builder 설치
npx killer-skills add anthropics/skills/mcp-builder

# 설치 확인
npx killer-skills list
```

설치가 완료되면 스킬은 Claude Code, Claude.ai 및 Claude API 통합에서 자동으로 사용할 수 있습니다. MCP 서버 구축에 대한 대화를 시작하면 Claude가 스킬의 지침을 불러옵니다.
## 다음은 무엇인가?

MCP 서버는 AI 에이전트가 세계와 상호작용하는 표준 방법이 되고 있습니다. mcp-builder 스킬을 사용하면 MCP 프로토콜 전문가가 될 필요가 없습니다. Claude가 복잡성을 처리하는 동안 서버가 해야 할 일을 집중할 수 있습니다.

첫 번째 MCP 서버를 빌드할 준비가 됐나요? 오늘 시작하는 방법은 다음과 같습니다:

1. **스킬 설치**: `npx killer-skills add anthropics/skills/mcp-builder`
2. **API 선택**: 통합하려는 서비스를 선택하세요 (Slack, Notion, JIRA 등)
3. **요구 사항 설명**: Claude에게 필요한 도구를 설명하면 전체 서버를 빌드합니다
4. **배포 및 테스트**: 생성된 평가를 사용하여 서버를 검증하세요

AI 개발의 미래는 더 많은 코드를 작성하는 것이 아닙니다. AI 에이전트가 작업할 수 있는 올바른 도구를 제공하는 것입니다. MCP 서버와 에이전트 스킬이 오늘 그 미래를 가능하게 합니다.

---
*더 많은 스킬을探索하세요? [Killer-Skills Marketplace](https://killer-skills.com/ko/skills)를 브라우즈하여 AI 코딩 워크플로우를 위한 수백 개의 검증된 에이전트 스킬을 발견하세요.*

---
*관련: [AI 에이전트 스킬이란 무엇인가?](/ko/blog/what-are-ai-agent-skills) 및 [2026년 최고의 AI 에이전트 스킬](/ko/blog/best-ai-agent-skills-2026)*