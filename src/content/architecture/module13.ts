import { architectureLesson as lesson } from '../architecture-builder';
import { q, frame, experiment } from '../builders';
import type { Lesson } from '../types';
const state=(...args:Parameters<typeof frame>)=>({...frame(...args),edges:[]});
const exp=(title:string, labels:[string,string], a:[string[],string[]], b:[string[],string[]])=>experiment([...a.flat(),...b.flat()].some(v=>/=[0-9]+(?:ms)?$/.test(v))?'bars':'graph',title,'切换条件并逐步比较状态。此图为教学模型，不是生产系统实测。',[state('输入条件','观察当前约束。',a[0]),state('方案后果','比较结果与付出。',a[1],1)],[state('输入条件','观察变化后的约束或方案。',b[0]),state('方案后果','判断适用边界。',b[1],1)],labels);
export default [
lesson({
  "id": 121,
  "title": "请求突增时，按请求创建 goroutine 还是有界执行",
  "scenario": "批任务一次到达八项，外部依赖只允许两个并发；实现为每项直接启动 goroutine，虽然最后都成功，却在同一时刻占用八个资源。",
  "constraints": [
    "依赖并发上限为 2",
    "八项都要最终处理",
    "不能只限制开始后才排队的资源"
  ],
  "options": [
    {
      "title": "每项独立 goroutine",
      "benefits": "简单且容易并行",
      "costs": "任务数直接决定 goroutine 与等待资源",
      "when": "上游量已严格有界且负载可承受"
    },
    {
      "title": "有界 worker 与队列",
      "benefits": "执行并发可预测",
      "costs": "需要排队、拒绝和取消策略",
      "when": "到达量可超过下游容量"
    }
  ],
  "recommendation": "用固定数量 worker 限制执行并发，同时为实际入口的待处理队列定义容量和超时。",
  "pitfall": "在每个已启动 goroutine 内等待许可，却声称 goroutine 总数也被限制。",
  "mechanism": [
    "并发执行数、goroutine 数和等待队列长度是不同指标。",
    "许可应在占用受限资源之前获取。",
    "有界执行不能解决无界入口积压。"
  ],
  "boundary": "示例八个任务预先已知，队列有限；生产仍需独立入口容量和过载策略。",
  "revisitWhen": [
    "任务成本差异很大",
    "下游容量或副本数变化"
  ],
  "mnemonic": "限执行，也限等待。",
  "sources": [
    {
      "title": "Go：Pipeline 有界并发",
      "url": "https://go.dev/blog/pipelines"
    }
  ],
  "diagram": [
    {
      "title": "有界执行管道",
      "source": "flowchart LR\n A[\"入站任务\"] --> Q[\"有界等待队列\"]\n Q --> W[\"两个 worker\"]\n W --> D[\"受限依赖\"]\n Q -->|满额| R[\"明确拒绝或等待预算\"]",
      "caption": "限制 worker 不是允许队列无限增长。",
      "kind": "flow"
    }
  ],
  "code": {
    "starter": "package main\n\nimport (\n\t\"fmt\"\n\t\"sync\"\n)\n\nfunc run(limit, total int) (int, int) {\n\tif limit <= 0 || total <= 0 {\n\t\treturn 0, 0\n\t}\n\tworkers := total\n\tjobs := make(chan int, total)\n\tfor i := 0; i < total; i++ {\n\t\tjobs <- i\n\t}\n\tclose(jobs)\n\tready := make(chan struct{}, workers)\n\trelease := make(chan struct{})\n\tvar mu sync.Mutex\n\tactive, peak, done := 0, 0, 0\n\tvar wg sync.WaitGroup\n\tfor i := 0; i < workers; i++ {\n\t\twg.Add(1)\n\t\tgo func() {\n\t\t\tdefer wg.Done()\n\t\t\tfirst := true\n\t\t\tfor range jobs {\n\t\t\t\tmu.Lock()\n\t\t\t\tactive++\n\t\t\t\tif active > peak {\n\t\t\t\t\tpeak = active\n\t\t\t\t}\n\t\t\t\tmu.Unlock()\n\t\t\t\tif first {\n\t\t\t\t\tready <- struct{}{}\n\t\t\t\t\t<-release\n\t\t\t\t\tfirst = false\n\t\t\t\t}\n\t\t\t\tmu.Lock()\n\t\t\t\tactive--\n\t\t\t\tdone++\n\t\t\t\tmu.Unlock()\n\t\t\t}\n\t\t}()\n\t}\n\tfor i := 0; i < workers; i++ {\n\t\t<-ready\n\t}\n\tclose(release)\n\twg.Wait()\n\treturn peak, done\n}\nfunc solve() string { peak, done := run(2, 8); return fmt.Sprintf(\"peak=%d done=%d\", peak, done) }\nfunc main()         { fmt.Println(solve()) }\n",
    "solution": "package main\n\nimport (\n\t\"fmt\"\n\t\"sync\"\n)\n\nfunc run(limit, total int) (int, int) {\n\tif limit <= 0 || total <= 0 {\n\t\treturn 0, 0\n\t}\n\tworkers := total\n\tif workers > limit {\n\t\tworkers = limit\n\t}\n\tjobs := make(chan int, total)\n\tfor i := 0; i < total; i++ {\n\t\tjobs <- i\n\t}\n\tclose(jobs)\n\tready := make(chan struct{}, workers)\n\trelease := make(chan struct{})\n\tvar mu sync.Mutex\n\tactive, peak, done := 0, 0, 0\n\tvar wg sync.WaitGroup\n\tfor i := 0; i < workers; i++ {\n\t\twg.Add(1)\n\t\tgo func() {\n\t\t\tdefer wg.Done()\n\t\t\tfirst := true\n\t\t\tfor range jobs {\n\t\t\t\tmu.Lock()\n\t\t\t\tactive++\n\t\t\t\tif active > peak {\n\t\t\t\t\tpeak = active\n\t\t\t\t}\n\t\t\t\tmu.Unlock()\n\t\t\t\tif first {\n\t\t\t\t\tready <- struct{}{}\n\t\t\t\t\t<-release\n\t\t\t\t\tfirst = false\n\t\t\t\t}\n\t\t\t\tmu.Lock()\n\t\t\t\tactive--\n\t\t\t\tdone++\n\t\t\t\tmu.Unlock()\n\t\t\t}\n\t\t}()\n\t}\n\tfor i := 0; i < workers; i++ {\n\t\t<-ready\n\t}\n\tclose(release)\n\twg.Wait()\n\treturn peak, done\n}\nfunc solve() string { peak, done := run(2, 8); return fmt.Sprintf(\"peak=%d done=%d\", peak, done) }\nfunc main()         { fmt.Println(solve()) }\n",
    "starterOutput": "peak=8 done=8",
    "expectedOutput": "peak=2 done=8",
    "testCode": "package main\n\nimport (\n\t\"fmt\"\n\t\"reflect\"\n\t\"testing\"\n)\n\nvar _ = reflect.DeepEqual\nvar _ = fmt.Sprint\n\nfunc TestBounded(t *testing.T) {\n\tfor _, c := range [][2]int{{2, 8}, {1, 7}, {5, 2}, {0, 4}, {2, 0}} {\n\t\tpeak, done := run(c[0], c[1])\n\t\twant := c[1]\n\t\tif c[0] <= 0 || c[1] <= 0 {\n\t\t\twant = 0\n\t\t}\n\t\tif done != want || peak > c[0] {\n\t\t\tt.Fatalf(\"%v peak=%d done=%d\", c, peak, done)\n\t\t}\n\t}\n}\nfunc BenchmarkSolution(b *testing.B) {\n\tfor i := 0; i < b.N; i++ {\n\t\tsolve()\n\t}\n}\n"
  }
,experiment:exp("请求突增时，按请求创建 goroutine 还是有界执行",["直接启动全部","两个 worker"],[["任务=8","执行上限=2"],["同时执行=8","等待=0"]],[["任务=8","执行上限=2"],["同时执行=2","等待=6","最终完成=8"]]),quizzes:[q("直接启动八项时峰值是多少？","8","2","没有实际执行许可约束。"),q("只在 goroutine 内拿信号量限制了什么？","受保护执行数，不一定限制 goroutine 数","所有资源自动有界","等待 goroutine 仍已创建。"),q("固定 worker 能否允许入口无限积压？","不能，还要限制队列","可以","队列仍耗内存并增加等待。"),q("本题修复重点？","固定 worker 并处理全部任务","用 sleep 错开任务当并发上限","时间猜测不是容量约束。"),q("上游已严格只发一项且低负载，可？","简单 goroutine 方式可能足够","任何异步任务都必须复杂池化","成本与需求匹配。"),q("每任务都持有大缓冲，十万 goroutine 等许可时？","仍可能因等待资源耗尽内存","因活跃只有两项就必定安全","执行限制不等于内存限制。")]}),
lesson({
  "id": 122,
  "title": "请求扇出多个依赖，如何分配并发额度与总超时",
  "scenario": "聚合页总预算 300ms，核心价格、库存和可选推荐并行调用；每层都独立设置 300ms，又在失败后重试，整体不断超时。",
  "constraints": [
    "端到端预算 300ms",
    "价格和库存必需",
    "推荐可缺省"
  ],
  "options": [
    {
      "title": "每个调用重置同样超时",
      "benefits": "局部配置简单",
      "costs": "排队和重试可重复消耗预算",
      "when": "完全独立且不属于同一请求预算"
    },
    {
      "title": "继承总 deadline 再细分",
      "benefits": "端到端边界清楚，可保留组装时间",
      "costs": "需要明确必要与可选依赖",
      "when": "一次聚合请求有共同目标"
    }
  ],
  "recommendation": "传播根 deadline，为排队、下游和组装预留预算；限制并发扇出，可选推荐耗尽自身预算就降级。",
  "pitfall": "每次重试创建 Background 加完整超时，绕过上游取消。",
  "mechanism": [
    "子调用预算不能晚于父请求可接受的完成边界。",
    "排队时间也消耗端到端延迟预算。",
    "并行依赖的延迟关系不同于串行相加，但资源消耗会相加。"
  ],
  "boundary": "独立持久任务不必继承已结束请求预算，但必须有自己的生命周期。",
  "revisitWhen": [
    "依赖延迟分布变化",
    "核心与可选需求改变"
  ],
  "mnemonic": "预算从根来，排队也花钱。",
  "sources": [
    {
      "title": "Go context：Deadline 与取消",
      "url": "https://pkg.go.dev/context"
    }
  ],
  "diagram": [
    {
      "title": "共享端到端预算",
      "source": "flowchart TD\n R[\"请求总预算 300ms\"] --> P[\"价格 必需\"]\n R --> S[\"库存 必需\"]\n R --> C[\"推荐 可降级\"]\n P --> A[\"组装响应\"]\n S --> A\n C --> A",
      "caption": "图表示并行依赖，不表示真实耗时测量。",
      "kind": "architecture"
    }
  ]
,experiment:exp("请求扇出多个依赖，如何分配并发额度与总超时",["局部重置预算","传播剩余预算"],[["总预算=300ms","排队=80ms"],["下游重置=300ms","最大结束=380ms"]],[["总预算=300ms","排队=80ms"],["下游最多=200ms","组装预留=20ms","总上限=300ms"]]),quizzes:[q("已排队 80ms 后能重给下游完整 300ms 吗？","不应超过剩余总预算","可以，排队不算请求延迟","用户观察的是端到端时间。"),q("三个并行调用的资源消耗怎样？","并发资源会叠加","因并行而只算一份","延迟并行不等于成本消失。"),q("持久后台任务是否必须随请求超时结束？","视业务生命周期另设预算","所有任务只能继承请求","独立任务需明确所有者和可靠交接。"),q("重试创建 Background 会怎样？","可能绕过父 deadline 与取消","自动缩短剩余预算","上下文树决定传播关系。"),q("推荐变成下单必需风控后，应？","重新划定必要依赖和预算","继续无条件缺省成功","关键性变化改变降级策略。"),q("搜索总 500ms、排队 200ms、组装留 50ms，下游最多？","250ms","500ms","必须扣除已用和预留预算。")]}),
lesson({
  "id": 123,
  "title": "并行子任务一个失败是否应该取消全部",
  "scenario": "用户主页同时取账户、订单和推荐；账户无权限意味着整个请求不能继续，推荐超时却只影响一个可选区域。",
  "constraints": [
    "账户与订单为必需数据",
    "推荐可降级",
    "所有子任务必须可结束"
  ],
  "options": [
    {
      "title": "任意错误取消全部",
      "benefits": "快速释放必需失败后的资源",
      "costs": "可选依赖可能拖垮整个结果",
      "when": "所有子结果缺一不可"
    },
    {
      "title": "按依赖关键性分组",
      "benefits": "核心失败快停，可选失败可隔离",
      "costs": "需清楚定义部分结果契约",
      "when": "存在允许降级的子结果"
    }
  ],
  "recommendation": "必需组失败取消剩余工作并等待结束；可选推荐使用独立子预算，失败返回已定义的降级区域。",
  "pitfall": "不区分错误的业务影响，统一吞错或统一 fail-fast。",
  "mechanism": [
    "取消策略取决于业务结果是否仍有价值。",
    "任务返回错误和其他任务实际结束是两件事。",
    "部分结果应标明降级，不能伪装为完整成功。"
  ],
  "boundary": "金额汇总等缺一项就错误的聚合应整体失败，不能借可选机制静默忽略。",
  "revisitWhen": [
    "某子结果从可选变必需",
    "部分结果会误导业务操作"
  ],
  "mnemonic": "先分必需可选，再定取消范围。",
  "sources": [
    {
      "title": "Go：Pipeline 取消与结束",
      "url": "https://go.dev/blog/pipelines"
    }
  ],
  "diagram": [
    {
      "title": "关键性决定失败传播",
      "source": "flowchart TD\n R[\"主页请求\"] --> E[\"账户与订单 必需组\"]\n R --> O[\"推荐 可选组\"]\n E -->|失败| C[\"取消全部并等待\"]\n O -->|失败| D[\"推荐区域降级\"]\n E -->|成功| A[\"组装可用响应\"]\n D --> A",
      "caption": "可选失败策略是业务协议，不能自动应用到所有聚合。",
      "kind": "flow"
    }
  ]
,experiment:exp("并行子任务一个失败是否应该取消全部",["任意失败全停","按关键性隔离"],[["账户=成功","推荐=超时"],["页面=整体失败","有效核心结果=丢弃"]],[["账户=成功","推荐=超时"],["页面=核心可用","推荐=明确降级","子任务=均已结束"]]),quizzes:[q("推荐超时按本题应？","降级推荐区域","拒绝全部主页","该结果被明确规定为可选。"),q("cancel 是否代表全部子任务已退出？","不代表，还要等待","代表","取消只是信号。"),q("金额总计缺一项是否可当可选忽略？","不能，结果会失真","可直接沿用推荐策略","业务不变量不同。"),q("账户授权失败应？","取消无意义工作并等待结束","继续调用所有私有数据","必需条件失败后结果无效。"),q("推荐变成风险拦截必需判断时？","改为必需依赖并调整失败契约","仍返回默认推荐成功","关键性改变取消策略。"),q("天气页面定位可选但安全告警必需，哪个错误可局部降级？","定位缺失且有明确默认地点","安全告警失败却当无告警","降级不能改变关键安全语义。")]}),
lesson({
  "id": 124,
  "title": "跨模块 goroutine 的启动、停止和等待责任归谁",
  "scenario": "服务退出时先关数据库，再取消后台 worker；worker 收尾需要写最终状态，因此资源已关闭。示例用确定的原子标志表示资源可用性。",
  "constraints": [
    "后台任务有收尾操作",
    "收尾依赖共享资源",
    "退出必须等待完成"
  ],
  "options": [
    {
      "title": "模块自行启动无人管理",
      "benefits": "调用方代码少",
      "costs": "退出状态与资源依赖不透明",
      "when": "不适合作为长期服务默认"
    },
    {
      "title": "显式生命周期所有者",
      "benefits": "可控制停止顺序、等待与超时",
      "costs": "需暴露完成或停止协议",
      "when": "长寿命后台工作"
    }
  ],
  "recommendation": "启动者登记生命周期；先通知任务停止、等待必要收尾，再关闭其依赖资源，并给整体退出设置预算。",
  "pitfall": "关闭资源后才通知使用它的 goroutine 结束。",
  "mechanism": [
    "资源所有权与任务生命周期必须协调。",
    "取消、收尾完成、资源关闭是不同阶段。",
    "完成信号为关闭依赖提供可验证依据。"
  ],
  "boundary": "不能合作退出的代码需要最终超时策略；等待不意味着无限阻塞。",
  "revisitWhen": [
    "新模块启动隐藏 goroutine",
    "新增资源依赖改变关闭顺序"
  ],
  "mnemonic": "先停使用者，再关被使用者。",
  "sources": [
    {
      "title": "Go context：取消不等待完成",
      "url": "https://pkg.go.dev/context"
    }
  ],
  "diagram": [
    {
      "title": "按资源依赖收尾",
      "source": "flowchart LR\n S[\"停止入口\"] --> C[\"取消后台任务\"]\n C --> W[\"等待收尾完成\"]\n W --> D[\"关闭数据库等资源\"]",
      "caption": "真实系统顺序应根据实际依赖关系决定。",
      "kind": "flow"
    }
  ],
  "code": {
    "starter": "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\t\"sync/atomic\"\n)\n\nfunc shutdown() (bool, bool) {\n\tctx, cancel := context.WithCancel(context.Background())\n\tdefer cancel()\n\tvar resourceClosed atomic.Bool\n\tdone := make(chan bool, 1)\n\tgo func() { <-ctx.Done(); done <- !resourceClosed.Load() }()\n\tresourceClosed.Store(true)\n\tcancel()\n\tcleanupOK := <-done\n\treturn cleanupOK, resourceClosed.Load()\n}\nfunc solve() string {\n\tok, closed := shutdown()\n\treturn fmt.Sprintf(\"cleanupWithOpenResource=%v resourceClosed=%v\", ok, closed)\n}\nfunc main() { fmt.Println(solve()) }\n",
    "solution": "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\t\"sync/atomic\"\n)\n\nfunc shutdown() (bool, bool) {\n\tctx, cancel := context.WithCancel(context.Background())\n\tdefer cancel()\n\tvar resourceClosed atomic.Bool\n\tdone := make(chan bool, 1)\n\tgo func() { <-ctx.Done(); done <- !resourceClosed.Load() }()\n\tcancel()\n\tcleanupOK := <-done\n\tresourceClosed.Store(true)\n\treturn cleanupOK, resourceClosed.Load()\n}\nfunc solve() string {\n\tok, closed := shutdown()\n\treturn fmt.Sprintf(\"cleanupWithOpenResource=%v resourceClosed=%v\", ok, closed)\n}\nfunc main() { fmt.Println(solve()) }\n",
    "starterOutput": "cleanupWithOpenResource=false resourceClosed=true",
    "expectedOutput": "cleanupWithOpenResource=true resourceClosed=true",
    "testCode": "package main\n\nimport (\n\t\"fmt\"\n\t\"reflect\"\n\t\"testing\"\n)\n\nvar _ = reflect.DeepEqual\nvar _ = fmt.Sprint\n\nfunc TestShutdownOrder(t *testing.T) {\n\tfor i := 0; i < 25; i++ {\n\t\tok, closed := shutdown()\n\t\tif !ok || !closed {\n\t\t\tt.Fatalf(\"worker cleanup=%v resource closed=%v\", ok, closed)\n\t\t}\n\t}\n}\nfunc BenchmarkSolution(b *testing.B) {\n\tfor i := 0; i < b.N; i++ {\n\t\tsolve()\n\t}\n}\n"
  }
,experiment:exp("跨模块 goroutine 的启动、停止和等待责任归谁",["先关资源","先等使用者"],[["worker=仍需收尾","数据库=已关闭"],["收尾=无法访问资源","状态=未确认"]],[["worker=收到取消","数据库=保持可用"],["收尾=确认完成","数据库=关闭","任务=已退出"]]),quizzes:[q("先关资源会导致？","worker 无法完成依赖资源的收尾","自动让收尾更快成功","资源依赖决定关闭次序。"),q("生命周期所有者需要知道？","任务何时确实完成","只知道 goroutine 已启动","完成证据才能支持安全释放。"),q("worker 不响应取消时能无限等吗？","不能，应有退出预算和兜底","必须永远等","有界退出也需要报告未完成状态。"),q("修复顺序是？","通知停止、等待、关闭依赖","关闭依赖、再启动新任务","先停止资源使用者。"),q("新增 worker 依赖消息客户端完成确认时？","重新检查客户端关闭次序","只按构造函数字母序关闭","依赖关系是排序依据。"),q("日志批写任务需要最后 flush，退出时应？","等待 flush 确认后关闭输出","先关闭文件再等 flush","相同资源所有权原则。")]}),
lesson({
  "id": 125,
  "title": "共享 worker pool 如何防止大租户饿死小租户",
  "scenario": "租户 A 连续排入三项，B 排入一项；本轮只有三个执行名额，单一 FIFO 全被 A 占据。示例任务成本相同。",
  "constraints": [
    "租户需要公平开始执行",
    "任务成本近似相同",
    "空闲配额允许借用"
  ],
  "options": [
    {
      "title": "全局 FIFO",
      "benefits": "简单并保持全局到达顺序",
      "costs": "大租户可占满队列",
      "when": "租户无公平承诺或入口已配额"
    },
    {
      "title": "租户分队列轮转",
      "benefits": "每轮给活跃租户机会",
      "costs": "需配额、队列与调度管理",
      "when": "任务成本相近且要求公平"
    },
    {
      "title": "加权成本调度",
      "benefits": "支持不同购买等级或任务成本",
      "costs": "需要估计成本和配置权重",
      "when": "租户等级或工作量差异明显"
    }
  ],
  "recommendation": "按租户排队并轮转选择，配合入口配额；实际任务成本差异大时升级为按成本或权重公平。",
  "pitfall": "限制总并发却忽略谁拥有所有等待名额。",
  "mechanism": [
    "全局容量约束不等于租户公平。",
    "按租户分队列让调度可以控制份额。",
    "公平开始次数不等于公平 CPU 时间。"
  ],
  "boundary": "本例只模拟等成本任务选择，不证明真实 wall-clock 公平或持久队列可靠性。",
  "revisitWhen": [
    "租户任务成本不同",
    "需要付费等级权重"
  ],
  "mnemonic": "总量有界，份额有主。",
  "sources": [
    {
      "title": "Kubernetes：API 优先级与公平性",
      "url": "https://kubernetes.io/docs/concepts/cluster-administration/flow-control/"
    }
  ],
  "diagram": [
    {
      "title": "按租户轮转选择",
      "source": "flowchart LR\n A[\"租户 A 队列\"] --> S[\"公平调度器\"]\n B[\"租户 B 队列\"] --> S\n S --> W[\"共享有界 worker\"]",
      "caption": "调度与入口配额共同控制公平性。",
      "kind": "flow"
    }
  ],
  "code": {
    "starter": "package main\n\nimport (\n\t\"fmt\"\n)\n\nfunc schedule(a, b []string, slots int) []string {\n\tout := []string{}\n\tfor _, queue := range [][]string{a, b} {\n\t\tfor _, job := range queue {\n\t\t\tif len(out) >= slots {\n\t\t\t\treturn out\n\t\t\t}\n\t\t\tout = append(out, job)\n\t\t}\n\t}\n\treturn out\n}\nfunc solve() string { return fmt.Sprint(schedule([]string{\"a1\", \"a2\", \"a3\"}, []string{\"b1\"}, 3)) }\nfunc main()         { fmt.Println(solve()) }\n",
    "solution": "package main\n\nimport (\n\t\"fmt\"\n)\n\nfunc schedule(a, b []string, slots int) []string {\n\tout := []string{}\n\tfor (len(a) > 0 || len(b) > 0) && len(out) < slots {\n\t\tif len(a) > 0 {\n\t\t\tout = append(out, a[0])\n\t\t\ta = a[1:]\n\t\t}\n\t\tif len(b) > 0 && len(out) < slots {\n\t\t\tout = append(out, b[0])\n\t\t\tb = b[1:]\n\t\t}\n\t}\n\treturn out\n}\nfunc solve() string { return fmt.Sprint(schedule([]string{\"a1\", \"a2\", \"a3\"}, []string{\"b1\"}, 3)) }\nfunc main()         { fmt.Println(solve()) }\n",
    "starterOutput": "[a1 a2 a3]",
    "expectedOutput": "[a1 b1 a2]",
    "testCode": "package main\n\nimport (\n\t\"fmt\"\n\t\"reflect\"\n\t\"testing\"\n)\n\nvar _ = reflect.DeepEqual\nvar _ = fmt.Sprint\n\nfunc TestFairSchedule(t *testing.T) {\n\tcases := []struct {\n\t\ta, b  []string\n\t\tslots int\n\t\twant  []string\n\t}{{[]string{\"a1\", \"a2\"}, []string{\"b1\"}, 2, []string{\"a1\", \"b1\"}}, {nil, []string{\"b1\", \"b2\"}, 3, []string{\"b1\", \"b2\"}}, {[]string{\"a1\"}, nil, 0, []string{}}}\n\tfor _, c := range cases {\n\t\tif got := schedule(c.a, c.b, c.slots); !reflect.DeepEqual(got, c.want) {\n\t\t\tt.Fatalf(\"got %v want %v\", got, c.want)\n\t\t}\n\t}\n}\nfunc BenchmarkSolution(b *testing.B) {\n\tfor i := 0; i < b.N; i++ {\n\t\tsolve()\n\t}\n}\n"
  }
,experiment:exp("共享 worker pool 如何防止大租户饿死小租户",["全局 FIFO","租户轮转"],[["A队列=[a1,a2,a3]","B队列=[b1]"],["本轮=[a1,a2,a3]","B开始数=0"]],[["A队列=[a1,a2,a3]","B队列=[b1]"],["本轮=[a1,b1,a2]","B开始数=1","A仍可借空闲=是"]]),quizzes:[q("FIFO 三个名额中 B 得到几个？","0","1","A 占据队头。"),q("限总并发为何不等于公平？","无法限制某租户占全部份额","并发限制从来没有价值","容量和份额是两种控制。"),q("每任务耗时差百倍，轮转次数等于 CPU 公平吗？","不等于","等于","实际成本差异要纳入策略。"),q("本题可如何改善？","按租户队列轮转并配入口配额","仅无限增大共享队列","增大队列不解决份额。"),q("付费租户需要四倍份额，应？","显式加权并验证份额","继续宣称均等轮转满足合同","业务权重改变算法。"),q("某租户暂时没有任务，其他租户可？","按约定借用空闲容量","为了公平让所有 worker 空转","公平不必牺牲无竞争时的利用率。")]}),
lesson({
  "id": 126,
  "title": "队列满时应该等待、拒绝、丢弃还是降级",
  "scenario": "异步接收接口队列容量为一，已排满；offer 实际没入队却仍返回 true，客户端以为任务已接受。",
  "constraints": [
    "业务任务不可静默丢失",
    "队列容量固定",
    "入口可以返回明确忙碌"
  ],
  "options": [
    {
      "title": "有界等待",
      "benefits": "吸收短暂突发",
      "costs": "占用请求预算和资源",
      "when": "调用方可等待且期限明确"
    },
    {
      "title": "立即拒绝",
      "benefits": "保护服务且状态明确",
      "costs": "调用方需限速和有界重试",
      "when": "当前无容量且允许失败"
    },
    {
      "title": "丢弃或合并",
      "benefits": "适合低价值或可替代数据",
      "costs": "损失部分输入",
      "when": "业务明确允许丢失"
    }
  ],
  "recommendation": "本题满额时显式返回未接受，调用方按预算重试；只有真正入队才返回已接受。",
  "pitfall": "吞掉队列满错误，把未执行的任务报告为成功。",
  "mechanism": [
    "接收确认是关于责任交接的承诺。",
    "阻塞等待必须响应取消和期限。",
    "丢弃策略必须由业务语义授权。"
  ],
  "boundary": "内存入队只保证当前进程已接收，不保证进程崩溃后持久交付。",
  "revisitWhen": [
    "需要崩溃后仍保证执行",
    "数据变为只需最新值的采样"
  ],
  "mnemonic": "没接住，就别说接住。",
  "sources": [
    {
      "title": "Go：Channel 与选择语句",
      "url": "https://go.dev/ref/spec#Select_statements"
    }
  ],
  "diagram": [
    {
      "title": "容量决定接收结果",
      "source": "flowchart TD\n R[\"提交任务\"] --> Q{\"有队列容量\"}\n Q -->|有| A[\"入队并返回已接收\"]\n Q -->|无| B[\"返回忙碌与未接收\"]",
      "caption": "内存接收不是持久执行保证。",
      "kind": "flow"
    }
  ],
  "code": {
    "starter": "package main\n\nimport (\n\t\"fmt\"\n)\n\nfunc offer(queue chan int, value int) bool {\n\tselect {\n\tcase queue <- value:\n\t\treturn true\n\tdefault:\n\t\treturn true\n\t}\n}\nfunc solve() string {\n\tqueue := make(chan int, 1)\n\toffer(queue, 1)\n\taccepted := offer(queue, 2)\n\treturn fmt.Sprintf(\"accepted=%v queued=%d\", accepted, len(queue))\n}\nfunc main() { fmt.Println(solve()) }\n",
    "solution": "package main\n\nimport (\n\t\"fmt\"\n)\n\nfunc offer(queue chan int, value int) bool {\n\tselect {\n\tcase queue <- value:\n\t\treturn true\n\tdefault:\n\t\treturn false\n\t}\n}\nfunc solve() string {\n\tqueue := make(chan int, 1)\n\toffer(queue, 1)\n\taccepted := offer(queue, 2)\n\treturn fmt.Sprintf(\"accepted=%v queued=%d\", accepted, len(queue))\n}\nfunc main() { fmt.Println(solve()) }\n",
    "starterOutput": "accepted=true queued=1",
    "expectedOutput": "accepted=false queued=1",
    "testCode": "package main\n\nimport (\n\t\"fmt\"\n\t\"reflect\"\n\t\"testing\"\n)\n\nvar _ = reflect.DeepEqual\nvar _ = fmt.Sprint\n\nfunc TestAdmission(t *testing.T) {\n\tq := make(chan int, 1)\n\tif !offer(q, 7) {\n\t\tt.Fatal(\"empty rejected\")\n\t}\n\tif offer(q, 8) {\n\t\tt.Fatal(\"full reported accepted\")\n\t}\n\tif got := <-q; got != 7 {\n\t\tt.Fatal(\"queued work changed\")\n\t}\n\tif !offer(q, 9) {\n\t\tt.Fatal(\"capacity did not recover\")\n\t}\n}\nfunc BenchmarkSolution(b *testing.B) {\n\tfor i := 0; i < b.N; i++ {\n\t\tsolve()\n\t}\n}\n"
  }
,experiment:exp("队列满时应该等待、拒绝、丢弃还是降级",["静默失败报成功","明确拒绝"],[["队列容量=1","已有任务=1"],["新任务=未入队","返回=已接收"]],[["队列容量=1","已有任务=1"],["新任务=未入队","返回=未接收","调用方=可有界恢复"]]),quizzes:[q("满额没入队却 true 的问题？","虚假的责任交接","仅日志不够美观","调用方误以为系统负责执行。"),q("等待容量时要包含什么？","取消与等待期限","永久等待","等待也占资源与预算。"),q("可丢弃的监控采样能否选择丢旧？","可以，但必须明确语义","任何数据都禁止丢弃","策略取决于业务价值。"),q("修复 offer 应？","default 返回 false","满额时仍 true","只有成功入队才确认接受。"),q("要求重启后继续执行，应？","引入持久任务交接","只增加 channel 容量","内存不能提供崩溃持久性。"),q("实时地图只要最新位置，队列满时可评估？","合并为最新位置","对每次历史采样永久阻塞","允许替代的输入适用不同策略。")]}),
lesson({
  "id": 127,
  "title": "共享状态采用 Mutex、消息传递还是不可变快照",
  "scenario": "路由表每分钟更新一次、每请求读取，单次读取需要看到完整版本；团队争论所有共享状态是否都应该改成 channel。",
  "constraints": [
    "高频读、低频写",
    "一份路由表整体一致",
    "更新后旧读者可完成"
  ],
  "options": [
    {
      "title": "Mutex 保护读写",
      "benefits": "简单直接表达临界区",
      "costs": "高频争用可能增加等待",
      "when": "读写规模适中或更新局部复杂"
    },
    {
      "title": "单所有者消息循环",
      "benefits": "状态转换顺序集中",
      "costs": "请求排队和生命周期管理",
      "when": "复杂状态机且消息语义自然"
    },
    {
      "title": "不可变快照发布",
      "benefits": "读取稳定版本、少争用",
      "costs": "复制成本与旧版本暂存",
      "when": "读多写少且可整体替换"
    }
  ],
  "recommendation": "本题优先构建并验证完整新快照，再原子发布；发布后不修改快照及其引用对象。",
  "pitfall": "只原子替换 map 指针，却继续原地修改 map 内容。",
  "mechanism": [
    "同步工具应匹配所有权和不变量。",
    "原子发布只保护引用替换，不使引用对象自动不可变。",
    "旧读者可以持有旧快照，回收与引用生命周期有关。"
  ],
  "boundary": "大型高频更新状态可能使复制太贵，应测量后考虑锁或分区更新。",
  "revisitWhen": [
    "更新频率明显增加",
    "快照体积导致内存峰值"
  ],
  "mnemonic": "读多写少，整版发布。",
  "sources": [
    {
      "title": "Go atomic.Value：读取较多的示例",
      "url": "https://pkg.go.dev/sync/atomic#example-Value-ReadMostly"
    },
    {
      "title": "Go 内存模型",
      "url": "https://go.dev/ref/mem"
    }
  ],
  "diagram": [
    {
      "title": "完整快照替换",
      "source": "flowchart LR\n W[\"构建并验证新版本\"] --> P[\"原子发布引用\"]\n P --> N[\"新读者使用新快照\"]\n O[\"旧读者\"] --> S[\"旧快照保持不可变\"]",
      "caption": "快照内部 map、slice 和指针也必须遵守不可变约定。",
      "kind": "architecture"
    }
  ]
,experiment:exp("共享状态采用 Mutex、消息传递还是不可变快照",["原地修改","整体发布"],[["读者=读取版本1","写者=逐字段修改同对象"],["读者=可能混合新旧","一致性=需额外同步"]],[["旧读者=持有版本1","写者=构建版本2"],["新读者=版本2","旧读者=版本1","每次读取=完整版本"]]),quizzes:[q("本题为什么适合快照？","读多写少且要求完整版本","channel 永远比锁慢","选择依据是负载与不变量。"),q("原子替换指针是否让内部 map 安全可变？","不是","是","发布与后续对象修改不同。"),q("状态巨大且每毫秒更新，仍无条件复制吗？","应测成本并重新选择","必须坚持快照","更新成本改变权衡。"),q("发布后怎样处理旧快照？","允许旧读者完成且不再修改","立刻原地复用其存储","仍有读者时复用会破坏隔离。"),q("复杂顺序工作流天然由命令驱动，可能选择？","单所有者消息循环","所有共享状态只能 atomic","不同状态模型适合不同工具。"),q("低频后台计数更新且简单一致性，起点可选？","简单 Mutex 并据测量调整","先构建多级快照系统","不要在无证据时增加复杂度。")]}),
lesson({
  "id": 128,
  "title": "热点锁应该拆分、分片还是减少临界区工作",
  "scenario": "服务用一把锁保护所有租户缓存，锁内还执行网络回源；Profile 显示大量等待，但不清楚是不是 map 操作本身太慢。",
  "constraints": [
    "租户间数据独立",
    "跨键事务很少",
    "回源耗时不可预测"
  ],
  "options": [
    {
      "title": "缩短临界区",
      "benefits": "去掉明显无关等待，改动较小",
      "costs": "锁外工作结果需再次验证",
      "when": "锁内有 I/O 或重计算"
    },
    {
      "title": "按键或租户分片",
      "benefits": "独立状态可并行",
      "costs": "跨片操作需排序和一致性协议",
      "when": "热点可分散且状态可分区"
    },
    {
      "title": "换 RWMutex",
      "benefits": "读多写少时可能改善",
      "costs": "未必解决慢写或真正热点",
      "when": "测量证实读争用适合"
    }
  ],
  "recommendation": "先移出慢 I/O 并设计重复回源和结果版本检查，再用 Profile 判断是否需要分片。",
  "pitfall": "只把 Mutex 换成 RWMutex，却继续在写锁中调用慢网络。",
  "mechanism": [
    "锁等待可能来自临界区长度而非锁原语。",
    "锁外计算后写回必须确认相关状态未失效。",
    "分片减少独立状态争用，但跨片不变量更复杂。"
  ],
  "boundary": "单一热点键不会因简单哈希分片自动分散；跨键强一致会限制拆锁。",
  "revisitWhen": [
    "仍有可测量锁争用",
    "出现跨片原子操作需求"
  ],
  "mnemonic": "先缩短，再分散，最后验不变量。",
  "sources": [
    {
      "title": "Go：诊断与阻塞分析",
      "url": "https://go.dev/doc/diagnostics"
    }
  ],
  "diagram": [
    {
      "title": "锁外 I/O 后验证写回",
      "source": "flowchart LR\n R[\"锁内读取版本\"] --> I[\"锁外执行 I/O\"]\n I --> V[\"重新加锁检查版本\"]\n V -->|仍有效| W[\"写回\"]\n V -->|已变化| D[\"丢弃或重试结果\"]",
      "caption": "移出 I/O 后需要防止过时结果覆盖新状态。",
      "kind": "flow"
    }
  ]
,experiment:exp("热点锁应该拆分、分片还是减少临界区工作",["锁内回源","锁外回源后验证"],[["锁内=网络请求","其他租户=等待"],["锁持有=100ms","独立读取=被阻塞"]],[["锁内=读取版本","网络请求=锁外"],["锁持有=1ms","写回=核对版本","独立读取=可继续"]]),quizzes:[q("本题第一步优先？","检查并缩短锁内 I/O","直接换所有锁为 RWMutex","证据指向长临界区。"),q("锁外计算写回为何要验版本？","防止过时结果覆盖新状态","为了让 map 排序","释放锁后状态可能已经变化。"),q("一个热键能靠哈希分片自动分散吗？","不能，该键仍落同片","能，片数越多热键越散","分片按键分布，不能拆同键操作。"),q("跨片操作需要考虑？","锁顺序与整体不变量","只保证各片单独无数据竞争","局部安全不等于跨片一致。"),q("读多写少且临界区短，证据显示读争用时？","可以比较 RWMutex 与现方案","仍绝不能用读写锁","测量与负载改变选择。"),q("全局统计锁内做磁盘写导致排队，优先？","把慢写移出并保证提交语义","仅把锁变量改名","解决等待来源。")]}),
lesson({
  "id": 129,
  "title": "多个原子字段安全，为什么整体状态仍可能不一致",
  "scenario": "限流配置 limit 与 burst 必须来自同一版本；读者读到旧 limit 后写者更新两字段，再读 burst 得到新值。示例以确定顺序复现允许的交错。",
  "constraints": [
    "每字段均使用原子访问",
    "读者需要一个完整配置版本",
    "发布后配置不可变"
  ],
  "options": [
    {
      "title": "每字段独立 atomic",
      "benefits": "局部更新简单",
      "costs": "读者可能拼出混合版本",
      "when": "字段之间不存在共同不变量"
    },
    {
      "title": "同一锁保护整体",
      "benefits": "直接保证临界区一致",
      "costs": "读写争用",
      "when": "状态复杂或频繁局部变更"
    },
    {
      "title": "原子发布整体快照",
      "benefits": "一次读取获得完整版本",
      "costs": "需不可变与复制约束",
      "when": "配置整体更新且读多写少"
    }
  ],
  "recommendation": "将关联配置作为不可变整体发布，读者只加载一次快照；也可用同一锁覆盖完整读写。",
  "pitfall": "把 race detector 没报错当作业务不变量已经成立。",
  "mechanism": [
    "无数据竞争不代表多次读操作构成事务。",
    "分别原子写入仍存在中间可见状态。",
    "一次加载整体快照使字段来自同一对象版本。"
  ],
  "boundary": "示例显式安排交错，不依赖调度碰运气；真实快照内部引用也必须保持不可变。",
  "revisitWhen": [
    "新增跨字段不变量",
    "发布后需要修改嵌套对象"
  ],
  "mnemonic": "原子一字段，不是事务一组。",
  "sources": [
    {
      "title": "Go sync/atomic",
      "url": "https://pkg.go.dev/sync/atomic"
    },
    {
      "title": "Go 内存模型",
      "url": "https://go.dev/ref/mem"
    }
  ],
  "diagram": [
    {
      "title": "读者加载一个版本",
      "source": "flowchart LR\n W[\"完整新配置\"] --> P[\"原子发布\"]\n P --> R[\"读者加载一次快照\"]\n R --> L[\"同版本 limit\"]\n R --> B[\"同版本 burst\"]",
      "caption": "示例关注逻辑一致性，不只是内存竞争。",
      "kind": "architecture"
    }
  ],
  "code": {
    "starter": "package main\n\nimport (\n\t\"fmt\"\n\t\"sync/atomic\"\n)\n\ntype Pair struct {\n\tLimit int64\n\tBurst int64\n}\n\nfunc duringUpdate(old, next Pair) Pair {\n\tvar limit, burst atomic.Int64\n\tlimit.Store(old.Limit)\n\tburst.Store(old.Burst)\n\ta := limit.Load()\n\tlimit.Store(next.Limit)\n\tburst.Store(next.Burst)\n\tb := burst.Load()\n\treturn Pair{a, b}\n}\nfunc solve() string {\n\ts := duringUpdate(Pair{10, 20}, Pair{30, 40})\n\treturn fmt.Sprintf(\"limit=%d burst=%d\", s.Limit, s.Burst)\n}\nfunc main() { fmt.Println(solve()) }\n",
    "solution": "package main\n\nimport (\n\t\"fmt\"\n\t\"sync/atomic\"\n)\n\ntype Pair struct {\n\tLimit int64\n\tBurst int64\n}\n\nfunc duringUpdate(old, next Pair) Pair {\n\tvar state atomic.Pointer[Pair]\n\tstate.Store(&old)\n\tsnapshot := state.Load()\n\tstate.Store(&next)\n\treturn *snapshot\n}\nfunc solve() string {\n\ts := duringUpdate(Pair{10, 20}, Pair{30, 40})\n\treturn fmt.Sprintf(\"limit=%d burst=%d\", s.Limit, s.Burst)\n}\nfunc main() { fmt.Println(solve()) }\n",
    "starterOutput": "limit=10 burst=40",
    "expectedOutput": "limit=10 burst=20",
    "testCode": "package main\n\nimport (\n\t\"fmt\"\n\t\"reflect\"\n\t\"testing\"\n)\n\nvar _ = reflect.DeepEqual\nvar _ = fmt.Sprint\n\nfunc TestConsistentSnapshot(t *testing.T) {\n\tfor _, c := range [][2]Pair{{{10, 20}, {30, 40}}, {{2, 4}, {9, 18}}, {{0, 0}, {1, 2}}} {\n\t\tgot := duringUpdate(c[0], c[1])\n\t\tif got != c[0] && got != c[1] {\n\t\t\tt.Fatalf(\"mixed pair: %v from %v\", got, c)\n\t\t}\n\t}\n}\nfunc BenchmarkSolution(b *testing.B) {\n\tfor i := 0; i < b.N; i++ {\n\t\tsolve()\n\t}\n}\n"
  }
,experiment:exp("多个原子字段安全，为什么整体状态仍可能不一致",["分别原子读取","一次读取快照"],[["旧版本=10和20","新版本=30和40"],["读取limit=10","更新发生=两字段替换","读取burst=40"]],[["旧版本=10和20","快照=先加载旧对象"],["读取limit=10","新发布=不改变旧快照","读取burst=20"]]),quizzes:[q("交错后可能读到什么？","旧 limit 和新 burst","一定是完整新版","每次原子读取并非整体事务。"),q("race 检查无报警说明？","未发现数据竞争，不保证业务一致","所有业务不变量都成立","逻辑竞态可能全用原子访问。"),q("字段完全独立时必须整体快照吗？","未必，独立 atomic 可合适","任何字段都必须一起加锁","同步边界按真实不变量选择。"),q("正确快照读取应？","只 Load 一次再读取关联字段","每字段重新 Load 一次","多次 Load 仍可能跨版本。"),q("高频复杂状态更新更适合锁时？","可用同一锁覆盖完整不变量","只允许快照方案","不同机制可提供同一整体约束。"),q("配额 used 与 total 分别 atomic，校验需同版，应该？","使用整体同步或完整快照","只增加原子操作数量","同步单位要覆盖校验所需状态。")]}),
lesson({
  "id": 130,
  "title": "后台工作是否继承请求 context，如何处理必要后续动作",
  "scenario": "响应结束后要完成最多一秒的诊断汇总，直接使用已取消的请求 context 让它立即失败；它是允许丢失的辅助工作，不是必须持久完成的订单任务。",
  "constraints": [
    "响应结束不应立刻取消辅助汇总",
    "独立预算最多一秒",
    "服务仍拥有任务等待与退出责任"
  ],
  "options": [
    {
      "title": "继承请求取消",
      "benefits": "请求结束快速释放资源",
      "costs": "后续工作可能立即被取消",
      "when": "工作只对活跃请求有价值"
    },
    {
      "title": "分离取消并重设预算",
      "benefits": "保留必要关联信息且工作有界",
      "costs": "需独立所有者与资源回收",
      "when": "允许尽力执行的短后续工作"
    },
    {
      "title": "持久队列交接",
      "benefits": "可跨进程崩溃恢复",
      "costs": "需任务状态与幂等",
      "when": "业务必须可靠完成"
    }
  ],
  "recommendation": "本题用 WithoutCancel 后立即附加独立超时，并由服务跟踪任务；必须完成的业务改走持久交接。",
  "pitfall": "直接 Background 丢失诊断关联，或 WithoutCancel 后不补期限让任务永不退出。",
  "mechanism": [
    "请求 context 的取消表达请求生命周期。",
    "WithoutCancel 保留 Value 但不继承取消与 deadline。",
    "脱离请求不等于脱离服务所有权，更不等于持久执行。"
  ],
  "boundary": "WithoutCancel 需要 Go 1.21+，本项目满足；示例只是上下文机制，生产退出还需集中取消与等待。",
  "revisitWhen": [
    "辅助工作变成必须完成的业务",
    "继承值包含不应长期保留的请求资源"
  ],
  "mnemonic": "脱离请求，接上新预算与主人。",
  "sources": [
    {
      "title": "Go context.WithoutCancel",
      "url": "https://pkg.go.dev/context#WithoutCancel"
    }
  ],
  "diagram": [
    {
      "title": "后续任务独立且有界",
      "source": "flowchart LR\n R[\"请求 context\"] --> V[\"保留必要关联信息\"]\n V --> T[\"独立一秒预算\"]\n T --> W[\"服务拥有的后续任务\"]\n S[\"服务退出协议\"] --> W",
      "caption": "可靠业务必须持久交接，不能只启动 goroutine。",
      "kind": "flow"
    }
  ],
  "code": {
    "starter": "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\t\"time\"\n)\n\nvar _ = time.Second\n\nfunc followup(parent context.Context) (context.Context, context.CancelFunc) {\n\treturn context.WithCancel(parent)\n}\nfunc solve() string {\n\tparent, stop := context.WithCancel(context.Background())\n\tstop()\n\tchild, cancel := followup(parent)\n\tdefer cancel()\n\t_, bounded := child.Deadline()\n\treturn fmt.Sprintf(\"active=%v bounded=%v\", child.Err() == nil, bounded)\n}\nfunc main() { fmt.Println(solve()) }\n",
    "solution": "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\t\"time\"\n)\n\nvar _ = time.Second\n\nfunc followup(parent context.Context) (context.Context, context.CancelFunc) {\n\treturn context.WithTimeout(context.WithoutCancel(parent), time.Second)\n}\nfunc solve() string {\n\tparent, stop := context.WithCancel(context.Background())\n\tstop()\n\tchild, cancel := followup(parent)\n\tdefer cancel()\n\t_, bounded := child.Deadline()\n\treturn fmt.Sprintf(\"active=%v bounded=%v\", child.Err() == nil, bounded)\n}\nfunc main() { fmt.Println(solve()) }\n",
    "starterOutput": "active=false bounded=false",
    "expectedOutput": "active=true bounded=true",
    "testCode": "package main\n\nimport (\n\t\"context\"\n\t\"testing\"\n\t\"time\"\n)\n\nfunc TestFollowup(t *testing.T) {\n\ttype key struct{}\n\tparent, stop := context.WithCancel(context.WithValue(context.Background(), key{}, \"req-7\"))\n\tstop()\n\tchild, cancel := followup(parent)\n\tdefer cancel()\n\tif child.Err() != nil {\n\t\tt.Fatal(\"inherited canceled request\")\n\t}\n\td, ok := child.Deadline()\n\tif !ok || time.Until(d) > time.Second {\n\t\tt.Fatal(\"missing independent budget\")\n\t}\n\tif child.Value(key{}) != \"req-7\" {\n\t\tt.Fatal(\"lost correlation\")\n\t}\n\tcancel()\n\tif child.Err() != context.Canceled {\n\t\tt.Fatal(\"own cancellation missing\")\n\t}\n}\nfunc BenchmarkSolution(b *testing.B) {\n\tfor i := 0; i < b.N; i++ {\n\t\tsolve()\n\t}\n}\n"
  }
,experiment:exp("后台工作是否继承请求 context，如何处理必要后续动作",["继承已取消请求","独立有界上下文"],[["请求=已取消","汇总=继承请求"],["汇总=立即取消","有效预算=0ms"]],[["请求=已取消","汇总=分离取消"],["独立预算=1000ms","关联信息=保留","服务=仍需等待与回收"]]),quizzes:[q("直接继承已取消请求会怎样？","后续 context 立即取消","自动获得新的一秒","取消沿父子传播。"),q("WithoutCancel 保留什么？","Value，取消和 deadline 不继承","原请求 deadline 和取消","因此必须重新给预算。"),q("必须完成的扣款能只这样启动吗？","不能，应有持久交接和恢复","可以，context 就是可靠队列","上下文不提供持久性。"),q("本题修复应？","分离取消后立刻加独立超时","永久使用无期限 Background","工作要有新的结束边界。"),q("后续工作只对活跃请求有用时？","应继续继承请求取消","都必须脱离请求","业务生命周期决定传播。"),q("响应后发一条尽力审计补充信息，应如何归属？","服务登记预算、取消和完成等待","启动后不再有任何所有者","脱离请求仍需要服务级管理。")]})
] satisfies Lesson[];

