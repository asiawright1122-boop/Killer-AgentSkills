---
title: "دليل خطوة بخطوة: تعزيز OpenClaw بمهارات قاتلة لتنمية واعٍ متقدم للوكلاء الذكاء الاصطناعي"
description: "تعزيز OpenClaw بمهارات قاتلة: دليل شاملة لتنمية واعٍ متقدم للوكلاء الذكاء الاصطناعي. اكتشف كيفية مزامنة المهارات الاحترافية مع OpenClaw وتطوير مساعد ذكاء ا"
pubDate: 2026-03-02
author: "Killer-Skills Team"
tags: ["OpenClaw", "Tutorial", "AI Configuration"]
lang: "ar"
featured: false
category: "guides"
heroImage: "/blog/openclaw-killer-integration-hero.webp"
---
# دليل خطوة بخطوة: تعزيز OpenClaw بمهارات قاتلة

في المقالات السابقة، قدمنا [الإمكانيات الهائلة لـ OpenClaw](/ar/blog/introducing-openclaw-autonomous-ai-agent) و[senarios تطبيقها المتنوع](/ar/blog/openclaw-application-scenarios). اليوم، نمضي إلى الجزء العملي: **كيف يمكنك منح وسيط OpenClaw ألف مهارة محترفة في لحظة؟**

مع **Killer-Skills**، يمكنك حقن نظام معياري من القواعد في OpenClaw، مما يسمح له باكتشاف منطق معقد بشكل مستقل وتطبيقه.
## Step 1: تثبيت Killer-Skills CLI

أولاً، تأكد من أن لديك Node.js مثبتًا على نظامك. قم بتشغيل الأمر التالي في طرفية لتحميل Killer-Skills CLI الأحدث:

```bash
npm install -g killer-skills
```

بعد التثبيت، يمكنك تشغيل `killer --version` للتأكد من أن الإصدار هو **1.9.0 أو أعلى** (بدء الدعم الرسمي من OpenClaw من هذه الإصدار).
## Step 2: Initialize OpenClaw Support in Your Project

انتقل إلى الدليل الجذر للمشروع الذي تريد تشغيل OpenClaw فيه وتشغيل أمر التهيئة:

```bash
killer init
```

عند الطلب لتحديد بيئة تطوير متكاملة أو وكيل ، اختر **OpenClaw**. هذا الإجراء يخلق ملف التعريف `.openclaw` و `AGENTS.md` (إذا لم يكن موجودًا بالفعل) في مشروعك ، وهو المكان القياسي حيث تقرأ OpenClaw الإرشادات على مستوى النظام.
## Step 3: تثبيت ومزامنة المهارات

الآن ، يمكنك اختيار أي مهارة تحتاجها. على سبيل المثال ، إذا كنت تريد منح OpenClaw القدرة على تصميم الويب:

1.  **بحث وتثبيت المهارة**:
    ```bash
    killer install frontend-design
    ```
2.  **مزامنة مع OpenClaw**:
    ```bash
    killer sync --ide openclaw
    ```

أمر `killer sync` يولد تلقائيًا مجموعة من كتل التحفيز XML التي تفهمها OpenClaw ويضخها في `AGENTS.md`.
## Scenario-based Skill Packs

للمساعدة في البدء بسرعة، قمنا بتنظيم "حزم تركيب بضغطة زر واحدة" لمختلف السيناريوهات:

### 1. حزمة آليات المكتب (Office Pro)
適合 للمستخدمين الذين يحتاجون إلى التعامل مع حجم كبير من المستندات والتقارير.
```bash
killer install pdf xlsx docx humanizer
killer sync --ide openclaw
```

### 2. حزمة تعزيز المطور (Dev Alpha)
適合 للمطورين الذين يحتاجون إلى مساعدة الذكاء الاصطناعي في البرمجة والاختبار وتوسيع سلاسل الأدوات.
```bash
killer install frontend-design webapp-testing mcp-builder
killer sync --ide openclaw
```

### 3. حزمة إنشاء المحتوى (Creator Suite)
適合 للمدونين، مدراء وسائل الإعلام الاجتماعية، ومخططي المقترحات.
```bash
killer install humanizer canvas-design internal-comms
killer sync --ide openclaw
```
## Step 4: Invoke in OpenClaw

اشترِ экземпляر OpenClaw. منذ أن قمنا بمزامنة المهارات، يمكنك الآن إصدار أوامر مباشرة بلغة طبيعية:

> **الأمر**: "OpenClaw، صمم صفحة تسجيل دخول حديثة المظهر بناءً على هيكل المشروع الحالي واستخدام مواصفات مهارة تصميم الواجهة الأمامية."

سيتمكن OpenClaw من الكشف عن تعريفات المهارات في `AGENTS.md`، وتفعيل المنطق المقابل تلقائيًا، و生成 الشفرة محليًا.
## لماذا تختار Killer-Skills + OpenClaw؟

-   **المعايير**: لا حاجة لكتابة تعليمات النظام يدوياً لكل مشروع.
-   **التركيب المودولي**: تثبيت القدرات الذكية مثل تثبيت حزم NPM.
-   **التزامن عبر المنصات**: إذا كنت تستخدم [Cursor أو Windsurf](/ar/blog/claude-code-vs-cursor-vs-windsurf) في نفس الوقت، يسمح `killer sync --all` لأدواتك الذكية جميعها بمشاركة مكتبة المهارات نفسها.
## الخاتمة

من خلال الجمع بين Killer-Skills مع OpenClaw، لم تعد تستخدم مجرد برنامج محادثة، ولكن وكيلًا ذاتيًا يمكنه التطور المستمر مع شجرة مهارات غنية.

زور سوق المهارات [Skill Marketplace](https://killer-skills.com/ar/blog) واختر 다음 "قوة خارقة" لك!

---
*قراءة ذات صلة: [كيف تقوم بتثبيت مهارات الوكيل الذكي؟](/ar/blog/how-to-install-ai-agent-skills) و [أفضل مهارات الوكيل الذكي للعام 2026](/ar/blog/best-ai-agent-skills-2026)*