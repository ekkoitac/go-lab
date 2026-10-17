# 161–170：性能与资源实验重建

设计依据：`E:\ekko-lib\ekko-lib\临时\学习-知识点教学中的交互与呈现方式.md`。

每题由一个独立子代理实现。模块位于 `src/components/operations-lab/lesson161` 至 `lesson170`，公共入口为 `OperationsChapterLab.tsx`；App 的四种帮助入口保持原有帮助记录机制。

| 题号 | 学习目标 | 操作与呈现 |
| --- | --- | --- |
| 161 | 区分 CPU 执行与请求等待，选择有证据的优化 | 预测后测量、单因素干预、同负载复测；分段时间条与工具覆盖联动 |
| 162 | 理解尾部分布、分位口径和跨实例聚合 | 改变慢请求分布和实例流量、逐步合桶与排序、修复错误仪表盘 |
| 163 | 区分分配、活跃对象、驻留页与外部来源 | 三轮请求与 GC、归还空闲页、观察保留和 cgo/栈增长；时间样本表 |
| 164 | 分配软目标、外部占用和突发预算 | 扣预算、尝试回收、注入突发、修复不可回收下界；分桶与硬预算线 |
| 165 | 理解 GOGC 的空间与扫描工作权衡 | 调整存活堆、根、分配率与预算，对照公式和图形，按目标修复 |
| 166 | 区分并行度和容器 CPU 带宽 | 调整配额与 GOMAXPROCS，在周期时间线上观察工作推进和节流 |
| 167 | 理解对象池的可丢弃性与借用生命周期 | 借用、重置、归还、再次借用，构造缓存丢失和旧引用误用 |
| 168 | 理解分块传输与有界总内存 | 对照 ReadAll 与流式读写，改变消费者和输出存储，观察背压与积累 |
| 169 | 理解平均在途量和稳态条件 | 改变到达率、停留时间及处理容量，观察时间积分、吞吐和积压 |
| 170 | 验证局部优化的整体收益与副作用 | 控制负载、重复采样、端到端对照、按预设指标作发布判断 |

四种帮助分别承担案例对照、图形/数值联动、过程推导和新情境尝试。模型均在页面内计算，属于确定性教学模拟，不读取或修改真实运行时参数。数值假设、测量口径及不能外推的边界在各题界面中说明。

实验与帮助不直接调用测验 attempt/reveal 接口，不产生独立掌握记录；正式测验、决策草稿、代码编辑器和其他题目继续使用已有机制。

## 验证

- 纯模型：`npx tsx --test tests/operations-lesson*.test.ts`。
- 页面：`npx playwright test tests/browser/operations-labs.spec.ts`，覆盖 1440 / 390 / 320px、主实验推进与回退、四种帮助、状态隔离和专门的因果路径。
- 可用 `OPS_TEST_IDS=161,162` 选择小批验证。
- 使用 `GO100_E2E_WEB_PORT`、`GO100_E2E_API_PORT`、`GO100_E2E_DATA_DIR`、`GO100_E2E_OUTPUT_DIR` 隔离服务和学习数据。
- 截图保存于 `.runtime/operations-labs/`；默认不录制 trace。
## 官方语义核对

- [Go GC 指南](https://go.dev/doc/gc-guide)：GC 空间与 CPU 权衡，以及内存软限制的范围和边界。
- [Go 1.26 runtime](https://pkg.go.dev/runtime@go1.26.0#GOMAXPROCS)：容器默认并行度、显式覆盖与自动更新。
- [sync.Pool](https://pkg.go.dev/sync#Pool)：池项可以被丢弃，不能依赖具体复用轨迹。
- [io.CopyBuffer](https://pkg.go.dev/io#CopyBuffer)：WriterTo / ReaderFrom 快路径可能不使用传入缓冲。

模型中的比例、容量、分段时延和重复样本为显式教学假设；真实运行时实现与生产性能不由这些数值推断。

## 本次验证结果（2026-10-17）

- 十题模型测试：67 / 67 通过。
- 浏览器交互：40 / 40 通过（30 项三尺寸检查 + 10 项逐题因果路径）。
- `npm run typecheck`、`npm run check:content`、`npm run build` 通过。
- 浏览器使用 `.runtime/operations-playwright.config.ts`、`.runtime/operations-vite.config.mjs` 隔离配置，端口 16363 / 16364；数据库位于 `.runtime/operations-e2e-data2`。Vite 扫描入口限定 `index.html`，不改变正式配置。
- 实际验收命令：`npx playwright test --config .runtime/operations-playwright.config.ts operations-labs.spec.ts`。
- 已人工查看部分桌面与 320px 截图，修正 161 的主题配色及 162 / 164 的滑杆外边距溢出。
- 构建仍提示现有大型图形依赖包体积警告；构建退出码为 0。
