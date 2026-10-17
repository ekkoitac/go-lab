import {architectureLesson} from '../architecture-builder';
import {q,frame,experiment} from '../builders';
import type {Lesson} from '../types';
type QA=[string,string,string,string];
type Seed={id:number;title:string;scene:string;constraints:string[];options:[string,string,string,string][];answer:string;failure:string;steps:string[];limit:string;revisit:string;rule:string;flow:string;labels:[string,string];frames:[string[],string[],string[],string[]];quiz:QA[];sources:[string,string][];code?:CodeSpec;links?:[number,number,string][][];kind?:'bars'|'graph'|'timeline'};
type CodeSpec={starter:string;solution:string;starterOutput:string;expectedOutput:string;testCode:string};
function make(s:Seed){const stages=s.frames.map((values,i)=>{const f=frame(i%2?'观察结果':'进入场景',i%2?s.answer:s.labels[Math.floor(i/2)],values,i%2?Math.min(1,values.length-1):0);f.edges=(s.links?.[i]??[]).map(([a,b,label])=>({from:`n${a}`,to:`n${b}`,label}));return f;});return architectureLesson({id:s.id,title:s.title,scenario:s.scene,constraints:s.constraints,options:s.options.map(([title,benefits,costs,when])=>({title,benefits,costs,when})),recommendation:s.answer,pitfall:s.failure,mechanism:s.steps,boundary:s.limit,revisitWhen:[s.revisit],mnemonic:s.rule,sources:s.sources.map(([title,url])=>({title,url})),diagram:[{title:s.title,kind:'flow',source:s.flow,caption:s.steps.join('；')}],experiment:experiment(s.kind??'bars','资源与状态实验','逐步观察状态变化，再切换条件。数值为确定性教学模型，不代表真实系统压测。',[stages[0],stages[1]],[stages[2],stages[3]],s.labels),quizzes:s.quiz.map(x=>q(...x)),code:s.code});}

const codes:Record<number,CodeSpec>={
  "151": {
    "starter": "package main\n\nimport (\n\t\"fmt\"\n)\n\nfunc budget(total, used, reserve, steps int) int {\n\tif steps <= 0 {\n\t\treturn 0\n\t}\n\treturn total / steps\n}\nfunc solve() string { return fmt.Sprint(budget(200, 50, 20, 2)) }\nfunc main()         { fmt.Println(solve()) }\n",
    "solution": "package main\n\nimport (\n\t\"fmt\"\n)\n\nfunc budget(total, used, reserve, steps int) int {\n\tleft := total - used - reserve\n\tif left <= 0 || steps <= 0 {\n\t\treturn 0\n\t}\n\treturn left / steps\n}\nfunc solve() string { return fmt.Sprint(budget(200, 50, 20, 2)) }\nfunc main()         { fmt.Println(solve()) }\n",
    "starterOutput": "100",
    "expectedOutput": "65",
    "testCode": "package main\n\nimport \"testing\"\n\nfunc TestBehavior(t *testing.T) {\n\tfor _, c := range []struct{ total, used, reserve, steps, want int }{{200, 50, 20, 2, 65}, {100, 90, 20, 1, 0}, {99, 10, 9, 4, 20}, {100, 0, 0, 0, 0}} {\n\t\tif got := budget(c.total, c.used, c.reserve, c.steps); got != c.want {\n\t\t\tt.Fatal(c, got)\n\t\t}\n\t}\n}\nfunc TestSolution(t *testing.T) {\n\tif got := solve(); got != \"65\" {\n\t\tt.Fatal(got)\n\t}\n}\nfunc BenchmarkSolution(b *testing.B) {\n\tfor i := 0; i < b.N; i++ {\n\t\t_ = solve()\n\t}\n}\n"
  },
  "152": {
    "starter": "package main\n\nimport (\n\t\"fmt\"\n)\n\nfunc mayRetry(safe, idempotent, transient bool, left int) bool { return transient && left > 0 }\nfunc solve() string                                            { return fmt.Sprint(mayRetry(false, false, true, 50)) }\nfunc main()                                                    { fmt.Println(solve()) }\n",
    "solution": "package main\n\nimport (\n\t\"fmt\"\n)\n\nfunc mayRetry(safe, idempotent, transient bool, left int) bool {\n\treturn (safe || idempotent) && transient && left > 0\n}\nfunc solve() string { return fmt.Sprint(mayRetry(false, false, true, 50)) }\nfunc main()         { fmt.Println(solve()) }\n",
    "starterOutput": "true",
    "expectedOutput": "false",
    "testCode": "package main\n\nimport \"testing\"\n\nfunc TestBehavior(t *testing.T) {\n\tfor _, c := range []struct {\n\t\tsafe, idempotent, transient bool\n\t\tleft                        int\n\t\twant                        bool\n\t}{{false, false, true, 50, false}, {false, true, true, 50, true}, {true, false, true, 10, true}, {true, true, false, 50, false}, {true, false, true, 0, false}, {false, true, true, -1, false}} {\n\t\tif got := mayRetry(c.safe, c.idempotent, c.transient, c.left); got != c.want {\n\t\t\tt.Fatal(c, got)\n\t\t}\n\t}\n}\nfunc TestSolution(t *testing.T) {\n\tif got := solve(); got != \"false\" {\n\t\tt.Fatal(got)\n\t}\n}\nfunc BenchmarkSolution(b *testing.B) {\n\tfor i := 0; i < b.N; i++ {\n\t\t_ = solve()\n\t}\n}\n"
  },
  "154": {
    "starter": "package main\n\nimport (\n\t\"fmt\"\n)\n\nfunc admit(capacity, requests int) (int, int) {\n\tif requests < 0 {\n\t\trequests = 0\n\t}\n\tqueue := make(chan int, requests)\n\trejected := 0\n\tfor i := 0; i < requests; i++ {\n\t\tselect {\n\t\tcase queue <- i:\n\t\tdefault:\n\t\t\trejected++\n\t\t}\n\t}\n\treturn len(queue), rejected\n}\nfunc solve() string {\n\ta, r := admit(2, 5)\n\treturn fmt.Sprintf(\"%d %d\", a, r)\n}\nfunc main() { fmt.Println(solve()) }\n",
    "solution": "package main\n\nimport (\n\t\"fmt\"\n)\n\nfunc admit(capacity, requests int) (int, int) {\n\tif capacity < 0 {\n\t\tcapacity = 0\n\t}\n\tqueue := make(chan int, capacity)\n\trejected := 0\n\tfor i := 0; i < requests; i++ {\n\t\tselect {\n\t\tcase queue <- i:\n\t\tdefault:\n\t\t\trejected++\n\t\t}\n\t}\n\treturn len(queue), rejected\n}\nfunc solve() string {\n\ta, r := admit(2, 5)\n\treturn fmt.Sprintf(\"%d %d\", a, r)\n}\nfunc main() { fmt.Println(solve()) }\n",
    "starterOutput": "5 0",
    "expectedOutput": "2 3",
    "testCode": "package main\n\nimport \"testing\"\n\nfunc TestBehavior(t *testing.T) {\n\tfor _, c := range []struct{ cap, req, accepted, rejected int }{{2, 5, 2, 3}, {0, 3, 0, 3}, {3, 1, 1, 0}, {1, 0, 0, 0}, {-1, 2, 0, 2}} {\n\t\ta, r := admit(c.cap, c.req)\n\t\tif a != c.accepted || r != c.rejected {\n\t\t\tt.Fatal(c, a, r)\n\t\t}\n\t}\n}\nfunc TestSolution(t *testing.T) {\n\tif got := solve(); got != \"2 3\" {\n\t\tt.Fatal(got)\n\t}\n}\nfunc BenchmarkSolution(b *testing.B) {\n\tfor i := 0; i < b.N; i++ {\n\t\t_ = solve()\n\t}\n}\n"
  },
  "158": {
    "starter": "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\t\"sync\"\n)\n\nfunc stopWorkers(count int) int {\n\tif count <= 0 {\n\t\treturn 0\n\t}\n\tctx, cancel := context.WithCancel(context.Background())\n\tvar wg sync.WaitGroup\n\tdone := make(chan struct{}, count)\n\tfinish := make(chan struct{})\n\tfor i := 0; i < count; i++ {\n\t\twg.Add(1)\n\t\tgo func() {\n\t\t\tdefer wg.Done()\n\t\t\t<-ctx.Done()\n\t\t\t<-finish\n\t\t\tdone <- struct{}{}\n\t\t}()\n\t}\n\tcancel()\n\tobserved := len(done)\n\tclose(finish)\n\twg.Wait()\n\treturn observed\n}\nfunc solve() string { return fmt.Sprint(stopWorkers(3)) }\nfunc main()         { fmt.Println(solve()) }\n",
    "solution": "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\t\"sync\"\n)\n\nfunc stopWorkers(count int) int {\n\tif count <= 0 {\n\t\treturn 0\n\t}\n\tctx, cancel := context.WithCancel(context.Background())\n\tvar wg sync.WaitGroup\n\tdone := make(chan struct{}, count)\n\tfinish := make(chan struct{})\n\tfor i := 0; i < count; i++ {\n\t\twg.Add(1)\n\t\tgo func() {\n\t\t\tdefer wg.Done()\n\t\t\t<-ctx.Done()\n\t\t\t<-finish\n\t\t\tdone <- struct{}{}\n\t\t}()\n\t}\n\tcancel()\n\tclose(finish)\n\twg.Wait()\n\treturn len(done)\n}\nfunc solve() string { return fmt.Sprint(stopWorkers(3)) }\nfunc main()         { fmt.Println(solve()) }\n",
    "starterOutput": "0",
    "expectedOutput": "3",
    "testCode": "package main\n\nimport \"testing\"\n\nfunc TestBehavior(t *testing.T) {\n\tfor _, n := range []int{0, 1, 4, 9} {\n\t\tif got := stopWorkers(n); got != n {\n\t\t\tt.Fatalf(\"returned before workers exited: count=%d observed=%d\", n, got)\n\t\t}\n\t}\n}\nfunc TestSolution(t *testing.T) {\n\tif got := solve(); got != \"3\" {\n\t\tt.Fatal(got)\n\t}\n}\nfunc BenchmarkSolution(b *testing.B) {\n\tfor i := 0; i < b.N; i++ {\n\t\t_ = solve()\n\t}\n}\n"
  }
};
const seeds:Seed[]=[
  {
    "id": 151,
    "title": "请求只剩 150ms，下游还能各给 1 秒超时吗？",
    "scene": "网关给聚合请求 200ms，总请求已用 50ms；服务仍给串行的库存和价格调用各 1 秒超时，客户端离开后工作继续。",
    "constraints": [
      "剩余 150ms，返回处理预留 20ms",
      "下游预算不能超过父 deadline"
    ],
    "options": [
      [
        "传播 deadline 并分预算",
        "无用工作有界",
        "预算不足可能提前失败",
        "有整体时延目标"
      ],
      [
        "每层固定大超时",
        "单调用配置简单",
        "超出上游预算浪费资源",
        "独立后台作业需另设生命周期"
      ]
    ],
    "answer": "传播父 context，按剩余预算扣回包余量；串行步骤共享剩余时间，取消向下传递。",
    "failure": "设置局部超时却用 Background 丢失父取消，或把剩余预算重复给多个串行阶段。",
    "steps": [
      "父 deadline 限制整个调用树。",
      "串行预算相加，平行扇出也受同一父期限。",
      "context 取消是协作信号，下游 I/O 必须真正接收它。"
    ],
    "limit": "代码只做毫秒预算分配；真实 deadline 要使用单调时间与 context，不能只靠整数模型。",
    "revisit": "下游顺序、P99 或回包开销变化。",
    "rule": "超时看总账，子任务拿余粮；传了 context 还要有人听。",
    "flow": "flowchart LR\n A[\"总预算 200ms\"] --> B[\"已用 50ms\"]\n B --> C[\"返回预留 20ms\"]\n C --> D[\"下游合计最多 130ms\"]",
    "labels": [
      "每步一秒",
      "按剩余预算"
    ],
    "frames": [
      [
        "总预算=200ms",
        "已用=50ms",
        "子调用预算=1000ms"
      ],
      [
        "客户端=离开",
        "下游=仍运行",
        "浪费=850ms"
      ],
      [
        "剩余=150ms",
        "预留=20ms",
        "步骤数=2"
      ],
      [
        "每步预算=65ms",
        "下游合计=130ms",
        "回包预算=20ms"
      ]
    ],
    "quiz": [
      [
        "剩余 150ms 再给每步一秒会怎样？",
        "工作可能超过用户等待期限",
        "自动合并为 150ms",
        "若丢父 context 就无总约束。"
      ],
      [
        "可分给下游的总额是多少？",
        "130ms",
        "150ms",
        "需先扣 20ms 返回开销。"
      ],
      [
        "传 context 就保证代码会停吗？",
        "不保证，执行需响应取消",
        "保证强制杀 goroutine",
        "取消是协作信号。"
      ],
      [
        "怎样修复串行重复预算？",
        "每步使用当前剩余 deadline",
        "每步从初始 200ms 重算",
        "已耗时间不能重复使用。"
      ],
      [
        "改成独立离线任务无请求 deadline 呢？",
        "建立自己的任务期限和取消责任",
        "无限期 Background 即可",
        "后台任务仍需生命周期。"
      ],
      [
        "父取消但 HTTP 下游未绑定 context，如何修复？",
        "将 context 绑定请求或调用",
        "只记录父超时日志",
        "日志不能停止 I/O。"
      ]
    ],
    "sources": [
      [
        "Go context",
        "https://pkg.go.dev/context"
      ],
      [
        "Go database cancellation",
        "https://go.dev/doc/database/cancel-operations"
      ]
    ]
  },
  {
    "id": 152,
    "title": "支付请求超时后，什么时候可以自动重试？",
    "scene": "支付服务已扣款但响应丢失，调用方仅看到超时；若换新请求 ID 重试会重复扣款。",
    "constraints": [
      "超时结果不确定",
      "支付支持稳定幂等键和结果查询"
    ],
    "options": [
      [
        "稳定幂等键的有界重试",
        "可恢复响应丢失",
        "需要服务端去重期限和查询",
        "副作用有幂等协议"
      ],
      [
        "超时后查询并人工核对",
        "避免盲目重复",
        "恢复速度慢或交互复杂",
        "没有可靠幂等协议"
      ]
    ],
    "answer": "仅在操作安全或具有稳定幂等保障、错误可重试且预算充足时重试；未知副作用先查询。",
    "failure": "把超时当作“服务端没执行”，或者每次重试重新生成幂等键。",
    "steps": [
      "网络失败不等于业务失败。",
      "验证幂等键范围、请求内容一致性和保留期。",
      "重试要受总 deadline、次数与退避预算限制。"
    ],
    "limit": "本地重试判据不能创造服务端幂等；代码不连接支付服务。",
    "revisit": "幂等保留期、错误契约或业务副作用变化。",
    "rule": "先问会不会重做，再问要不要重试；超时只是未知。",
    "flow": "flowchart TD\n A[\"调用超时\"] --> B[\"副作用是否安全或幂等\"]\n B --> C[\"有预算则重试同键\"]\n B --> D[\"不确定则查询核对\"]",
    "labels": [
      "超时换新键",
      "复用稳定键"
    ],
    "frames": [
      [
        "请求键=p1",
        "扣款=成功",
        "响应=丢失"
      ],
      [
        "重试键=p2",
        "扣款次数=2",
        "用户=重复付费"
      ],
      [
        "请求键=p1",
        "扣款=成功",
        "响应=丢失"
      ],
      [
        "重试键=p1",
        "扣款次数=1",
        "结果=原支付"
      ]
    ],
    "quiz": [
      [
        "超时是否说明没扣款？",
        "不说明",
        "说明",
        "服务端可能已执行但回复丢失。"
      ],
      [
        "幂等键在重试时怎么用？",
        "保持原键与原业务内容",
        "每次生成新键",
        "稳定身份才能识别重复。"
      ],
      [
        "客户端判断可重试足够吗？",
        "不够，需要服务端协议",
        "足够",
        "客户端无法独自消除远端副作用。"
      ],
      [
        "无幂等支付遇未知结果怎么修复？",
        "查询交易或进入核对流程",
        "立即新键无限重试",
        "应先厘清事实。"
      ],
      [
        "改为无副作用 GET 且有预算呢？",
        "可对明确暂错有界重试",
        "任何请求都不能重试",
        "副作用条件已变。"
      ],
      [
        "幂等键只保留 1 小时，隔天重试安全吗？",
        "不能按原保证假定安全",
        "永远安全",
        "保留窗口决定去重保障。"
      ]
    ],
    "sources": [
      [
        "AWS Builders Library retries",
        "https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/"
      ]
    ]
  },
  {
    "id": 153,
    "title": "三层各重试三次，数据库会收到多少请求？",
    "scene": "网关、订单服务、仓储客户端各最多尝试 3 次。在底层持续失败时，一个用户请求可能触发 27 次数据库尝试。",
    "constraints": [
      "重试次数包含初次调用",
      "总 deadline 与恢复流量需统一预算"
    ],
    "options": [
      [
        "单层拥有重试预算",
        "控制放大倍数",
        "需要跨层契约",
        "完整调用链可协调"
      ],
      [
        "每层自行重试",
        "局部封装方便",
        "乘法放大与超时叠加",
        "仅明确没有上层重试时"
      ]
    ],
    "answer": "指定一个合适层负责重试，传播尝试信息与截止时间，配退避抖动和恢复配额。",
    "failure": "把各层三次相加为九次，忽略每次上层尝试都会重复整条下层链。",
    "steps": [
      "嵌套尝试数相乘，3×3×3=27。",
      "重试只在可恢复条件和预算内执行。",
      "退避减少同步冲击但不替代次数限制。"
    ],
    "limit": "27 是完全失败路径的上界模型，不是每次请求必然数量。",
    "revisit": "新增代理层、SDK 默认重试或调用链变化。",
    "rule": "重试按层相乘，预算只能有主；抖动不代替上限。",
    "flow": "flowchart LR\n A[\"网关 3 次\"] --> B[\"服务每次 3 次\"]\n B --> C[\"客户端每次 3 次\"]\n C --> D[\"底层最多 27 次\"]",
    "labels": [
      "三层重试",
      "单层预算"
    ],
    "frames": [
      [
        "网关尝试=3",
        "服务尝试=3",
        "客户端尝试=3",
        "数据库尝试=0"
      ],
      [
        "网关尝试=3",
        "服务尝试=3",
        "客户端尝试=3",
        "数据库尝试=27"
      ],
      [
        "重试所有者=服务层",
        "网关尝试=1",
        "服务尝试=3",
        "客户端尝试=1"
      ],
      [
        "数据库尝试=3",
        "总期限=统一"
      ]
    ],
    "quiz": [
      [
        "三层各最多尝试三次，最坏多少？",
        "27",
        "9",
        "尝试数相乘。"
      ],
      [
        "为什么 SDK 默认重试也需检查？",
        "隐藏层同样放大调用",
        "SDK 重试不占资源",
        "每次下游访问都消耗容量。"
      ],
      [
        "抖动能取代总次数上限吗？",
        "不能",
        "能",
        "分散时间并不限制总工作量。"
      ],
      [
        "怎样修正叠加重试？",
        "明确重试所有者与统一 deadline",
        "每层都加更长超时",
        "后者扩大占用。"
      ],
      [
        "只保留底层 2 次，其余一遍，最坏多少？",
        "2",
        "6",
        "当前乘积是 1×1×2。"
      ],
      [
        "上游超时后底层继续重试，缺少什么？",
        "取消传播与剩余预算",
        "更多日志级别",
        "上游已不需要结果。"
      ]
    ],
    "sources": [
      [
        "AWS retries and jitter",
        "https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/"
      ]
    ],
    "links": [
      [
        [
          0,
          1,
          "每次触发"
        ],
        [
          1,
          2,
          "每次触发"
        ],
        [
          2,
          3,
          "放大"
        ]
      ],
      [
        [
          0,
          1,
          "嵌套"
        ],
        [
          1,
          2,
          "嵌套"
        ],
        [
          2,
          3,
          "最多 27"
        ]
      ],
      [
        [
          1,
          0,
          "传 deadline"
        ],
        [
          0,
          2,
          "预算"
        ],
        [
          2,
          3,
          "单次下游"
        ]
      ],
      [
        [
          1,
          0,
          "限制"
        ]
      ]
    ],
    "kind": "bars"
  },
  {
    "id": 154,
    "title": "容量只有 100 并发，过载请求应该排多久？",
    "scene": "图像处理服务只有 100 个工作槽，突发 10000 请求。无界队列让请求排队数分钟，客户端已超时但内存仍增长。",
    "constraints": [
      "有请求 deadline",
      "队列和执行并发都必须有界"
    ],
    "options": [
      [
        "有界队列与准入拒绝",
        "保护已接受请求",
        "过载时部分用户收到失败",
        "可重试交互服务"
      ],
      [
        "长队列吞下全部请求",
        "短期少拒绝",
        "长尾、超时后无用工作与内存风险",
        "离线任务有持久队列与明确等待承诺"
      ]
    ],
    "answer": "在入口按容量和 deadline 准入，队列满时快速拒绝；不要靠无限 goroutine 隐藏排队。",
    "failure": "限流只限制每秒请求却不限制并发，慢请求仍可占满资源。",
    "steps": [
      "到达速率、执行并发和排队长度是不同约束。",
      "等待时间不得超过用户有效预算。",
      "拒绝需要可观测指标和合理客户端退避。"
    ],
    "limit": "标准库 channel 演示瞬时队列容量，不模拟生产速率限流器或公平性。",
    "revisit": "单任务时间变化或可改为异步持久任务。",
    "rule": "接单先看槽位；队列能蓄水，也会淹没期限。",
    "flow": "flowchart LR\n A[\"请求到达\"] --> B[\"准入门\"]\n B --> C[\"有界队列\"]\n C --> D[\"固定 worker\"]\n B --> E[\"过载快速拒绝\"]",
    "labels": [
      "接收全部",
      "容量两项"
    ],
    "frames": [
      [
        "请求=5",
        "队列上限=无限",
        "worker=0"
      ],
      [
        "队列长度=5",
        "等待=增长",
        "拒绝=0"
      ],
      [
        "请求=5",
        "队列容量=2",
        "worker=0"
      ],
      [
        "队列长度=2",
        "拒绝=3",
        "内存=有界"
      ]
    ],
    "quiz": [
      [
        "无界队列主要代价？",
        "延迟和内存积压",
        "免费保存吞吐",
        "处理容量不会因队列变大而增长。"
      ],
      [
        "并发限制与 QPS 限制相同吗？",
        "不同",
        "相同",
        "时长变化会改变在途数量。"
      ],
      [
        "channel 模型证明租户公平吗？",
        "不能",
        "能",
        "容量约束不是调度公平性。"
      ],
      [
        "怎样修复过载？",
        "有界队列并在 deadline 内准入",
        "每请求开 goroutine 等待",
        "等待也消耗资源。"
      ],
      [
        "改成允许等一小时的离线导出呢？",
        "持久任务队列并展示状态",
        "仍让 HTTP 连接等一小时",
        "交互协议与等待承诺可改变。"
      ],
      [
        "QPS 不变但处理从 10ms 到 1s，应关注什么？",
        "并发占用和队列",
        "只看请求总数",
        "在途工作量随服务时间上升。"
      ]
    ],
    "sources": [
      [
        "Go pipelines and cancellation",
        "https://go.dev/blog/pipelines"
      ],
      [
        "Go channels",
        "https://go.dev/ref/spec#Channel_types"
      ]
    ]
  },
  {
    "id": 155,
    "title": "熔断什么时候有用，什么时候会误伤恢复？",
    "scene": "推荐依赖连续超时，占住大量上游连接。熔断后请求快速降级，但所有实例同时半开探测又把刚恢复的依赖打垮。",
    "constraints": [
      "推荐可降级",
      "需要区分依赖故障与业务正常拒绝"
    ],
    "options": [
      [
        "熔断加受控半开探测",
        "减少持续故障占用",
        "状态和阈值误判成本",
        "持续依赖故障"
      ],
      [
        "只用超时和并发隔离",
        "控制占用且状态较少",
        "每次仍会尝试故障依赖",
        "短暂低频故障"
      ]
    ],
    "answer": "先有超时与隔离，再按实际故障收益加熔断；半开限制探测并发并打散时间。",
    "failure": "把业务 404/库存不足算基础设施失败，或半开时同时释放全部流量。",
    "steps": [
      "统计与依赖健康有关的失败。",
      "熔断期间提供明确降级结果。",
      "半开少量探测，失败退回打开状态。"
    ],
    "limit": "熔断不替代超时、并发上限和正确的错误分类。",
    "revisit": "误熔断率或恢复振荡升高。",
    "rule": "断路保护占用，试水只开小口；业务拒绝不是机器病。",
    "flow": "flowchart LR\n A[\"关闭正常调用\"] --> B[\"失败达阈值打开\"]\n B --> C[\"半开少量探测\"]\n C --> A\n C --> B",
    "labels": [
      "恢复全放行",
      "半开小流量"
    ],
    "frames": [
      [
        "熔断器=打开",
        "恢复依赖=容量20",
        "全部请求=1000"
      ],
      [
        "熔断器=半开",
        "恢复依赖=再次过载",
        "全部请求=1000"
      ],
      [
        "熔断器=半开",
        "恢复依赖=容量20",
        "探测=2",
        "普通请求=降级"
      ],
      [
        "熔断器=关闭",
        "恢复依赖=健康",
        "请求=渐增"
      ]
    ],
    "quiz": [
      [
        "半开时全放行会怎样？",
        "再次压垮恢复依赖",
        "必然立刻恢复",
        "冷恢复容量有限。"
      ],
      [
        "哪些失败适合作熔断证据？",
        "依赖超时和基础设施故障",
        "所有业务拒绝",
        "业务拒绝不代表服务病态。"
      ],
      [
        "有熔断可删超时吗？",
        "不可以",
        "可以",
        "未熔断时调用仍需有界。"
      ],
      [
        "怎样修复恢复震荡？",
        "限制探测并发并打散时间",
        "所有实例同步重置",
        "同步会形成尖峰。"
      ],
      [
        "依赖很便宜且低频偶发失败呢？",
        "可能超时与隔离已足够",
        "必须复杂熔断状态机",
        "收益需大于复杂度。"
      ],
      [
        "404 激增但依赖正常，熔断打开说明什么？",
        "错误分类或阈值不合适",
        "必须进一步减少所有流量",
        "业务信号不等于基础设施故障。"
      ]
    ],
    "sources": [
      [
        "Microsoft circuit breaker pattern",
        "https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker"
      ]
    ],
    "links": [
      [],
      [
        [
          2,
          1,
          "全量释放"
        ]
      ],
      [
        [
          2,
          1,
          "少量探测"
        ],
        [
          0,
          3,
          "拒绝常规"
        ]
      ],
      [
        [
          2,
          1,
          "恢复调用"
        ]
      ]
    ],
    "kind": "graph"
  },
  {
    "id": 156,
    "title": "慢报表怎样才能不拖垮订单接口？",
    "scene": "报表与下单共用 50 个数据库连接。报表高峰占满连接，即使订单查询很快也必须排队。",
    "constraints": [
      "订单优先且 SLO 严格",
      "数据库总连接预算固定"
    ],
    "options": [
      [
        "独立并发和连接预算",
        "报表不能耗尽订单份额",
        "空闲份额可能利用不足",
        "关键路径需保护"
      ],
      [
        "完全共享池",
        "资源利用率高",
        "噪声业务可占尽资源",
        "业务优先级相同且负载稳定"
      ]
    ],
    "answer": "为报表设置低并发及明确预算，保留订单资源；必要时读副本或异步报表。",
    "failure": "只拆 HTTP 路由或 goroutine 却仍共享下游池，故障域没有真正隔离。",
    "steps": [
      "找出 CPU、连接池、线程、队列等共享瓶颈。",
      "隔离预算总和仍受数据库总容量约束。",
      "监测被保护路径和被限制路径各自的队列。"
    ],
    "limit": "分池只隔离连接份额，数据库 CPU、锁和 I/O 仍可能共享。",
    "revisit": "隔离后数据库层仍争抢，考虑工作负载分离。",
    "rule": "隔离要隔到瓶颈；分路由不等于分资源。",
    "flow": "flowchart LR\n A[\"订单入口\"] --> B[\"订单配额 40\"]\n C[\"报表入口\"] --> D[\"报表配额 10\"]\n B --> E[\"数据库总预算 50\"]\n D --> E",
    "labels": [
      "共享无配额",
      "保留订单份额"
    ],
    "frames": [
      [
        "订单=待连接",
        "报表=50连接",
        "共享池=50连接"
      ],
      [
        "订单=无连接可用",
        "报表=持续运行",
        "共享池=已满"
      ],
      [
        "订单=40配额",
        "报表=10配额",
        "数据库=50总预算"
      ],
      [
        "订单=继续服务",
        "报表=有界等待",
        "数据库=总预算保持"
      ]
    ],
    "quiz": [
      [
        "报表慢为何订单也慢？",
        "共享池被占尽",
        "订单 SQL 一定坏了",
        "竞争发生在拿连接之前。"
      ],
      [
        "只拆路由能隔离吗？",
        "不能，需隔离实际瓶颈",
        "能，URL 不同",
        "共享下游仍会竞争。"
      ],
      [
        "分两个连接池能隔离数据库 CPU 吗？",
        "不能",
        "能",
        "底层计算和 I/O 仍共享。"
      ],
      [
        "如何保护订单？",
        "报表限并发并保留订单预算",
        "每个服务都加 50 连接",
        "总预算会超额。"
      ],
      [
        "报表允许小时级延迟时？",
        "异步低峰或读副本",
        "继续同步抢主库",
        "业务等待约束允许隔离更彻底。"
      ],
      [
        "分池后仍因大查询拖慢，应看什么？",
        "数据库 CPU、锁和 I/O",
        "只增加应用 goroutine",
        "隔离要继续追踪共享瓶颈。"
      ]
    ],
    "sources": [
      [
        "Microsoft bulkhead pattern",
        "https://learn.microsoft.com/en-us/azure/architecture/patterns/bulkhead"
      ],
      [
        "Go connection management",
        "https://go.dev/doc/database/manage-connections"
      ]
    ],
    "links": [
      [
        [
          0,
          2,
          "竞争"
        ],
        [
          1,
          2,
          "占用"
        ]
      ],
      [
        [
          1,
          2,
          "占满"
        ]
      ],
      [
        [
          0,
          2,
          "独立40"
        ],
        [
          1,
          2,
          "独立10"
        ]
      ],
      [
        [
          0,
          2,
          "关键路径"
        ],
        [
          1,
          2,
          "受限路径"
        ]
      ]
    ],
    "kind": "graph"
  },
  {
    "id": 157,
    "title": "推荐失败能降级，支付失败为什么不能假成功？",
    "scene": "商品页推荐服务超时可展示热门列表；支付超时如果也返回成功页，用户误认为付款完成，商家也可能误发货。",
    "constraints": [
      "不同业务结果有不同正确性要求",
      "必须区分陈旧、缺省和未知状态"
    ],
    "options": [
      [
        "按业务设计降级契约",
        "核心正确性保留",
        "产品与接口多状态成本",
        "业务优先级明确"
      ],
      [
        "统一返回默认成功",
        "页面看似稳定",
        "掩盖未知副作用和错误事实",
        "不适合关键业务"
      ]
    ],
    "answer": "推荐可缺省或陈旧显示；支付未知状态展示处理中并核对，不伪造成功。",
    "failure": "可用性指标只算 HTTP 200，使错误业务结果被当成成功。",
    "steps": [
      "定义核心与可选能力。",
      "降级结果在数据契约或界面可识别。",
      "监测降级率和真实业务完成率。"
    ],
    "limit": "降级必须经过业务确认，不能用通用异常捕获偷偷改变财务语义。",
    "revisit": "默认推荐转化损失或支付未知积压过高。",
    "rule": "可选内容能省，关键事实别编；200 不等于业务成功。",
    "flow": "flowchart TD\n A[\"依赖失败\"] --> B[\"推荐可选\"]\n B --> C[\"热门列表或隐藏\"]\n A --> D[\"支付状态未知\"]\n D --> E[\"处理中与核对\"]",
    "labels": [
      "统一默认成功",
      "按业务分支"
    ],
    "frames": [
      [
        "推荐=失败",
        "支付=超时未知",
        "统一成功响应=200"
      ],
      [
        "用户=相信付款成功",
        "履约=误发货风险"
      ],
      [
        "推荐=失败",
        "支付=未知",
        "热门列表=降级",
        "核对流程=处理中"
      ],
      [
        "页面=展示热门",
        "订单=等待核对",
        "核对流程=继续"
      ]
    ],
    "quiz": [
      [
        "支付超时返回成功的问题？",
        "伪造未知业务事实",
        "只是样式不准确",
        "可能产生资金和履约错误。"
      ],
      [
        "降级应该依据什么？",
        "能力重要性与数据语义",
        "统一 catch 默认值",
        "不同业务允许的损失不同。"
      ],
      [
        "200 比例能代表支付成功率吗？",
        "不能",
        "能",
        "协议成功不等于业务成功。"
      ],
      [
        "如何修复支付默认成功？",
        "处理中状态和结果核对",
        "增加成功提示文案",
        "要修语义而非包装。"
      ],
      [
        "可选头像服务失败呢？",
        "可以返回明确默认头像",
        "必须阻止整个支付",
        "可选能力可安全缺省。"
      ],
      [
        "降级持续一周仍 100% 成功率，缺什么？",
        "降级率与业务效果监测",
        "更多隐藏异常",
        "降级不是永久无成本。"
      ]
    ],
    "sources": [
      [
        "Google SRE handling overload",
        "https://sre.google/sre-book/handling-overload/"
      ]
    ],
    "links": [
      [
        [
          0,
          2,
          "默认成功"
        ],
        [
          1,
          2,
          "默认成功"
        ]
      ],
      [
        [
          0,
          1,
          "错误事实"
        ]
      ],
      [
        [
          0,
          2,
          "可选能力降级"
        ],
        [
          1,
          3,
          "保留未知"
        ]
      ],
      [
        [
          2,
          1,
          "查询交易"
        ]
      ]
    ],
    "kind": "graph"
  },
  {
    "id": 158,
    "title": "服务退出时怎样避免请求没处理完就杀进程？",
    "scene": "Go 服务滚动更新，收到退出信号立即 os.Exit。正在提交的请求被中断，后台投递器也来不及完成状态落盘。",
    "constraints": [
      "退出有总时限",
      "停止接新请求、等待在途、取消后台并回收"
    ],
    "options": [
      [
        "分阶段协调退出",
        "减少丢请求和泄漏",
        "需明确所有者与期限",
        "滚动部署"
      ],
      [
        "立即退出",
        "停机速度快",
        "在途和后台任务中断",
        "进程不可信或超出退出硬期限"
      ]
    ],
    "answer": "先撤就绪并停止接收，Shutdown 等待在途；在总期限内取消并等待后台任务，最后释放资源。",
    "failure": "先关数据库再等 HTTP 请求，或只 cancel 不等待 goroutine 退出。",
    "steps": [
      "每个后台 goroutine 有明确取消与等待责任。",
      "http.Server.Shutdown 不等待所有自建后台任务。",
      "总退出期限到达需明确硬退出和未完成恢复语义。"
    ],
    "limit": "代码只验证 context 取消后等待 worker，完整系统还需 HTTP、数据库和部署流量演练。",
    "revisit": "新增后台 worker、长连接或退出期限变化。",
    "rule": "先停接单，再等在途；取消是通知，等待才是回收。",
    "flow": "flowchart LR\n A[\"撤就绪\"] --> B[\"停止接收\"]\n B --> C[\"等待在途\"]\n C --> D[\"取消并等待后台\"]\n D --> E[\"释放资源退出\"]",
    "labels": [
      "只取消不等",
      "取消后等待"
    ],
    "frames": [
      [
        "HTTP在途=3",
        "后台worker=1",
        "数据库=打开"
      ],
      [
        "进程=退出",
        "在途=中断",
        "worker=未确认结束"
      ],
      [
        "停止接收=完成",
        "在途=完成",
        "取消=发出"
      ],
      [
        "worker=已退出",
        "等待=完成",
        "资源=关闭"
      ]
    ],
    "quiz": [
      [
        "先关闭数据库再等请求有什么风险？",
        "在途请求使用已关闭资源",
        "自动重连总能解决",
        "释放顺序应尊重依赖。"
      ],
      [
        "cancel 是否等于 worker 已退出？",
        "不是",
        "是",
        "取消只是信号。"
      ],
      [
        "Shutdown 会等待所有自建后台任务吗？",
        "不会",
        "会",
        "后台生命周期由应用管理。"
      ],
      [
        "如何修复 goroutine 未回收？",
        "cancel 后用 WaitGroup 等等待",
        "多 sleep 固定 100ms",
        "时间延迟不是完成证明。"
      ],
      [
        "改成长连接 WebSocket 服务还需什么？",
        "显式通知和回收升级连接",
        "只依赖 HTTP Shutdown",
        "升级连接需要独立管理。"
      ],
      [
        "总退出期限已耗尽，如何处理？",
        "按恢复设计硬退出并记录未完成",
        "无期限继续等待",
        "部署有硬期限且任务需可恢复。"
      ]
    ],
    "sources": [
      [
        "Go HTTP Shutdown",
        "https://pkg.go.dev/net/http#Server.Shutdown"
      ],
      [
        "Go context",
        "https://pkg.go.dev/context"
      ]
    ]
  },
  {
    "id": 159,
    "title": "数据库短断时 liveness 应该一起变红吗？",
    "scene": "Kubernetes 服务把数据库 Ping 用作存活探针。数据库短暂失效导致所有 Go 实例重启，恢复时又同时建连接。",
    "constraints": [
      "存活描述进程是否需要重启",
      "就绪描述能否承接流量"
    ],
    "options": [
      [
        "分离存活与就绪",
        "避免依赖故障重启风暴",
        "探针语义需设计",
        "容器部署"
      ],
      [
        "所有探针测完整依赖",
        "实现统一",
        "把外部故障误判进程故障",
        "只有确能靠重启修复的依赖问题"
      ]
    ],
    "answer": "liveness 聚焦进程不可恢复故障，readiness 依据接流量能力；启动慢用 startup probe 保护。",
    "failure": "依赖不可用就杀进程，重启无法修复数据库却放大恢复压力。",
    "steps": [
      "探针失败动作不同，不能复用一个结论。",
      "readiness 不应昂贵或高频打下游。",
      "考虑部分功能可服务与全量撤流的业务影响。"
    ],
    "limit": "就绪是否检查依赖取决于降级能力，不是一律把所有下游纳入。",
    "revisit": "服务增加本地降级能力或启动时间变长。",
    "rule": "活着问要不要重启，就绪问能不能接单。",
    "flow": "flowchart LR\n A[\"进程健康\"] --> B[\"liveness\"]\n C[\"接流量能力\"] --> D[\"readiness\"]\n E[\"启动未完成\"] --> F[\"startup probe\"]",
    "labels": [
      "数据库决定存活",
      "分离探针"
    ],
    "frames": [
      [
        "数据库=短断",
        "健康进程=20个",
        "存活探针=依赖失败"
      ],
      [
        "重启实例=20",
        "数据库=新连接风暴"
      ],
      [
        "数据库=短断",
        "健康进程=20个",
        "存活=正常",
        "就绪=按服务能力判断"
      ],
      [
        "数据库=恢复",
        "存活=正常",
        "就绪=可接请求"
      ]
    ],
    "quiz": [
      [
        "依赖短断触发全重启的风险？",
        "形成重启与连接风暴",
        "一定快速修复数据库",
        "进程重启不解决外部故障。"
      ],
      [
        "liveness 回答什么？",
        "是否需要重启进程",
        "每个依赖是否可用",
        "探针动作决定语义。"
      ],
      [
        "readiness 必须检查全部依赖吗？",
        "不一定，看降级能力",
        "必须",
        "部分服务可能仍可用。"
      ],
      [
        "如何修复慢启动反复被杀？",
        "startup probe 或合理启动宽限",
        "降低存活超时时间",
        "启动与运行期规则不同。"
      ],
      [
        "进程内部死锁且重启可恢复呢？",
        "存活失败可触发重启",
        "只改 readiness 永远等待",
        "故障可恢复方式不同。"
      ],
      [
        "每秒每实例做昂贵数据库探针有什么问题？",
        "探针本身制造负载",
        "探针不占数据库资源",
        "健康检查也是流量。"
      ]
    ],
    "sources": [
      [
        "Kubernetes probes",
        "https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/"
      ]
    ],
    "links": [
      [
        [
          0,
          2,
          "Ping失败"
        ],
        [
          2,
          1,
          "重启"
        ]
      ],
      [
        [
          0,
          1,
          "同时建连接"
        ]
      ],
      [
        [
          1,
          2,
          "进程健康"
        ],
        [
          0,
          3,
          "影响接单能力"
        ]
      ],
      [
        [
          0,
          2,
          "恢复可用"
        ]
      ]
    ],
    "kind": "graph"
  },
  {
    "id": 160,
    "title": "故障恢复后为什么要逐步放量而不是瞬间全开？",
    "scene": "依赖恢复但缓存冷、连接尚未建立。负载均衡立即送回全部 5 万 QPS，新实例又超时被剔除，形成反复震荡。",
    "constraints": [
      "冷启动容量低于稳态",
      "预热与线上流量共享资源"
    ],
    "options": [
      [
        "渐进放量与受控预热",
        "减少恢复尖峰",
        "恢复到满量较慢",
        "冷缓存与连接准备明显"
      ],
      [
        "立即全量",
        "理论恢复快",
        "易再过载和振荡",
        "已证明冷态也有完整容量"
      ]
    ],
    "answer": "按成功率、排队和延迟逐步提高权重，预热限速；失败回退到上一个健康流量级。",
    "failure": "把进程启动成功当成已经具备满流量容量。",
    "steps": [
      "就绪状态可用不等于稳态容量。",
      "预热预算不能挤占关键在线请求。",
      "回升曲线必须有观测与回退门槛。"
    ],
    "limit": "固定睡眠不是容量证据，仍需冷态压测和恢复演练。",
    "revisit": "缓存规模、依赖握手成本或启动资源变化。",
    "rule": "恢复先试水，再加流；能接单不等于能满载。",
    "flow": "flowchart LR\n A[\"依赖恢复\"] --> B[\"低权重探测\"]\n B --> C[\"健康则逐级加量\"]\n C --> D[\"达到稳态\"]\n C --> E[\"恶化则回退\"]",
    "labels": [
      "瞬间全开",
      "渐进恢复"
    ],
    "frames": [
      [
        "冷实例=容量5000",
        "流量入口=50000",
        "缓存=空"
      ],
      [
        "冷实例=过载剔除",
        "流量入口=全量重试"
      ],
      [
        "冷实例=容量5000",
        "探测流量=2000",
        "预热=限速"
      ],
      [
        "健康观测=达标",
        "流量=逐级增加",
        "冷实例=逐渐变热"
      ]
    ],
    "quiz": [
      [
        "冷态直接全量为什么危险？",
        "实际容量低于稳态",
        "所有缓存会瞬间填满",
        "初始化工作也消耗容量。"
      ],
      [
        "放量依据应是什么？",
        "延迟、错误、排队等健康证据",
        "只看已启动几秒",
        "时间不是容量证明。"
      ],
      [
        "预热能无限并发吗？",
        "不能",
        "能",
        "会和真实请求抢资源。"
      ],
      [
        "如何修复恢复振荡？",
        "低权重逐级放量并可回退",
        "更快剔除再全量加入",
        "同步满量会重复故障。"
      ],
      [
        "冷态压测已证明满负载且无预热需求呢？",
        "可采用更快放量",
        "仍必须等待固定一小时",
        "证据改变恢复策略。"
      ],
      [
        "放量一级后 P99 明显恶化怎么办？",
        "暂停或回退并诊断",
        "继续加量追求恢复率",
        "超过门槛不能视为健康。"
      ]
    ],
    "sources": [
      [
        "Google SRE overload",
        "https://sre.google/sre-book/handling-overload/"
      ]
    ],
    "links": [
      [
        [
          1,
          0,
          "全量"
        ],
        [
          0,
          2,
          "集中回源"
        ]
      ],
      [
        [
          1,
          0,
          "再次冲击"
        ]
      ],
      [
        [
          1,
          0,
          "低权重"
        ],
        [
          2,
          0,
          "预算内预热"
        ]
      ],
      [
        [
          0,
          1,
          "放量门控"
        ],
        [
          1,
          2,
          "渐进"
        ]
      ]
    ],
    "kind": "graph"
  }
];
export default seeds.map(s=>make({...s,code:codes[s.id]})) satisfies Lesson[];
