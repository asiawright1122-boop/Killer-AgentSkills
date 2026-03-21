---
title: '30초 만에 AI 에이전트 스킬 설치하는 방법'
description: 'killer-skills CLI 도구를 사용하여 Claude Code, Cursor 또는 Windsurf에 커뮤니티 AI 에이전트 스킬을 설치하는 빠른 가이드입니다.'
pubDate: 2026-02-24
author: 'Killer-Skills Team'
tags: ['Tutorial', 'AI Agent Skills', 'CLI', 'Developer Tools', 'Automation']
lang: 'ko'
featured: false
category: 'guides'
heroImage: 'https://images.unsplash.com/photo-1629654297299-c8506221ca97?q=80&w=2560&auto=format&fit=crop'
---

# AI 에이전트 스킬 설치 방법

원하는 AI 에이전트 스킬을 찾았습니다. 아마도 [docx 자동화 스킬](/ko/skills/anthropics/skills/docx)일 수도 있고,専門된 프론트엔드 UI 생성기일 수도 있습니다. 이제 프로젝트에 통합하여 코딩 에이전트가 실제로 읽을 수 있도록 해야 합니다.

수동으로 마크다운 텍스트를 복사하여 붙여넣고, 올바른 디렉토리를 생성하고, 프론트매터 형식을 수동으로 고칠 수 있습니다. 또는 자동으로 모든 것을 처리해주는 하나의 명령을 실행할 수 있습니다.

## 킬러 스킬 CLI

특히 이를 위해 명령줄 도구를 구축했습니다. GitHub에서 스킬을 가져오는 것, IDE(Claude Code, Cursor, Windsurf 또는 GitHub Copilot)에 적합한 형식으로 변환하는 것, 올바른 디렉토리에 배치하는 것을 처리합니다.

영구적으로 설치할 필요는 없습니다. Node.js와 함께 제공되는 `npx`를 통해 직접 실행할 수 있습니다.

터미널을 열고 프로젝트 디렉토리로 이동하여 실행합니다:

```bash
npx killer-skills add owner/repo
```

예를 들어, PDF 자동화 스킬을 설치하려면 다음을 실행합니다:

```bash
npx killer-skills add anthropics/skills/pdf
```

CLI는 프로젝트 파일을 확인하여 사용 중인 IDE를 감지합니다. `.cursor` 디렉토리가 보이면 스킬을 `.mdc` 파일로 형식화합니다. `.claude` 디렉토리가 보이면 `SKILL.md`로 형식화합니다.

## 여러 IDE에 걸친 설치

같은 프로젝트에서 여러 에이전트를 사용하는 경우(예: 터미널의 Claude Code와 편집기로 Cursor를 사용하는 경우), CLI가 모든 에이전트에 대한 스킬을 한꺼번에 설치하도록 강제할 수 있습니다.

`--all` 플래그를 추가하기만 하면 됩니다:

```bash
npx killer-skills add anthropics/skills/pdf --all
```

이렇게 하면 `.claude/skills/`와 `.cursor/rules/`에 필요한 파일이 생성되며, 핵심 지침은 동일하게 유지되면서 각 에이전트에 대한 메타데이터가 올바르게 형식화됩니다.

## 스킬 설치 찾기

직접 설치하고 싶은 스킬을 알고 있지만 정확한 저장소 경로를 기억하지 못할 경우, 터미널에서 직접 검색할 수 있습니다:

```bash
npx killer-skills search auth
```

이 명령어는 커뮤니티 데이터베이스를 검색하여 상위 일치 항목을 반환하며, 이는 스킬의 별점 수와 전체 설치 경로를 포함합니다. 또한 [Killer-Skills 웹사이트](/ko/skills)에서 전체 오픈소스 디렉토리를 브라우징할 수 있습니다.

## 기술 스킬 유지하기

기술 스킬은不断으로 발전합니다. 작성자들은 새로운 edge case를 추가하고, 잘못된 지침을 수정하며, 프롬프트 신뢰성을 향상시킵니다. CLI를 통해 기술 스킬을 설치하였으므로, 쉽게 업데이트할 수 있습니다.

```bash
npx killer-skills update
```

이 명령어는 설치한 모든 기술 스킬을 확인하고, GitHub의 업스트림 소스와 비교한 후, 가능한 경우 로컬 수정 사항을 보존하면서 업데이트를 적용합니다.

## 실제로 무엇이 일어나는 걸까요?

`add` 명령을 실행하면, CLI는 실행 가능한 소프트웨어나 npm 종속성을 설치하지 않습니다. 단순히 텍스트를 다운로드합니다.

스킬은 Large Language Model에 대한 지시가 포함된 마크다운 파일에 불과합니다. CLI는 해당 마크다운을 가져와, 편집기가 기대하는 특정 YAML 또는 JSON 형식으로 감싸고, 로컬 폴더에 작성합니다.

배경 프로세스, 전화 홈 텔레메트리, 숨겨진 페이로드는 없습니다. 단순히 문서화된 내용이기 때문에, AI 에이전트가 그것을 찾기 위해 보는 정확한 위치에 배치됩니다.

---

_관련: [AI 에이전트 스킬이란 무엇인가?](/ko/blog/what-are-ai-agent-skills) 및 [2026 년을 위한 최고의 AI 에이전트 스킬](/ko/blog/best-ai-agent-skills-2026)_
