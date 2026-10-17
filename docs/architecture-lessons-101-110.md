# 101–110 题：动手观察与换个方式理解

依据：`E:\ekko-lib\ekko-lib\临时\学习-知识点教学中的交互与呈现方式.md`。

每题独立维护模型与视图，按学习目标选择交互。教学中的数量只描述当前简化模型，不代表真实延迟、生产性能或架构优劣分数。

## 交互约定

- 动手观察允许直接探索，也可先填写预测与理由；预测必须与揭示结果分开。
- 参数、拓扑或策略变化会改变可见状态、影响范围或执行路径，反馈说明改变的原因。
- 单步、回退与重置支持重新比较；图中箭头明确区分源码依赖、运行时调用和数据传播。
- 举例子、画图、拆步骤、让我试试采用四种独立视图。帮助使用自己的局部状态；迁移挑战先提交再显示反馈。
- 帮助与实验不调用正式作答/揭示接口，不产生独立掌握记录。原有帮助记录与正式测评继续由课堂入口管理。
- 图表适应右侧窄栏和 390px 手机；控件有可访问名称，并提供键盘与减少动态效果支持。

## 代码组织

- `src/components/architecture-lab/ArchitectureChapterLab.tsx`：按题懒加载实验与帮助。
- `src/components/architecture-lab/lesson101` 至 `lesson110`：每题独立的 `index.tsx`、`model.ts`、`style.css`。
- `tests/architecture-lesson*.test.ts`：各模型因果行为和边界检查。
- `tests/browser/architecture-labs.spec.ts`：桌面和手机布局、键盘、回退、帮助隔离与逐题行为。

## 验证方式

```powershell
npm run build
npm test
$env:GO100_E2E_WEB_PORT='16317'
$env:GO100_E2E_API_PORT='16318'
$env:GO100_E2E_DATA_DIR='.runtime/architecture-labs/e2e-data'
$env:GO100_E2E_OUTPUT_DIR='.runtime/architecture-labs/test-results'
npx playwright test tests/browser/architecture-labs.spec.ts
```

浏览器检查使用独立端口和临时数据库。截图位于 `.runtime/architecture-labs`。可用 `ARCH_TEST_IDS`（逗号分隔）缩小浏览器检查范围。

## 逐题学习证据

| 题号 | 可操作模型 | 需要观察的差异 |
|---|---|---|
| 101 | 发布顺序、兼容桥接、部署方式与负载 | 共同变化并不因拆进程消失；独立负载改变扩容范围 |
| 102 | 部件所有者、写入权限、变化传播 | 重组所有权减少协调；共享写入仍会扩大影响范围 |
| 103 | 导入图、最小消息、端口与装配 | 编译依赖无环与运行时调用是两种关系；泄漏类型可重新成环 |
| 104 | 消费需求、契约与实现方法集合 | 小接口必须满足真实需求；方法名相同仍可能签名或语义不匹配 |
| 105 | 共享规则范围、整数金额、发布与分别升级 | 文本相似不代表舍入承诺相同；同义协议校验有统一维护价值 |
| 106 | cmd、module、仓库、go.work 与发布版本 | 本地源码可用不代表消费者能用已发布依赖构建 |
| 107 | 退款入口、业务规则、Save 与 Ack | 核心可复用；保存失败不能确认，确认失败不撤销已提交记录 |
| 108 | 构造图、装配方式、失败阶段与清理栈 | 图验证不保证外部配置有效；失败后逆序关闭成功获取的资源 |
| 109 | 装载、握手、扩展事件、额外权限策略 | 崩溃隔离不保证调用成功，也不自动提供文件权限隔离 |
| 110 | 只读影子、灰度单写、超时重试、回退检查 | 切流不撤销已扣款；数据兼容与跨版本去重必须验证 |

图形通过 `RelationGraph.tsx` 提供可缩放的节点、明确方向的连线、循环高亮与键盘选择；模型与任务语义仍由各题独立维护。

第 109 题的运行平台、构建兼容与无法卸载等边界核对自 [Go plugin 官方文档](https://pkg.go.dev/plugin)。模块工作区的本地替换与发布依赖关系参照 [Go Modules Reference](https://go.dev/ref/mod#workspaces)。迁移实验把 [Strangler Fig 渐进替换](https://learn.microsoft.com/en-us/azure/architecture/patterns/strangler-fig) 的路由边界，与本题的账本、幂等和旧读者验证分别建模。

## 本次验收记录（2026-10-17）

- `npm run build`：类型、200 课程内容完整性及生产构建通过。
- `npm test`：本次全项目测试 419 项通过，0 失败、0 跳过；其中新增 101–110 模型测试共 66 项。
- `tests/browser/architecture-labs.spec.ts`：14 项通过，覆盖十题的桌面与 390px 手机、四种帮助、键盘推进、回退与重置、SVG 标签边界、决策记录隔离及关键反例修复。
- 浏览器使用 `.runtime/architecture-labs/e2e-data`，截图覆盖十题两种尺寸的主实验和关系图帮助；已目视复核代表性截图。
- `git diff --check`：通过。
