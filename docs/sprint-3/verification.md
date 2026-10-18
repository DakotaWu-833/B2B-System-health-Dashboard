# Sprint 3 修复与验收记录

> 历史记录：以下结果对应 2026-10-18 的原始源码清单。PR #18 合入后的 2026-10-19 整合、修复和重新验证见 [PR #19 follow-up verification](pr19-follow-up-verification.md)。下方旧测试数量、Docker/浏览器证据不能直接作为更新后版本的通过记录。

验证日期：2026-10-18，Australia/Sydney。当前团队分支 `develop-3`，基线提交 `82c6aa5b51e0d115d19d5e0b70e9f69f9825591b`。本次修复的交付分支为用户的 `database`；下述验收发生于提交推送之前，版本用 [源码 SHA-256 清单](evidence/source-manifest.sha256) 绑定。已修复事项按用户要求从根目录问题清单删除。

## 当前结论

本轮列出的 27 项已实现并通过对应本地验收。统一检查入口完整退出码为 0：**后端常规 158 项、集成 18 项、前端 57 项，全通过且无跳过；生产构建通过**。18 项集成检查中，17 项运行于实际 Docker MySQL/Mailpit，1 项为 H2 Flyway。另完成连接 Docker 数据库/邮箱的双角色 Chromium 浏览器验收。结果证明这里记录的场景通过，不代表不存在未覆盖的缺陷。

## 环境与执行

- Java 21.0.11；Maven Wrapper 3.9.11；Spring Boot 3.5.16。
- Docker Engine 29.8.2；实际数据库 `MySQL 8.4.11`（`mysql:8.4`）；Mailpit `v1.31.6`，SMTP 与 HTTP inbox 均为实际容器服务。
- Node 26.7.0；pnpm 11.19.0；Vite 8.2.2；Vitest 4.1.11。
- 默认 MySQL 隔离级别 REPEATABLE READ；指标、告警处理、资料和归档写入通过事务组件使用 READ COMMITTED，保留必要行锁并对完整回滚事务最多重试五次。
- 项目 Documents 目录曾出现重复编译缓存 `* 2.class`，会影响主类发现和扫描。最终构建使用 `/private/tmp` 独立目录。不是通过忽略失败或跳过 Docker 获取成功。

```sh
VERIFY_BUILD_DIRECTORY=/private/tmp/elec5619-final-acceptance bash scripts/verify.sh
```

本次统一检查后端结束于 21:41:53，随后前端 57 项与生产构建通过，脚本完整退出 0。原始日志在本地忽略目录 `tmp/full-verification.log`；JUnit 原始报告在 `/private/tmp/elec5619-final-acceptance/{surefire-reports,failsafe-reports}`。可随时按上述入口重新生成。可随代码携带的精简结果为 [automated-results.json](evidence/automated-results.json)。

## Docker 中实际验证了什么

| 检查 | 数量 | 核心证据 |
| --- | ---: | --- |
| MySqlDatabaseApiIT | 8 | 空告警表中八系统同时异常上报全部 201；同系统上报与确认/解决交错无 500、每类型最多一个未关闭告警；唯一系统竞争一成功一 409；精度/整数/缺失/null 无副作用；同时间最新记录一致；实际 MySQL 分批归档保留最新值 |
| MySqlProfileConcurrencyIT | 4 | 实际 SMTP 收信后确认并重新读取数据库；邮箱争用一成功一 409；八次同时确认仅一次成功，其余 409；八次同时发送仅一封邮件，其余 429 |
| DatabaseCapacityIT | 3 | 数据库 CHECK 拒绝非法值、保留 0/100 边界；历史重复系统阻断升级且历史保留，明确修复后重试成功；128 系统、1 万指标、1 万告警的 EXPLAIN ANALYZE |
| MySqlFlywayMigrationIT | 1 | 全量迁移后 JPA 模型校验 |
| MySqlPopulatedUpgradeIT | 1 | 带用户/系统/指标/告警从 V1 升到 V5，数据保留；旧用户邮箱默认兼容；重复启动无重复迁移 |
| H2FlywayMigrationIT | 1 | H2 MySQL 兼容模式的空库迁移与模型校验 |

最初实测八系统并发上报为一条 201、七条 500；修复后八条均为 201。扩展 Docker 回归又发现“指标写入与告警确认/解决交错”的死锁，已修复告警操作的事务边界和整笔重试，并在后续完整运行中通过。直接 CHECK 违规在 MySQL 返回错误码 3819，测试检查数据库错误码，未将异常类别差异误判为数据库未拒绝。

容量结果见 [capacity-plans.json](evidence/capacity-plans.json)。本机样本中，ACTIVE 告警查询扫描从 10000 条降至索引命中的 10 条；最新指标查询限制到当前 10 个系统后，候选指标从 10000 条降至 790 条。执行耗时只反映这次样本与本机容器，不构成生产性能承诺。

## 浏览器验收

实际使用生产构建，通过 Vite preview → Spring Boot:8085 → Docker MySQL:3308；邮件走 Docker SMTP:1026，收件箱为 Mailpit:8026。请求未 mock。浏览器后端的 90 个应用 class/resource 内容与最终统一构建逐项相同；生产前端文件内容哈希保持相同。

| 流程 | 实际结果 |
| --- | --- |
| Operations 登录、系统管理 | 必填字段拦截；创建、编辑后从数据库重新读取一致；重复身份返回 409 且保留表单输入 |
| 系统列表 | 12 个系统分两页；最新值和测量时间可见；实际显示 FRESH、STALE、NO_DATA；CPU/内存/响应时间为 0 正常显示 |
| 详情、阈值与历史 | 显示服务器返回的 CPU/内存 75/90、响应 500/1000 阈值；先加载 20 条再追加 5 条；不丢失/重复；空时间范围显示无数据，恢复范围可再次加载 |
| 告警末页 | 六条 ACTIVE 时进入第二页的唯一一条并解决，自动回到第一页剩五条；操作成功反馈保留；KPI 同步 6→5，确认一条后同步 5→4 |
| Operations 资料 | 保存邮箱 → SMTP 发送 → 从真实收件箱取码 → 页面确认；限流再次发送 429 且有 Retry-After；退出再登录仍为 Verified；修改邮箱后验证及时间清空 |
| Management 权限 | 创建/编辑/告警处理按钮隐藏；对系统创建/编辑、指标写入、告警解决、归档预览/执行的六项直接请求均 403；自己的资料仍可编辑验证 |
| Management 资料 | 不能占用 Operations 邮箱，409 提示正常；自己的邮箱完成真实收信与验证，无其他用户资料泄露 |
| 会话与 CSRF | 缺少 CSRF 的资料更新 403；实际使会话失效后，页面接口 401 并回到登录 |
| 归档默认安全状态 | Operations 预览 200 且 enabled=false；执行 409，无删除；启用后的实际归档由 Docker 用例验证 |
| 演示数据持续性 | 服务运行超过十分钟后，三套固定演示系统仍自动产生新读数；最终数据库读数 age_seconds 为 0，普通环境此功能默认关闭 |
| 响应式 | 1366、390、320 像素视口 document.scrollWidth 等于视口宽度；宽表格在自身容器横向滚动；已查看实际截图 |

有意触发的 401/403/409/429 会显示为浏览器网络错误，分别与验收场景对应。检查期间未观察到未捕获 JavaScript 异常。早期自动化操作曾因等待旧成功提示、把按钮“加载中”误当加载完成而超时/提前断言；改用实际完成状态和行数等待后重跑通过，没有把这些失败记录当成功。

页面证据：

- [桌面 Dashboard](evidence/dashboard-overview-desktop.png)
- [服务器阈值](evidence/health-thresholds.png)
- [390 像素页面](evidence/dashboard-mobile-top.png)
- [Management 邮箱已验证，320 像素](evidence/profile-verified-mobile.png)

## 原清单条目与实现证据

| 已完成条目 | 实现与验证位置 |
| --- | --- |
| BUG-001 | common/RetryingTransaction、MetricService、AlertService；MySqlDatabaseApiIT、RetryingTransactionTests |
| BUG-002 / BUG-003 | MetricSubmissionRequest、Metric 实体、Jackson 整数配置；MySqlDatabaseApiIT |
| DB-001 | V3 检查约束；DatabaseCapacityIT 原生 SQL 越界与边界 |
| DB-002 / DB-003 | V1/V2 保持不变，新增 V3/V4/V5；MySqlPopulatedUpgradeIT、DatabaseCapacityIT；升级与恢复说明 |
| DB-004 | Alert 复合索引、按当前系统页查询最新指标；容量执行计划 |
| DB-005 | MetricRetentionService、V5、默认关闭的配置和定时器；MySQL 归档、H2 回滚/权限/批量用例 |
| API-001 / API-002 | 系统分页、历史时间范围和游标；PagingAndHistoryIntegrationTests；实际浏览器分页 |
| API-003 / API-004 | 安全错误信封、503/Retry-After、正数配置约束；现有及新增异常/新鲜度用例 |
| USER-001 / USER-002 / USER-003 | User、V4、profile 包、SMTP 发送；ProfileIntegrationTests、Docker 邮件/并发测试 |
| USER-004 | SecurityConfig 保留角色与 CSRF；权限矩阵、资料用例及浏览器直接拒绝请求 |
| USER-005 | MultiRoleDemoSeeder、DemoMetricFeeder；幂等/角色冲突/双登录测试；运行十分钟后真实新读数 |
| UI-001 / UI-002 / UI-003 | Dashboard KPI、分页列表、SystemDetails 阈值；57 项前端回归与浏览器 |
| UI-004 / UI-005 / UI-006 | SystemForm、Profile、AlertCenter 末页回退；前端回归及双角色实际流程 |
| QA-001 / QA-002 | 数据库集成 profile、统一入口和 CI 配置、边界与并发正式用例；全部无跳过通过 |
| QA-003 / QA-004 | 当前 API/迁移/演示/贡献文档、来源与任务编号映射、本记录及实际截图 |

具体 Java 路径前缀为 `backend/src/{main,test}/java/au/edu/sydney/elec5619/dashboard/`。复用的团队前端来源与任务编号见 [Sprint 3 索引](README.md)，不改变原作者贡献归属。

## 验证边界与收尾

- 实际验证的是本地 MySQL、SMTP 和浏览器流程。外部邮件供应商、真实邮箱投递、生产负载、远程 GitHub Actions 未执行，未声称通过；相关配置和 CI 已提供。
- 现有依赖会打印 Flyway 对 MySQL 版本支持范围的提示，以及 Spring 的自定义认证提供器提示；真实迁移/模型/API 测试仍通过。没有通过调低日志或跳过来隐藏它们。
- 临时服务与验收容器在记录完成后清理，保留不含口令/验证码的日志、精简结果和截图。现有项目数据库未被这轮验收修改。
- 未创建 PR、未推送 develop-3、未合并 main；本轮结果不能替代团队 review 与发布批准。
