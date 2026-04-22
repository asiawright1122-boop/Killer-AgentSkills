# Killer-Skills 自然流量恢复方案

- 日期：2026-04-16
- 角色视角：产品经理 + SEO 负责人
- 目标：把 `killer-skills.com` 从“技术上可抓取”推进到“Google 愿意持续给自然流量”

## 1. 一句话判断

当前项目的主要问题已经不是部署、D1、KV、404 这些单点故障本身，而是：

`Google 已经能抓到站点，但还没有被充分说服：为什么这个站值得继续分发流量。`

更准确地说，站点现在像一个：

- 大规模 GitHub 派生内容目录
- 带 SEO 包装、翻译、聚合与导流能力
- 但“独立判断、编辑价值、可信推荐、语言一致性”还不够强的产品

这会让自然流量恢复卡在：

- 可抓取，但不愿多收录
- 可索引，但不给太多展示
- 有页面，但没有形成稳定的权威入口

## 2. 当前证据

### 2.1 技术层面已经基本恢复

- Crawl health 最新抽样已稳定在 `1650/1650 2xx`，`4xx=0`，`5xx=0`
- `robots.txt` 与 `sitemap.xml` 线上可访问
- sitemap 与 indexable cache 已对齐
- 旧 repo-root 的一批 URL 已收敛到英文 canonical

结论：

`当前不是“站点挂了”，也不是“Google 抓不到”。`

### 2.2 业务层面仍未恢复

- GSC 最新周期只有 `20` 个 query rows、`179` 个 page rows
- Coverage Drilldown 仍有 `10783` 个受影响页面
- 当前 authority surface `17` 个，但 `0` 个达到 promote-ready
- `3456` 个 skills 里，只有 `1424` 个 canonical 页可索引，`2032` 个仍是 reference-only

结论：

`恢复卡在搜索信任与内容价值，不在基础可用性。`

### 2.3 Google 最可能在担心什么

结合项目代码、现有报告和 Google Search Central 官方规范，当前最大风险是：

- 大规模聚合 GitHub 派生内容
- 页面主体新增价值不足
- 多语言外壳和正文语言不完全一致
- 历史 trap URL、source file URL、深层路径、参数页仍持续消耗抓取与信任

所以问题不应再表述成“是不是被判定成 GitHub 镜像站”。

更准确的产品表述是：

`这个站目前还没有稳定证明自己是“有独立判断的工具发现产品”，而不只是“GitHub 技能仓库的再包装层”。`

## 3. 产品恢复总策略

## 3.1 核心原则

后续恢复不再以“扩大可索引页面数”为目标，而以这三件事为目标：

1. 提升 Google 对站点的整体信任
2. 让少数高价值页面先拿回展示与点击
3. 用权威入口带动长尾技能页，而不是反过来指望海量技能页自己起量

## 3.2 新增长模型

从：

- 大目录
- 多语言铺量
- 技能详情页承接搜索

切换为：

- 首页 / collections / docs / solutions / editorial guides 承接核心搜索需求
- 技能详情页只承接“被证明有价值”的 canonical 长尾
- 大目录继续存在，但只做 supporting surface，不做增长主入口

## 4. D1 / KV / 前后端 / 抓取 的产品协同方式

## 4.1 数据职责重新明确

### D1：唯一技能真源

D1 负责：

- 技能 canonical 数据
- 技能 indexability 状态
- 质量分 / recommendation / use cases / limitations 等可索引判定信号
- 搜索和详情页主数据

要求：

- 所有 skill 页面可索引与否，只认 D1 的规范数据
- 任何“只在本地 cache 改了、没进 D1”的状态，都不算发布完成

### KV：只做缓存与分发，不做技能真源

KV 负责：

- 文档页缓存
- sitemap 缓存
- 翻译缓存
- 提交记录 / 爬取结果等非主事实层

要求：

- 不再让 `skill:*` 之类的旧键承担技能主数据职责
- KV 的目标是“加速”和“分发”，不是“定义真相”

### 前端：只承接被治理过的 URL

前端职责：

- authority surfaces 承接搜索需求
- skill 页只展示通过 indexability 和 locale governance 的 canonical 版本
- 所有内部链接优先导向 collections / docs / solutions / guide，而不是无差别导向目录页

### 后端 / pipeline：只发布“值得被索引的内容”

Pipeline 职责：

- GitHub harvest
- 内容 enrichment
- D1 delta sync
- sitemap 生成
- locale / indexability / originality 治理
- 部署后 smoke / crawl / coverage / GSC 观察

要求：

- “能生成”不等于“能发布”
- “能发布”不等于“值得索引”

## 4.2 发布链路的正确顺序

每次内容更新后的正确动作应固定为：

1. Harvest GitHub / source data
2. Build `skills-cache`
3. 计算 quality / recommendation / locale governance / indexability
4. 写入 D1
5. 更新 docs / sitemap / translation 到 KV
6. 重新生成 sitemap
7. 构建并部署
8. 跑 crawl smoke / index integrity / coverage reports
9. 只对英文 canonical 或已治理后的 authority page 做 GSC 请求编入索引

这条链路必须被视为一个产品发布流程，而不是一堆脚本。

## 5. 未来自然流量要从哪里来

## 5.1 主增长入口：Authority Surfaces

未来自然流量应优先来自以下页面，而不是 skills directory：

1. Homepage Root Hub
2. Collections Hub
3. Official AI Skills & Trusted Tools
4. Agent Workflow Building Tools
5. Installation Docs
6. Official AI Agent Skills Guide
7. IDE / workflow comparison pages
8. Solutions Hub 与高意图 solution pages

这些页面的共同特点应该是：

- 明确回答一个搜索意图
- 有第一方选择标准
- 有独立判断，而不是单纯转述 README
- 能稳定把用户导向安装、使用、对比、下一步操作

## 5.2 长尾技能页的定位

技能详情页应该承担：

- 精准长尾词
- 品牌 + skill slug
- 高 intent 安装需求
- authority 页向下分发后的承接页

不应该承担：

- 全站流量主入口
- 海量模板页铺量
- 多语言无差别索引扩张

## 6. 不是继续修 BUG，而是做这 4 类产品工作

## 6.1 工作流 A：搜索信任修复

目标：

- 让 Google 更少看到噪音 URL
- 更快确认 canonical
- 更少把站点识别为低附加值聚合体

具体动作：

1. 持续压制 `source_file_path`
2. 持续压制 `deep_skill_path`
3. 持续压制 `trailing_slash` 重复
4. repo root 只有在存在明确公开承接页时才做 301，否则继续 410
5. 非 canonical locale 的 skill URL 不进入扩张性索引体系

成功信号：

- Coverage 的 404 / duplicate / canonical mismatch cluster 连续下降

## 6.2 工作流 B：Authority Surface 内容升级

目标：

- 让首页、collections、docs、guide 成为真正可排名的第一页内容

具体动作：

1. 每个 authority page 增加第一方选择理由
2. 为 collection 加入“为什么推荐 / 适合谁 / 不适合谁 / 最后维护时间”
3. docs 强化为“安装与验证桥梁”，而不是孤立说明文档
4. comparison / guide 页面加入独立判断、替代方案、适用边界

成功信号：

- 至少 `2` 个 primary surfaces 从 `hold` 进入 `promote`

## 6.3 工作流 C：技能页价值重建

目标：

- 让保留在索引体系里的 skill 页具备独立价值

具体动作：

1. recommendation layer 必须足够具体
2. use cases 至少达到可操作层
3. limitations 必须真实存在，不做空泛总结
4. 对高优先级 skills 增加 Killer-Skills 自己的评测、适配说明、替代建议
5. 对“只有 README 搬运价值”的 skill 页继续保持 reference-only

成功信号：

- indexable canonical 页质量提升，而不是单纯数量回升

## 6.4 工作流 D：站内分发重构

目标：

- 让站内链接表现出清晰的产品结构与主题权重

具体动作：

1. 首页优先链向 collections / docs / solutions / guides
2. collections 强制链向 docs / guide / 对应 solution
3. docs 强制回链 authority collections 与 install intent 页面
4. skills directory 保持可达，但不再作为默认主 CTA

成功信号：

- authority surfaces 的内部链接权重显著提升
- GSC 页级 impressions 开始集中到主入口页

## 7. 未来 30 天执行顺序

## P0：搜索信任层

1. 持续消化 `404 other`、`source_file_path`、`deep_skill_path`、`trailing_slash`
2. 坚持 skill locale governance，只让真实可承接的 locale 暴露给索引
3. 确保 D1 为技能事实主源，KV 不再背技能主数据包袱
4. 继续保持 Workers AI `free-only`，避免在恢复期引入隐性成本扩张

## P1：权威入口层

1. 把 `home`、`collections`、`docs/installation`、`official collection`、`workflow collection` 当成本月核心流量产品
2. 逐页补强第一方编辑价值
3. 明确每个页面的目标 query cluster 和转化去向

## P2：高意图内容层

1. 只围绕高意图主题补内容
2. 优先做：
   - 安装
   - 比较
   - 官方 / trusted tools
   - workflow building
   - IDE compatibility
3. 停止无约束的目录式扩张

## 8. 产品 KPI，不再只看“有没有修好”

后续判断恢复是否成功，必须看这 4 组指标：

## 8.1 搜索信任 KPI

- Coverage affected pages
- 404 cluster 规模
- source_file_path cluster 规模
- canonical mismatch 数量
- indexable canonical 页占比

## 8.2 流量 KPI

- GSC query rows
- GSC page rows
- authority pages impressions / clicks
- 非品牌词 impressions

## 8.3 供给 KPI

- promote-ready authority surfaces 数量
- editorial queue 完成量
- 高质量 indexable skill 数量

## 8.4 转化 KPI

- CLI 安装页进入量
- docs installation 点击量
- skill install command 点击量

## 9. 当前最重要的结论

接下来不该再把主要精力放在“继续多修几个 bug”，而应该切换为：

`用更少、更强、更有独立判断的页面，重新建立 Google 对 Killer-Skills 的产品信任。`

技术问题当然还要修，但它们现在已经从“主问题”变成“配套保障”。

真正决定自然流量能不能回来的，是：

- 页面是否真的值得排
- 站点是否有明确权威入口
- 内容是否体现了 Killer-Skills 自己的判断与编辑价值
- 长尾技能页是否只在“该索引时才索引”

## 10. 项目执行口径

从今天开始，SEO 恢复项目的默认口径是：

- 不再追求 bulk index volume
- 不再把 full skills directory 当增长主入口
- 不再把 GitHub 派生内容的规模视为优势本身
- 先把 authority surfaces 做成能拿回展示和点击的产品
- 再决定是否扩大技能详情页的公开索引面

这才是 Killer-Skills 当前阶段最合理的自然流量获取路径。
