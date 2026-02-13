---
title: "MCP 서버를 구축하는 방법: Agent Skills를 활용한 전체 가이드"
description: "공식 mcp-builder 스킬을 사용하여 AI 에이전트를 위한 상용 수준의 MCP 서버를 구축하는 방법을 배웁니다. TypeScript와 Python을 사용한 설정, 도구 설계, 테스트 및 배포를 다룹니다."
pubDate: 2026-02-13
author: "Killer-Skills 팀"
tags: ["MCP", "튜토리얼", "Agent Skills", "Claude Code"]
lang: "ko"
featured: false
category: "developer-experience"
heroImage: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=2560&auto=format&fit=crop"
---

# AI 에이전트가 실제로 사용하는 MCP 서버 구축 방법

여러분의 AI 코딩 에이전트가 단순히 코드를 작성하는 것 이상을 할 수 있다면 어떨까요? Slack 메시지를 보내고, 데이터베이스를 쿼리하고, 프로덕션에 배포하고, 전체 DevOps 파이프라인을 관리하는 등의 작업을 표준화된 프로토콜을 통해 수행할 수 있다면 말이죠.

이것이 바로 **MCP 서버**(Model Context Protocol)가 가능하게 하는 일입니다. 그리고 Anthropic의 스킬 저장소에 있는 공식 **mcp-builder** 스킬을 사용하면 몇 시간이 아니라 몇 분 만에 상용 등급의 MCP 서버를 구축할 수 있습니다.

```bash
# 명령 한 번으로 mcp-builder 스킬 설치
npx killer-skills add anthropics/skills/mcp-builder
```

이 가이드에서는 프로토콜 이해부터 첫 번째 서버 배포까지 MCP 서버 구축에 대해 알아야 할 모든 것을 배우게 됩니다.

## MCP 서버란 무엇인가요?

**MCP 서버**는 AI 에이전트가 사용할 수 있는 도구, 리소스 및 프롬프트를 공개하는 표준화된 서비스입니다. AI 어시스턴트와 실제 세계(데이터베이스, API, 파일 시스템, 클라우드 서비스 등) 사이의 다리라고 생각하시면 됩니다.

**Model Context Protocol**(MCP)은 AI 에이전트가 외부 서비스와 상호 작용할 수 있는 범용적인 방법이 필요하다는 근본적인 문제를 해결하기 위해 Anthropic에서 만들었습니다. MCP 이전에는 모든 통합에 커스텀 코드가 필요했습니다. 이제는 단일 프로토콜로 모든 것을 처리할 수 있습니다.

MCP가 중요한 이유는 다음과 같습니다:

-   **범용 호환성** — Claude, Cursor, Windsurf 및 모든 MCP 호환 클라이언트와 작동합니다.
-   **표준화된 인터페이스** — 도구, 리소스 및 프롬프트가 일관된 스키마를 따릅니다.
-   **보안 중심 설계** — 내장된 인증, 입력 유효성 검사 및 권한 제어 기능이 있습니다.
-   **결합 가능한 워크플로우** — 에이전트가 여러 MCP 도구를 함께 연결할 수 있습니다.

## 왜 mcp-builder 스킬을 사용해야 하나요?

**mcp-builder** 스킬은 Anthropic의 공식 저장소에서 가장 강력한 스킬 중 하나입니다. 이 스킬은 다음을 제공하여 Claude를 전문적인 MCP 서버 개발자로 변화시킵니다:

1.  **깊은 프로토콜 지식** — 이 스킬은 전체 MCP 사양을 로드하므로 Claude가 모든 세부 사항을 이해합니다.
2.  **모범 사례 내장** — 도구 명명, 오류 처리 및 페이지네이션 패턴이 모두 사전 구성되어 있습니다.
3.  **프레임워크별 가이드** — TypeScript와 Python 모두에 최적화된 템플릿을 제공합니다.
4.  **평가(Evaluation) 생성** — MCP 서버를 위한 테스트 스위트를 자동으로 생성합니다.

처음부터 직접 구축하는 것과 달리, mcp-builder 스킬은 체계적인 4단계 워크플로우를 따릅니다:

| 단계 | 수행 내용 |
|:------|:-------------|
| **1단계: 리서치** | API 연구, 도구 적용 범위 계획, 스키마 설계 |
| **2단계: 구축** | 적절한 오류 처리 및 인증 기능이 포함된 서버 구현 |
| **3단계: 검토** | 모든 도구 테스트, 응답 유효성 검사, 예외 케이스 확인 |
| **4단계: 평가** | 품질 검증을 위한 자동화된 평가 생성 |

## 시작하기: 첫 번째 MCP 서버 구축하기

### 1단계: 스킬 설치

먼저 Killer-Skills CLI가 설치되어 있는지 확인하세요:

```bash
npm install -g killer-skills
```

그런 다음 프로젝트에 mcp-builder 스킬을 추가합니다:

```bash
npx killer-skills add anthropics/skills/mcp-builder
```

스킬은 `.claude/skills/` 디렉토리에 추가되며, Claude가 MCP 서버 개발 작업을 감지하면 자동으로 활성화됩니다.

### 2단계: 스택 선택

mcp-builder 스킬은 두 가지 주요 스택을 지원합니다:

**TypeScript (권장)**
```bash
npm init -y
npm install @modelcontextprotocol/sdk zod
```

TypeScript는 다음과 같은 이유로 권장됩니다:
-   공식 MCP 팀의 고품질 SDK 지원
-   정적 타이핑을 통한 런타임 전 오류 감지
-   실행 환경과의 강력한 호환성
-   AI 모델이 TypeScript 코드 생성에 뛰어남

**Python**
```bash
pip install mcp pydantic
```

팀이 이미 Python을 사용 중이거나 Python 라이브러리가 많은 API를 통합하는 경우 Python이 좋은 선택입니다.

### 3단계: 도구 정의

훌륭한 MCP 서버의 핵심은 잘 설계된 도구입니다. 템플릿은 다음과 같습니다:

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

mcp-builder 스킬은 다음과 같은 몇 가지 중요한 패턴을 적용합니다:

**도구 명명 규칙**
```
✅ github_create_issue
✅ slack_send_message
✅ db_query_users

❌ createIssue
❌ send
❌ doStuff
```

일관된 접두사(서비스 이름) + 동작 중심의 동사를 사용하세요. 이는 에이전트가 적절한 도구를 빠르게 찾고 선택하는 데 도움이 됩니다.

**실행 가능한 오류 메시지**
```typescript
// ❌ 나쁜 예
throw new Error("Not found");

// ✅ 좋은 예
throw new Error(
  `"${owner}/${repo}" 저장소를 찾을 수 없습니다. ` +
  `저장소가 존재하고 액세스 권한이 있는지 확인하세요. ` +
  `먼저 github_list_repos 명령으로 저장소 목록을 확인해 보세요.`
);
```

**도구 어노테이션**

모든 도구에는 에이전트가 동작을 이해하는 데 도움이 되는 어노테이션이 포함되어야 합니다:

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

## 실제 사례: GitHub MCP 서버 구축

현실적인 예를 살펴보겠습니다. AI 에이전트가 GitHub 저장소를 관리할 수 있도록 하는 MCP 서버를 구축한다고 가정해 보겠습니다.

**mcp-builder 스킬이 활성화된 상태에서 Claude에게 요청하세요:**

> "GitHub API용 MCP 서버를 구축해 줘. 이슈 생성, 저장소 목록 조회, 풀 리퀘스트 관리, 코드 검색 기능을 지원해야 해."

Claude는 다음과 같은 작업을 수행합니다:
1.  GitHub REST API 문서 조사
2.  적용할 엔드포인트 계획 (일반적으로 15-25개 도구)
3.  적절한 OAuth 인증이 포함된 완벽한 서버 구축
4.  각 도구에 대한 테스트 평가 생성

결과는 적절한 오류 처리, 페이지네이션, 요율 제한 및 인증 기능을 갖춘 상용 수준의 서버입니다. 이는 일반적으로 수동으로 구축하는 데 며칠이 걸리는 작업입니다.

## MCP 서버 핵심 설계 원칙

### API 적용 범위 vs. 워크플로우 도구

mcp-builder 스킬은 중요한 균형을 가르쳐 줍니다:

-   **포괄적인 적용 범위**는 에이전트에게 작업을 유연하게 조합할 수 있는 능력을 부여합니다.
-   **워크플로우 도구**는 여러 단계로 이루어진 공통 작업을 단일 호출로 묶어줍니다.
-   불확실할 때는 포괄적인 API 적용 범위를 우선시하세요.

### 컨텍스트 관리

에이전트는 집중되고 관련성 있는 데이터를 사용할 때 가장 잘 작동합니다:

-   전체 API 응답이 아니라 에이전트에게 필요한 필드만 반환하세요.
-   목록 작업에 대해 페이지네이션을 지원하세요.
-   결과를 좁히기 위한 필터를 포함하세요.

### 테스트 및 평가

mcp-builder 스킬은 다음을 테스트하는 자동화된 평가를 생성합니다:

-   **해피 패스(Happy path)** — 유효한 입력에 대한 정상적인 작동
-   **예외 케이스** — 빈 결과, 대규모 데이터셋, 특수 문자
-   **오류 처리** — 잘못된 입력, 인증 실패, 요율 제한
-   **실제 시나리오** — 도구를 연결하는 다단계 워크플로우

## Killer-Skills를 통한 설치

가장 빠르게 시작하는 방법은 Killer-Skills 마켓플레이스를 통하는 것입니다:

```bash
# 공식 스킬 검색
npx killer-skills search mcp

# mcp-builder 설치
npx killer-skills add anthropics/skills/mcp-builder

# 설치 확인
npx killer-skills list
```

설치가 완료되면 Claude Code, Claude.ai 및 모든 Claude API 연동 환경에서 스킬을 자동으로 사용할 수 있습니다. MCP 서버 구축에 대한 대화를 시작하기만 하면 Claude가 스킬의 지침을 로드합니다.

## 다음 단계는?

MCP 서버는 AI 에이전트가 세상과 상호 작용하는 표준 방식이 되고 있습니다. mcp-builder 스킬이 있다면 여러분이 MCP 프로토콜 전문가가 될 필요가 없습니다. 여러분은 서버가 무엇을 해야 할지에 집중하고, 복잡한 부분은 Claude에게 맡기세요.

첫 번째 MCP 서버를 구축할 준비가 되셨나요? 오늘 바로 시작하는 방법은 다음과 같습니다:

1.  **스킬 설치**: `npx killer-skills add anthropics/skills/mcp-builder`
2.  **API 선택**: 연동하고 싶은 서비스(Slack, Notion, JIRA 등)를 선택하세요.
3.  **요구 사항 설명**: 필요한 도구를 Claude에게 설명하면 서버 전체가 구축됩니다.
4.  **배포 및 테스트**: 생성된 평가를 사용하여 서버를 검증하세요.

AI 개발의 미래는 더 많은 코드를 작성하는 것이 아니라, AI 에이전트에게 적절한 도구를 제공하는 것입니다. MCP 서버와 Agent Skills는 그 미래를 오늘 바로 가능하게 합니다.

---

*더 많은 스킬을 탐색하고 싶으신가요? [Killer-Skills 마켓플레이스](https://killer-skills.com/ko/skills)를 방문하여 수백 개의 검증된 에이전트 스킬을 찾아보세요.*
