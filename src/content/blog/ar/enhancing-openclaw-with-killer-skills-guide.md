---
title: "دليل خطوة بخطوة لتعزيز OpenClaw باستخدام Killer-Skills"
description: "تعلّم كيفية تهيئة OpenClaw وتثبيت مهارات المجتمع ومزامنتها مع مشروعك باستخدام Killer-Skills لبناء وكيل ذكاء اصطناعي أكثر قدرة."
pubDate: 2026-03-02
author: "Killer-Skills Team"
tags: ["OpenClaw", "Tutorial", "AI Configuration"]
lang: "ar"
featured: false
category: "guides"
heroImage: "/blog/openclaw-killer-integration-hero.webp"
---
# دليل خطوة بخطوة لتعزيز OpenClaw باستخدام Killer-Skills

في المقالات السابقة، استعرضنا [الإمكانات الكبيرة لـ OpenClaw](/ar/blog/introducing-openclaw-autonomous-ai-agent) و[سيناريوهات استخدامه المتنوعة](/ar/blog/openclaw-application-scenarios). والآن ننتقل إلى الجزء العملي: **كيف تمنح وكيل OpenClaw آلاف المهارات الاحترافية بسرعة؟**

مع **Killer-Skills**، يمكنك حقن نظام موحّد من القواعد داخل OpenClaw، مما يسمح له باكتشاف المنطق المعقّد وتنفيذه بشكل مستقل.

## الخطوة 1: استخدم Killer-Skills عبر npx

تأكد أولاً من تثبيت Node.js على جهازك. لا تحتاج في هذا المسار إلى تثبيت CLI بشكل عام؛ يكفي تشغيل Killer-Skills مباشرة عبر `npx` داخل المشروع.

## الخطوة 2: تهيئة دعم OpenClaw داخل مشروعك

انتقل إلى جذر المشروع الذي تريد تشغيل OpenClaw فيه، ثم شغّل أمر التهيئة التالي:

```bash
npx killer-skills init
```

عند مطالبتك باختيار IDE أو وكيل، اختر **OpenClaw**. سينشئ ذلك ملف التعريف `.openclaw` وملف `AGENTS.md` إن لم يكونا موجودين مسبقًا، وهو المكان القياسي الذي يقرأ منه OpenClaw التعليمات على مستوى النظام.

## الخطوة 3: تثبيت المهارات ومزامنتها

الآن يمكنك اختيار أي مهارة تحتاجها. على سبيل المثال، إذا كنت تريد منح OpenClaw قدرات في تصميم الواجهات:

1. **ابحث عن المهارة وثبّتها:**
   ```bash
   npx killer-skills add anthropics/skills/frontend-design
   ```
2. **زامنها مع OpenClaw:**
   ```bash
   npx killer-skills sync --ide openclaw
   ```

يقوم الأمر `npx killer-skills sync --ide openclaw` تلقائيًا بتوليد مجموعة من كتل التحفيز بصيغة XML التي يفهمها OpenClaw، ثم يحقنها في ملف `AGENTS.md`.

## حزم مهارات حسب السيناريو

لتبدأ بسرعة، جمعنا لك حزم تثبيت مناسبة لعدة سيناريوهات شائعة:

### 1. حزمة أتمتة الأعمال المكتبية (Office Pro)
مناسبة للمستخدمين الذين يتعاملون مع كميات كبيرة من المستندات والتقارير.

```bash
npx killer-skills add anthropics/skills/pdf
npx killer-skills add anthropics/skills/xlsx
npx killer-skills add anthropics/skills/docx
npx killer-skills add minhtungo/ai-agents-factory/humanizer
npx killer-skills sync --ide openclaw
```

### 2. حزمة تعزيز المطور (Dev Alpha)
مناسبة للمطورين الذين يحتاجون إلى مساعدة الذكاء الاصطناعي في البرمجة والاختبار وتوسيع سلاسل الأدوات.

```bash
npx killer-skills add anthropics/skills/frontend-design
npx killer-skills add anthropics/skills/webapp-testing
npx killer-skills add anthropics/skills/mcp-builder
npx killer-skills sync --ide openclaw
```

### 3. حزمة إنشاء المحتوى (Creator Suite)
مناسبة للمدونين ومديري وسائل التواصل الاجتماعي ومُعدّي العروض والمقترحات.

```bash
npx killer-skills add minhtungo/ai-agents-factory/humanizer
npx killer-skills add anthropics/skills/canvas-design
npx killer-skills add anthropics/skills/internal-comms
npx killer-skills sync --ide openclaw
```

## الخطوة 4: استدعاء المهارات داخل OpenClaw

ابدأ تشغيل OpenClaw. وبعد مزامنة المهارات، يمكنك الآن إصدار أوامر مباشرة باللغة الطبيعية:

> **الأمر:** "OpenClaw، صمّم صفحة تسجيل دخول حديثة اعتمادًا على هيكل مشروعي الحالي وباستخدام مواصفات مهارة frontend-design."

سيتعرّف OpenClaw على تعريفات المهارات داخل `AGENTS.md`، ويفعّل المنطق المناسب تلقائيًا، ثم يولّد الشيفرة محليًا.

## لماذا تختار Killer-Skills + OpenClaw؟

- **التوحيد القياسي:** لا حاجة لكتابة تعليمات نظام مخصّصة يدويًا لكل مشروع.
- **التركيب المعياري:** يمكنك تثبيت القدرات الذكية كما تثبّت حزم NPM.
- **المزامنة عبر المنصات:** إذا كنت تستخدم [Cursor أو Windsurf](/ar/blog/claude-code-vs-cursor-vs-windsurf) أيضًا، فإن `npx killer-skills sync --all` يسمح لأدواتك الذكية بمشاركة مكتبة المهارات نفسها.

## الخلاصة

عند الجمع بين Killer-Skills وOpenClaw، فأنت لا تستخدم مجرد واجهة محادثة، بل وكيلًا ذاتيًا يمكنه التطور باستمرار مع شجرة مهارات غنية.

تصفّح [دليل المهارات](https://killer-skills.com/ar/skills) واختر قدرتك الخارقة التالية.

---
*قراءة ذات صلة: [كيف تقوم بتثبيت مهارات الوكيل الذكي؟](/ar/blog/how-to-install-ai-agent-skills) و [أفضل مهارات الوكيل الذكي للعام 2026](/ar/blog/best-ai-agent-skills-2026)*
