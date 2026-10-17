# 第 147–150 题：缓存与消息交互重做

依据 `E:\ekko-lib\ekko-lib\临时\学习-知识点教学中的交互与呈现方式.md`，每题由独立子代理实现，主代理负责页面接入、模型审查和跨模块浏览器验证。

| 题号 | 理解目标 | 动手观察 | 换个方式理解 |
| --- | --- | --- | --- |
| 147 | 区分业务持久提交与 broker 收到确认 | 切换确认时机、提交失败/崩溃/确认丢失与幂等；追踪恢复依据、券数和重投 | 签收类比、双路径故障窗口、协议回放、确认丢失修复 |
| 148 | 区分永久错误、暂时错误与隔离后的责任 | 操作队列/延迟区/死信区，调整预算与抖动；修复副本、限速重放并保留原始证据 | 分诊对照、错误分支构建、退避回放、死信诊断 |
| 149 | 区分生产、投递与完成顺序，找到并行边界 | 操作订单键路由、worker 并发、版本检查和热点分布；查看执行链与完成记录 | 双订单并行对照、路由构建、分步调度、热点边界预测 |
| 150 | 区分快照覆盖与增量逐条执行 | 注入乱序/缺失，比较版本门控、缓冲、回补以及错误水位 | 对账单/流水契约、三种顺序联动、门卫角色操作、缺口修复 |

四题均要求先给出预测和理由，再执行主实验；可回退和重置。状态变化由纯模型计算，解释指出当前操作、变化及原因。帮助模式使用独立局部状态，不改变主实验或代码/决策草稿，不调用正式作答或答案揭示接口。

所有数值、时间单位、错误注入和恢复条件均为明确标注的教学假设，不作为生产性能或中间件可靠性保证。各题细节见同目录 `cache-message-lesson147.md` 至 `cache-message-lesson150.md`。

接入范围仅扩展 `src/App.tsx` 和 `src/components/Experiment.tsx` 中已有缓存消息范围至 150；新文件位于 `src/components/cache-message-lab/lesson147` 至 `lesson150`。保持原有题目、Go 示例、正式测验、持久化和其他章节。

## 验证

- 四题模型共 32 项测试：确认故障矩阵、可靠性不变量、队列资源与重试预算、原始证据保留、事件守恒、顺序与缺口恢复、预测隔离和确定性回退。
- 浏览器测试 `tests/browser/cache-message-tail.spec.ts`：1440/390/320 三档宽度；键盘启动、单步/回退/重置、四帮助模式、面板隔离、草稿不变、无正式作答请求；另有每题关键故障路径测试。
- 截图和本次独立验收日志位于 `.runtime/lessons147-150/` 与 `.runtime/lessons147-150-*.log`。
- 本次浏览器验收使用 `.runtime/lessons147-150-playwright.config.ts`：专用 15347/15348 端口及独立学习数据库，Vite 依赖扫描限定为应用入口，避免扫描并行任务的临时产物。

```powershell
node --import tsx --test tests/cache-message-lesson147.test.ts tests/cache-message-lesson148.test.ts tests/cache-message-lesson149.test.ts tests/cache-message-lesson150.test.ts
npx playwright test --config .runtime/lessons147-150-playwright.config.ts tests/browser/cache-message-tail.spec.ts
npm run typecheck
npm run check:content
```

## 本次验收结果

- 模型测试：32 / 32 通过。
- 页面验证：12 / 12 通过，覆盖四题 × 三种宽度；截图已人工检查。
- 关键故障场景：4 / 4 通过，见 `.runtime/lessons147-150-scenarios.log`。首轮这四项因嵌套 label 的精确定位失败，已改用可访问 combobox 名称并复测通过；产品逻辑未因此改变。
- 全项目 `typecheck` 与 `check:content` 已通过。
- 已有单元测试基线 659 / 659 通过；新增四题的测试在独立一轮中执行。仓库还有其他任务并行新增内容，以上全局结果对应本次检查时的工作区快照。
- 完整生产构建通过（独立输出 `.runtime/lessons147-150-dist`），耗时 36.69 秒；保留现有大体积第三方图表包的构建提示。
