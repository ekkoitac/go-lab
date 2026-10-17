import {architectureLesson} from '../architecture-builder';
import {q,frame,experiment} from '../builders';
import type {Lesson} from '../types';
type QA=[string,string,string,string];
type Seed={id:number;title:string;scene:string;constraints:string[];options:[string,string,string,string][];answer:string;failure:string;steps:string[];limit:string;revisit:string;rule:string;flow:string;labels:[string,string];frames:[string[],string[],string[],string[]];quiz:QA[];sources:[string,string][];code?:CodeSpec;links?:[number,number,string][][];kind?:'bars'|'graph'|'timeline'};
type CodeSpec={starter:string;solution:string;starterOutput:string;expectedOutput:string;testCode:string};
function make(s:Seed){const stages=s.frames.map((values,i)=>{const f=frame(i%2?'观察结果':'进入场景',i%2?s.answer:s.labels[Math.floor(i/2)],values,i%2?Math.min(1,values.length-1):0);f.edges=(s.links?.[i]??[]).map(([a,b,label])=>({from:`n${a}`,to:`n${b}`,label}));return f;});return architectureLesson({id:s.id,title:s.title,scenario:s.scene,constraints:s.constraints,options:s.options.map(([title,benefits,costs,when])=>({title,benefits,costs,when})),recommendation:s.answer,pitfall:s.failure,mechanism:s.steps,boundary:s.limit,revisitWhen:[s.revisit],mnemonic:s.rule,sources:s.sources.map(([title,url])=>({title,url})),diagram:[{title:s.title,kind:'flow',source:s.flow,caption:s.steps.join('；')}],experiment:experiment(s.kind??'bars','资源与状态实验','逐步观察状态变化，再切换条件。数值为确定性教学模型，不代表真实系统压测。',[stages[0],stages[1]],[stages[2],stages[3]],s.labels),quizzes:s.quiz.map(x=>q(...x)),code:s.code});}

const codes:Record<number,CodeSpec>={
  "164": {
    "starter": "package main\n\nimport (\n\t\"fmt\"\n)\n\nfunc memoryBudget(hard, external, burst int) int { return hard }\nfunc solve() string                              { return fmt.Sprint(memoryBudget(1024, 180, 100)) }\nfunc main()                                      { fmt.Println(solve()) }\n",
    "solution": "package main\n\nimport (\n\t\"fmt\"\n)\n\nfunc memoryBudget(hard, external, burst int) int {\n\tn := hard - external - burst\n\tif n < 0 {\n\t\treturn 0\n\t}\n\treturn n\n}\nfunc solve() string { return fmt.Sprint(memoryBudget(1024, 180, 100)) }\nfunc main()         { fmt.Println(solve()) }\n",
    "starterOutput": "1024",
    "expectedOutput": "744",
    "testCode": "package main\n\nimport \"testing\"\n\nfunc TestBehavior(t *testing.T) {\n\tfor _, c := range []struct{ hard, external, burst, want int }{{1024, 180, 100, 744}, {100, 120, 0, 0}, {512, 100, 50, 362}, {100, 0, 0, 100}} {\n\t\tif got := memoryBudget(c.hard, c.external, c.burst); got != c.want {\n\t\t\tt.Fatal(c, got)\n\t\t}\n\t}\n}\nfunc TestSolution(t *testing.T) {\n\tif got := solve(); got != \"744\" {\n\t\tt.Fatal(got)\n\t}\n}\nfunc BenchmarkSolution(b *testing.B) {\n\tfor i := 0; i < b.N; i++ {\n\t\t_ = solve()\n\t}\n}\n"
  },
  "167": {
    "starter": "package main\n\nimport (\n\t\"bytes\"\n\t\"fmt\"\n)\n\nfunc reuse(old, next string) string {\n\tbuf := bytes.NewBufferString(old)\n\tbuf.WriteString(next)\n\treturn buf.String()\n}\nfunc solve() string { return fmt.Sprint(reuse(\"tenantA\", \"tenantB\")) }\nfunc main()         { fmt.Println(solve()) }\n",
    "solution": "package main\n\nimport (\n\t\"bytes\"\n\t\"fmt\"\n)\n\nfunc reuse(old, next string) string {\n\tbuf := bytes.NewBufferString(old)\n\tbuf.Reset()\n\tbuf.WriteString(next)\n\treturn buf.String()\n}\nfunc solve() string { return fmt.Sprint(reuse(\"tenantA\", \"tenantB\")) }\nfunc main()         { fmt.Println(solve()) }\n",
    "starterOutput": "tenantAtenantB",
    "expectedOutput": "tenantB",
    "testCode": "package main\n\nimport \"testing\"\n\nfunc TestBehavior(t *testing.T) {\n\tfor _, c := range []struct{ old, next string }{{\"secret\", \"public\"}, {\"\", \"next\"}, {\"old\", \"\"}, {\"租户甲\", \"租户乙\"}} {\n\t\tif got := reuse(c.old, c.next); got != c.next {\n\t\t\tt.Fatal(\"stale buffer\", c, got)\n\t\t}\n\t}\n}\nfunc TestSolution(t *testing.T) {\n\tif got := solve(); got != \"tenantB\" {\n\t\tt.Fatal(got)\n\t}\n}\nfunc BenchmarkSolution(b *testing.B) {\n\tfor i := 0; i < b.N; i++ {\n\t\t_ = solve()\n\t}\n}\n"
  },
  "168": {
    "starter": "package main\n\nimport (\n\t\"bytes\"\n\t\"fmt\"\n\t\"io\"\n\t\"strings\"\n)\n\ntype readerOnly struct{ io.Reader }\ntype writerOnly struct{ io.Writer }\ntype measuredWriter struct {\n\tbytes.Buffer\n\tpeak int\n}\n\nfunc (w *measuredWriter) Write(p []byte) (int, error) {\n\tif len(p) > w.peak {\n\t\tw.peak = len(p)\n\t}\n\treturn w.Buffer.Write(p)\n}\n\ntype rejectedWriter struct{}\n\nfunc (rejectedWriter) Write(p []byte) (int, error) { return 0, fmt.Errorf(\"writer failed\") }\nfunc copyTo(dst io.Writer, src io.Reader, chunk int) (int64, error) {\n\tif chunk <= 0 {\n\t\treturn 0, fmt.Errorf(\"invalid chunk\")\n\t}\n\treturn io.CopyBuffer(writerOnly{dst}, readerOnly{src}, make([]byte, chunk))\n}\nfunc writeFailure() error {\n\t_, err := copyTo(rejectedWriter{}, strings.NewReader(\"abc\"), 3)\n\treturn err\n}\nfunc stream(input string, chunk int) (string, int, error) {\n\tif chunk <= 0 {\n\t\treturn \"\", 0, fmt.Errorf(\"invalid chunk\")\n\t}\n\tchunk = len(input)\n\tif chunk == 0 {\n\t\tchunk = 1\n\t}\n\tvar dst measuredWriter\n\t_, err := copyTo(&dst, strings.NewReader(input), chunk)\n\treturn dst.String(), dst.peak, err\n}\nfunc solve() string {\n\ts, n, e := stream(\"abcdefgh\", 3)\n\treturn fmt.Sprintf(\"%s %d %t\", s, n, e == nil)\n}\nfunc main() { fmt.Println(solve()) }\n",
    "solution": "package main\n\nimport (\n\t\"bytes\"\n\t\"fmt\"\n\t\"io\"\n\t\"strings\"\n)\n\ntype readerOnly struct{ io.Reader }\ntype writerOnly struct{ io.Writer }\ntype measuredWriter struct {\n\tbytes.Buffer\n\tpeak int\n}\n\nfunc (w *measuredWriter) Write(p []byte) (int, error) {\n\tif len(p) > w.peak {\n\t\tw.peak = len(p)\n\t}\n\treturn w.Buffer.Write(p)\n}\n\ntype rejectedWriter struct{}\n\nfunc (rejectedWriter) Write(p []byte) (int, error) { return 0, fmt.Errorf(\"writer failed\") }\nfunc copyTo(dst io.Writer, src io.Reader, chunk int) (int64, error) {\n\tif chunk <= 0 {\n\t\treturn 0, fmt.Errorf(\"invalid chunk\")\n\t}\n\treturn io.CopyBuffer(writerOnly{dst}, readerOnly{src}, make([]byte, chunk))\n}\nfunc writeFailure() error {\n\t_, err := copyTo(rejectedWriter{}, strings.NewReader(\"abc\"), 3)\n\treturn err\n}\nfunc stream(input string, chunk int) (string, int, error) {\n\tvar dst measuredWriter\n\t_, err := copyTo(&dst, strings.NewReader(input), chunk)\n\treturn dst.String(), dst.peak, err\n}\nfunc solve() string {\n\ts, n, e := stream(\"abcdefgh\", 3)\n\treturn fmt.Sprintf(\"%s %d %t\", s, n, e == nil)\n}\nfunc main() { fmt.Println(solve()) }\n",
    "starterOutput": "abcdefgh 8 true",
    "expectedOutput": "abcdefgh 3 true",
    "testCode": "package main\n\nimport \"testing\"\n\nfunc TestBehavior(t *testing.T) {\n\tfor _, c := range []struct {\n\t\tinput string\n\t\tchunk int\n\t}{{\"abcdefgh\", 3}, {\"abcdef\", 2}, {\"a\", 4}, {\"\", 3}} {\n\t\ts, n, e := stream(c.input, c.chunk)\n\t\tif e != nil || s != c.input || n > c.chunk {\n\t\t\tt.Fatal(\"unbounded chunk or loss\", c, s, n, e)\n\t\t}\n\t}\n\t_, _, e := stream(\"a\", 0)\n\tif e == nil {\n\t\tt.Fatal(\"invalid buffer\")\n\t}\n\tif writeFailure() == nil {\n\t\tt.Fatal(\"lost writer error\")\n\t}\n}\nfunc TestSolution(t *testing.T) {\n\tif got := solve(); got != \"abcdefgh 3 true\" {\n\t\tt.Fatal(got)\n\t}\n}\nfunc BenchmarkSolution(b *testing.B) {\n\tfor i := 0; i < b.N; i++ {\n\t\t_ = solve()\n\t}\n}\n"
  },
  "169": {
    "starter": "package main\n\nimport (\n\t\"fmt\"\n)\n\nfunc inflight(qps, ms float64) float64 {\n\tif qps < 0 || ms < 0 {\n\t\treturn 0\n\t}\n\treturn qps * ms\n}\nfunc solve() string { return fmt.Sprint(inflight(1000, 50)) }\nfunc main()         { fmt.Println(solve()) }\n",
    "solution": "package main\n\nimport (\n\t\"fmt\"\n)\n\nfunc inflight(qps, ms float64) float64 {\n\tif qps < 0 || ms < 0 {\n\t\treturn 0\n\t}\n\treturn qps * ms / 1000\n}\nfunc solve() string { return fmt.Sprint(inflight(1000, 50)) }\nfunc main()         { fmt.Println(solve()) }\n",
    "starterOutput": "50000",
    "expectedOutput": "50",
    "testCode": "package main\n\nimport \"testing\"\n\nfunc TestBehavior(t *testing.T) {\n\tfor _, c := range []struct{ qps, ms, want float64 }{{1000, 50, 50}, {1000, 200, 200}, {50, 20, 1}, {0, 50, 0}, {100, -1, 0}} {\n\t\tif got := inflight(c.qps, c.ms); got != c.want {\n\t\t\tt.Fatal(c, got)\n\t\t}\n\t}\n}\nfunc TestSolution(t *testing.T) {\n\tif got := solve(); got != \"50\" {\n\t\tt.Fatal(got)\n\t}\n}\nfunc BenchmarkSolution(b *testing.B) {\n\tfor i := 0; i < b.N; i++ {\n\t\t_ = solve()\n\t}\n}\n"
  }
};
const seeds:Seed[]=[
  {
    "id": 161,
    "title": "接口慢先扩容、改算法，还是抓 profile？",
    "scene": "订单接口耗时 800ms，CPU 只有 20%。团队准备重写 JSON 编码，但大部分时间实际等下游连接。",
    "constraints": [
      "必须用证据区分 CPU 与等待",
      "采样和压测不能破坏生产"
    ],
    "options": [
      [
        "分段时延加适当 profile",
        "定位真正瓶颈",
        "采样与分析成本",
        "瓶颈未明"
      ],
      [
        "直接优化热点猜测",
        "能快速试验",
        "可能优化无关部分",
        "已有可靠 profile 指向目标"
      ]
    ],
    "answer": "先看请求分段、资源饱和与负载，再按 CPU、锁、阻塞或 trace 选择诊断。",
    "failure": "CPU profile 看不到大量等待，就推断系统没有瓶颈。",
    "steps": [
      "CPU profile 主要描述执行 CPU 的栈。",
      "阻塞、互斥与 trace 提供等待和调度证据。",
      "优化后用同负载端到端验证。"
    ],
    "limit": "不同 profile 有采样和开销，单张图不是因果证明。",
    "revisit": "优化一处后新的瓶颈成为主导。",
    "rule": "先分忙和等，再选诊断刀；热点不等于最值得优化。",
    "flow": "flowchart TD\n A[\"高延迟\"] --> B[\"CPU 饱和\"]\n B --> C[\"CPU profile\"]\n A --> D[\"等待主导\"]\n D --> E[\"trace 和阻塞分析\"]",
    "labels": [
      "凭猜测改编码",
      "测量等待"
    ],
    "frames": [
      [
        "请求=800ms",
        "CPU利用率=20%",
        "假设=JSON热点"
      ],
      [
        "JSON改写=省5ms",
        "请求=795ms"
      ],
      [
        "请求=800ms",
        "连接等待=700ms",
        "CPU执行=80ms",
        "其他=20ms"
      ],
      [
        "连接等待=资源预算调查",
        "CPU执行=暂不优化",
        "端到端验证=同负载"
      ]
    ],
    "quiz": [
      [
        "CPU 低却慢应先怀疑什么？",
        "等待或外部瓶颈并测量",
        "必然编码太慢",
        "CPU 未忙不等于请求不等待。"
      ],
      [
        "CPU profile 擅长看什么？",
        "CPU 执行栈",
        "全部网络等待",
        "选择匹配问题的工具。"
      ],
      [
        "一次采样能证明因果吗？",
        "不能",
        "能",
        "采样受窗口和负载影响。"
      ],
      [
        "应如何修复盲目优化？",
        "先分段定位，再同负载验证",
        "一次重写多个模块",
        "难以归因也容易错目标。"
      ],
      [
        "CPU 100% 且编码占主要样本时呢？",
        "针对编码热点做基准和验证",
        "继续只加连接池",
        "新证据改变优先级。"
      ],
      [
        "CPU 降 30% 但 P99 不变说明什么？",
        "瓶颈可能在别处，需端到端核对",
        "优化必然失败",
        "资源收益和用户时延是不同指标。"
      ]
    ],
    "sources": [
      [
        "Go diagnostics",
        "https://go.dev/doc/diagnostics"
      ]
    ],
    "links": [
      [
        [
          2,
          0,
          "猜测"
        ]
      ],
      [
        [
          0,
          1,
          "微小收益"
        ]
      ],
      [
        [
          0,
          1,
          "主要贡献"
        ],
        [
          0,
          2,
          "次要贡献"
        ],
        [
          0,
          3,
          "剩余"
        ]
      ],
      [
        [
          0,
          2,
          "优先验证"
        ]
      ]
    ],
    "kind": "graph"
  },
  {
    "id": 162,
    "title": "平均延迟没变，P99 为什么突然恶化？",
    "scene": "100 个请求中 99 个 20ms，1 个排队 2 秒；平均看着可接受，但大客户批量接口经常碰到慢请求。",
    "constraints": [
      "关注用户尾延迟",
      "直方图需跨实例正确聚合"
    ],
    "options": [
      [
        "分位分布与分段关联",
        "发现少量极慢请求",
        "直方图桶和基数成本",
        "尾部决定体验"
      ],
      [
        "仅平均值",
        "简单便宜",
        "掩盖长尾和排队",
        "只适合粗略趋势"
      ]
    ],
    "answer": "看直方图、P95/P99 与排队、GC、锁和下游分段；聚合直方图而非平均各实例 P99。",
    "failure": "把实例 P99 再求平均当全站 P99，或仅调平均响应。",
    "steps": [
      "均值可被大量快请求稀释。",
      "扇出时慢子调用更容易影响整体尾部。",
      "分位变化须关联样本数和负载形态。"
    ],
    "limit": "小样本 P99 不稳定；低频路由需适当窗口和原始事件核对。",
    "revisit": "流量结构、扇出数和用户 SLA 变化。",
    "rule": "平均看趋势，尾部看承诺；分位不能直接平均。",
    "flow": "flowchart LR\n A[\"请求样本\"] --> B[\"统一时延桶\"]\n B --> C[\"聚合直方图\"]\n C --> D[\"计算全站 P99\"]\n E[\"慢 trace\"] --> F[\"分段根因\"]",
    "labels": [
      "只看平均",
      "看尾部与分段"
    ],
    "frames": [
      [
        "99个快请求=20ms",
        "1个慢请求=2000ms",
        "平均=39.8ms"
      ],
      [
        "平均=看似正常",
        "慢用户=体验恶化"
      ],
      [
        "直方图=保留分布",
        "慢trace=2000ms",
        "排队=1800ms"
      ],
      [
        "排队=准入治理",
        "P99=重新测量",
        "平均=同时观测"
      ]
    ],
    "quiz": [
      [
        "少数两秒请求为何均值不醒目？",
        "被大量快请求稀释",
        "两秒请求不计入平均",
        "均值丢失分布形态。"
      ],
      [
        "全站 P99 怎么聚合？",
        "聚合直方图后计算",
        "平均各实例 P99",
        "分位不可线性平均。"
      ],
      [
        "十个样本的 P99 能稳定代表高峰吗？",
        "不能",
        "能",
        "样本量和窗口很关键。"
      ],
      [
        "如何追尾部根因？",
        "关联慢 trace 和排队等分段",
        "只优化平均值",
        "需定位慢请求经过的阶段。"
      ],
      [
        "从单调用变为 100 路扇出呢？",
        "更需关注子调用尾部和扇出预算",
        "平均不变就安全",
        "命中慢子任务的机会增加。"
      ],
      [
        "低流量接口 P99 跳动，先检查什么？",
        "样本量与观测窗口",
        "立即扩十倍实例",
        "统计噪声需先排除。"
      ]
    ],
    "sources": [
      [
        "Prometheus histograms and summaries",
        "https://prometheus.io/docs/practices/histograms/"
      ]
    ],
    "links": [
      [
        [
          0,
          2,
          "聚合"
        ],
        [
          1,
          2,
          "聚合"
        ]
      ],
      [],
      [
        [
          1,
          2,
          "定位"
        ],
        [
          0,
          1,
          "选慢样本"
        ]
      ],
      [
        [
          0,
          1,
          "验证尾部"
        ]
      ]
    ],
    "kind": "graph"
  },
  {
    "id": 163,
    "title": "RSS 上涨就一定是 Go 内存泄漏吗？",
    "scene": "请求高峰后 RSS 从 300MB 涨到 900MB；GC 后活跃堆只有 200MB。另一进程活跃堆随请求数一直涨，两者不能同样处理。",
    "constraints": [
      "区分 live heap、分配速率和 RSS",
      "包含 goroutine 栈、cgo 与映射内存"
    ],
    "options": [
      [
        "多口径与对象保留分析",
        "区分泄漏、缓存和驻留",
        "需要 profile 对比和运行时指标",
        "内存增长归因"
      ],
      [
        "只看 RSS 强制 GC",
        "操作简单",
        "误判且可能伤延迟",
        "临时诊断而非长期方案"
      ]
    ],
    "answer": "比较 GC 后 live heap、allocs、goroutine 与系统 RSS，定位持有对象的路径和增长趋势。",
    "failure": "把未立即归还 OS 的内存当泄漏，或 live heap 持续增大却只改 GC 参数。",
    "steps": [
      "分配高不等于保留高。",
      "堆 profile 解释 Go 对象，RSS 包含更多来源。",
      "用相近负载阶段和多次样本区分稳定平台与无界增长。"
    ],
    "limit": "标准 Go heap profile 不覆盖全部 cgo 分配和文件映射。",
    "revisit": "对象增长来源随流量或版本改变。",
    "rule": "先看谁还活，再看谁占着；RSS 不是 Go 堆同义词。",
    "flow": "flowchart TD\n A[\"RSS 上涨\"] --> B[\"GC 后 live heap 是否增长\"]\n B --> C[\"保留对象与引用链\"]\n A --> D[\"栈 cgo 映射与驻留页\"]",
    "labels": [
      "只看 RSS",
      "多口径比较"
    ],
    "frames": [
      [
        "RSS=900MB",
        "liveheap=200MB",
        "结论=泄漏未证实"
      ],
      [
        "强制GC=反复执行",
        "延迟=上升",
        "根因=仍未知"
      ],
      [
        "RSS=900MB",
        "liveheap=200MB",
        "外部分配=待核对",
        "goroutine栈=待核对"
      ],
      [
        "Go保留对象=按profile分析",
        "外部内存=专用工具",
        "驻留页=长期趋势"
      ]
    ],
    "quiz": [
      [
        "RSS 高但 live heap 低能断言泄漏吗？",
        "不能",
        "能",
        "RSS 包含非堆和驻留内存。"
      ],
      [
        "allocs 高代表什么？",
        "累计分配多，不必然长期保留",
        "一定有无界泄漏",
        "分配与保留是两维。"
      ],
      [
        "heap profile 覆盖所有 cgo 内存吗？",
        "不覆盖",
        "覆盖",
        "外部分配需要其他工具。"
      ],
      [
        "live heap 随请求永久增长怎么修？",
        "定位持有引用和无界缓存",
        "只增大 GOGC",
        "GC 不回收仍被引用对象。"
      ],
      [
        "高峰后稳定平台且后续不增长呢？",
        "评估容量和驻留行为",
        "直接定性无界泄漏",
        "趋势与可复现性重要。"
      ],
      [
        "goroutine 数增长同时栈涨，应检查什么？",
        "阻塞与退出路径",
        "仅字符串分配",
        "goroutine 生命周期可保留整条引用链。"
      ]
    ],
    "sources": [
      [
        "Go GC guide",
        "https://go.dev/doc/gc-guide"
      ],
      [
        "Go diagnostics",
        "https://go.dev/doc/diagnostics"
      ]
    ],
    "links": [
      [
        [
          0,
          2,
          "不能直接定性"
        ]
      ],
      [
        [
          0,
          1,
          "额外开销"
        ]
      ],
      [
        [
          0,
          1,
          "组成部分"
        ],
        [
          0,
          2,
          "组成部分"
        ],
        [
          0,
          3,
          "组成部分"
        ]
      ],
      []
    ],
    "kind": "graph"
  },
  {
    "id": 164,
    "title": "容器 1GiB 内存，GOMEMLIMIT 能直接设 1GiB 吗？",
    "scene": "容器硬限制 1024MiB，cgo、映射、运行环境需预留 180MiB，突发余量 100MiB。把 Go 软限制也设 1024MiB 仍被 OOM kill。",
    "constraints": [
      "硬限制含整个进程及容器计费范围",
      "GOMEMLIMIT 是 Go 运行时软限制"
    ],
    "options": [
      [
        "扣外部占用与余量再设软限制",
        "减少触及硬上限的概率",
        "过低会增加 GC 压力",
        "测得非 Go 开销"
      ],
      [
        "软限制等于容器硬限",
        "配置简单",
        "外部内存无余量",
        "只有经验证仍有其他硬余量时"
      ]
    ],
    "answer": "按运行时管理内存口径和容器实测留余量，本例预算约 744MiB；观察 GC CPU 与 OOM。",
    "failure": "把 GOMEMLIMIT 当硬性 RSS 上限，忽略 cgo 或被迫超过软限制的情况。",
    "steps": [
      "Go 软限制约束运行时管理内存，不包含所有外部来源。",
      "限得太低可造成 GC 频繁，仍不能魔法回收活对象。",
      "限制应随真实 live set 和容器资源共同验证。"
    ],
    "limit": "代码只算预算，不设置运行时参数；744MiB 是本题示例而非推荐固定百分比。",
    "revisit": "cgo 使用、live set 或容器计费变化。",
    "rule": "硬限先留外部账，软限不是铁围墙。",
    "flow": "flowchart LR\n A[\"硬限 1024MiB\"] --> B[\"减外部 180\"]\n B --> C[\"减突发 100\"]\n C --> D[\"Go 软预算 744MiB\"]",
    "labels": [
      "软硬同值",
      "预留外部余量"
    ],
    "frames": [
      [
        "容器硬限=1024MiB",
        "Go软限=1024MiB",
        "外部占用=180MiB"
      ],
      [
        "总需求=1204MiB",
        "硬限=1024MiB",
        "结果=OOM风险"
      ],
      [
        "硬限=1024MiB",
        "外部=180MiB",
        "突发=100MiB"
      ],
      [
        "Go软预算=744MiB",
        "外部=180MiB",
        "余量=100MiB"
      ]
    ],
    "quiz": [
      [
        "GOMEMLIMIT=硬限为何仍 OOM？",
        "还有外部内存且它是软限制",
        "参数没有任何作用",
        "口径与保障强度不同。"
      ],
      [
        "本题 Go 预算多少？",
        "744MiB",
        "844MiB",
        "同时扣 180 外部和 100 余量。"
      ],
      [
        "软限制保证 RSS 不超吗？",
        "不保证",
        "保证",
        "不是 OS 的硬限制。"
      ],
      [
        "live set 已超过预算怎么修？",
        "减保留对象或增加容量",
        "无限降低软限制",
        "仍活对象无法回收。"
      ],
      [
        "新增 cgo 额外 200MiB 需怎样改？",
        "重新测量并降低可用 Go 预算或增容",
        "配置完全不变",
        "外部占用改变预算。"
      ],
      [
        "调低后 GC CPU 暴涨说明什么？",
        "预算可能过紧需评估",
        "一定已经更稳定",
        "软限制有 CPU 换内存代价。"
      ]
    ],
    "sources": [
      [
        "Go GC memory limit",
        "https://go.dev/doc/gc-guide"
      ],
      [
        "runtime/debug SetMemoryLimit",
        "https://pkg.go.dev/runtime/debug#SetMemoryLimit"
      ]
    ]
  },
  {
    "id": 165,
    "title": "GOGC 调大就一定更快吗？",
    "scene": "JSON 聚合服务分配很快、live heap 200MB。提高 GOGC 可能降低 GC 频率，但容器内存有限，碰到软限制后效果不同。",
    "constraints": [
      "同时满足内存与 P99 预算",
      "需比较分配率和保留大小"
    ],
    "options": [
      [
        "减少分配与保留后调 GC",
        "从源头减少工作",
        "代码复杂度和验证成本",
        "已定位分配热点"
      ],
      [
        "增大 GOGC",
        "可能降低 GC CPU",
        "允许堆增长，受软限制影响",
        "有内存余量且 GC 占比高"
      ]
    ],
    "answer": "先测 allocation/live heap/GC CPU，再单变量调 GOGC 与软限制，验证 RSS、吞吐和尾延迟。",
    "failure": "只看一次基准变快就全量调大，忽略容器 OOM 和工作负载变化。",
    "steps": [
      "GOGC 调节堆增长目标，不直接指定进程 RSS。",
      "更低分配率可降低 GC 工作频率。",
      "内存软限制参与控制，参数不能孤立看。"
    ],
    "limit": "不能用简单 live×(1+GOGC/100) 当整个进程的精确内存预测；运行时根和其他内存也影响。",
    "revisit": "流量、对象生命周期或 Go 版本改变。",
    "rule": "GC 以空间换时间，先查分配再调旋钮。",
    "flow": "flowchart LR\n A[\"分配与live heap证据\"] --> B[\"单变量调 GOGC\"]\n B --> C[\"测 GC CPU 与 P99\"]\n C --> D[\"核对内存硬预算\"]",
    "labels": [
      "只调高 GOGC",
      "先测再调"
    ],
    "frames": [
      [
        "liveheap=200MB",
        "GOGC=100",
        "内存余量=有限"
      ],
      [
        "liveheap=200MB",
        "GOGC=400",
        "堆目标=增长",
        "OOM风险=增加"
      ],
      [
        "分配profile=定位",
        "参数=单变量",
        "观测=CPU内存P99"
      ],
      [
        "观测=满足门槛",
        "发布=逐步验证",
        "回退=保留"
      ]
    ],
    "quiz": [
      [
        "GOGC 调高主要取舍？",
        "可能少做 GC 但更多内存",
        "必然同时省 CPU 和内存",
        "时间空间有权衡。"
      ],
      [
        "先看哪些证据？",
        "分配率、live heap、GC CPU",
        "只有源码行数",
        "参数需由瓶颈驱动。"
      ],
      [
        "GOGC 直接设置 RSS 上限吗？",
        "不是",
        "是",
        "它是增长目标。"
      ],
      [
        "怎样修复盲目调参？",
        "单变量实验并守住内存与尾延迟",
        "多个参数同时改到最大",
        "否则无法归因。"
      ],
      [
        "容器还有大量内存且 GC 是主要瓶颈呢？",
        "可验证提高 GOGC 的收益",
        "绝对禁止提高",
        "取舍取决于资源余量。"
      ],
      [
        "live 对象本身无限增长，调 GC 能治吗？",
        "不能，修引用保留",
        "能，频繁 GC 总会回收",
        "可达对象不会被回收。"
      ]
    ],
    "sources": [
      [
        "Go GC guide",
        "https://go.dev/doc/gc-guide"
      ]
    ],
    "links": [
      [
        [
          0,
          2,
          "容量约束"
        ]
      ],
      [
        [
          1,
          2,
          "增长目标"
        ],
        [
          2,
          3,
          "挤压预算"
        ]
      ],
      [
        [
          0,
          1,
          "选择试验"
        ],
        [
          1,
          2,
          "测量"
        ]
      ],
      [
        [
          0,
          1,
          "允许"
        ],
        [
          1,
          2,
          "异常恢复"
        ]
      ]
    ],
    "kind": "graph"
  },
  {
    "id": 166,
    "title": "CPU 配额只有 2 核，GOMAXPROCS 为什么不能照搬宿主核数？",
    "scene": "Linux 容器 CPU limit 为 2，宿主有 64 逻辑 CPU。显式配置 GOMAXPROCS=64 后，高并发计算频繁被节流，P99 变差。",
    "constraints": [
      "以项目 Go 1.26 基线理解行为",
      "区分 CPU limit、requests、逻辑核和实际运行并行度"
    ],
    "options": [
      [
        "使用并验证容器感知默认值",
        "能适配配额变化",
        "仍需观测节流和负载",
        "支持该行为的 Go 版本与配置"
      ],
      [
        "显式固定并行度",
        "部署行为可控",
        "可能禁用自动更新并偏离配额",
        "经过实测的特殊工作负载"
      ]
    ],
    "answer": "在 Go 1.26 中先检查实际 GOMAXPROCS、cgroup limit、GODEBUG 和显式覆盖，再按节流与尾延迟验证。",
    "failure": "把 requests 当 CPU 带宽上限，或以为手设 GOMAXPROCS 后仍自动追踪配额。",
    "steps": [
      "Go 1.25 起 Linux 默认考虑 cgroup CPU 带宽限制，运行时可更新默认值。",
      "显式环境变量或 runtime.GOMAXPROCS 调用会关闭自动行为；兼容设置也需检查。",
      "GOMAXPROCS 不是 goroutine 数量上限。"
    ],
    "limit": "容器感知规则有最小值、取整与平台细节；本地 Windows 无法验证 Linux cgroup 行为。",
    "revisit": "Go 版本、CPU limit、平台或显式配置改变。",
    "rule": "并行度跟配额证据走；多 goroutine 不等于多 CPU。",
    "flow": "flowchart LR\n A[\"实际 CPU 与 cgroup limit\"] --> B[\"Go 运行时默认并行度\"]\n C[\"显式覆盖或兼容开关\"] --> B\n B --> D[\"测节流与 P99\"]",
    "labels": [
      "显式 64",
      "检查容器默认"
    ],
    "frames": [
      [
        "宿主逻辑CPU=64",
        "CPUlimit=2",
        "显式GOMAXPROCS=64"
      ],
      [
        "CPUlimit=2",
        "并行度=64",
        "节流=增加"
      ],
      [
        "CPUlimit=2",
        "Go容器默认=读取验证",
        "显式覆盖=移除"
      ],
      [
        "实际并行度=已核对",
        "节流与P99=对照",
        "配置=按证据"
      ]
    ],
    "quiz": [
      [
        "64 核宿主等于容器可用 64 核吗？",
        "不等于",
        "等于",
        "CPU limit 限制带宽。"
      ],
      [
        "Go 1.26 下首先检查什么？",
        "实际值、limit 与显式覆盖",
        "只看 NumCPU",
        "默认行为受平台和配置影响。"
      ],
      [
        "GOMAXPROCS 限制 goroutine 总数吗？",
        "不限制",
        "限制",
        "它约束 Go 代码 CPU 并行执行。"
      ],
      [
        "显式 64 导致节流应怎么修？",
        "检查移除覆盖或实测合适值",
        "再增加 worker 数",
        "过多并行可能更快耗尽配额。"
      ],
      [
        "改到 Go 1.24 Linux 容器能照搬新默认吗？",
        "不能，重新核对版本行为",
        "能，所有版本一样",
        "容器感知默认从后续版本引入。"
      ],
      [
        "只设置 requests 没有限额，能当 2 核硬限吗？",
        "不能",
        "能",
        "requests 与 CPU 带宽 limit 语义不同。"
      ]
    ],
    "sources": [
      [
        "Go 1.25 container-aware GOMAXPROCS",
        "https://go.dev/doc/go1.25#runtime"
      ],
      [
        "runtime GOMAXPROCS",
        "https://pkg.go.dev/runtime#GOMAXPROCS"
      ]
    ],
    "links": [
      [
        [
          0,
          2,
          "误用宿主值"
        ]
      ],
      [
        [
          1,
          0,
          "竞争配额"
        ]
      ],
      [
        [
          0,
          1,
          "容器约束"
        ],
        [
          2,
          1,
          "恢复默认"
        ]
      ],
      [
        [
          0,
          1,
          "性能验证"
        ],
        [
          1,
          2,
          "决策"
        ]
      ]
    ],
    "kind": "graph"
  },
  {
    "id": 167,
    "title": "sync.Pool 是性能缓存，还是可依赖的对象仓库？",
    "scene": "服务复用 bytes.Buffer 减少 JSON 临时分配。忘记 Reset 导致下个租户输出带上前一个租户内容；超大 buffer 也被持续保留。",
    "constraints": [
      "对象归还后原持有者不得再使用",
      "池内对象可随时被运行时清除"
    ],
    "options": [
      [
        "有上限且重置的临时对象池",
        "减少热点分配",
        "所有权和大对象保留风险",
        "profile 证明分配是瓶颈"
      ],
      [
        "每次新建",
        "简单正确",
        "更多分配",
        "对象小或收益未证实"
      ]
    ],
    "answer": "只池化可丢弃临时对象；使用前 Reset、设容量准入，归还后不得持有别名，基准验证收益。",
    "failure": "池不是持久缓存；Reset 清长度不擦除底层敏感字节，跨租户有额外清理要求。",
    "steps": [
      "Get 可能返回新对象，不能假设身份和命中。",
      "对象借用期间所有权独占。",
      "超大容量对象可不归还以控制驻留。"
    ],
    "limit": "代码验证 buffer 重置，不假定 sync.Pool 一定返回同对象，也不证明生产性能提升。",
    "revisit": "敏感数据策略、对象大小分布或 GC 行为变化。",
    "rule": "池中对象随时可丢，归还对象别再碰；Reset 不是擦除。",
    "flow": "flowchart LR\n A[\"获取临时对象\"] --> B[\"Reset 与独占使用\"]\n B --> C[\"容量合格才归还\"]\n C --> D[\"后续可能复用或丢弃\"]",
    "labels": [
      "不重置复用",
      "重置后使用"
    ],
    "frames": [
      [
        "旧内容=tenantA",
        "buffer长度=7",
        "下一租户=tenantB"
      ],
      [
        "内容=tenantAtenantB",
        "泄漏=旧内容",
        "长度=14"
      ],
      [
        "Reset=执行",
        "buffer长度=0",
        "底层字节=可能仍在"
      ],
      [
        "输出=tenantB",
        "长度=7",
        "敏感清理=另行处理"
      ]
    ],
    "quiz": [
      [
        "未 Reset 会发生什么？",
        "新输出附带旧内容",
        "Get 自动清零所有内容",
        "池不保证业务初始化。"
      ],
      [
        "归还后还能读写原指针吗？",
        "不能继续使用",
        "可以只要同进程",
        "对象可能已被别人借走。"
      ],
      [
        "Reset 等于敏感字节擦除吗？",
        "不等于",
        "等于",
        "长度清零不保证底层数据被覆盖。"
      ],
      [
        "如何控制超大 buffer 保留？",
        "超过容量阈值不归还",
        "所有对象永远放回",
        "大容量会影响驻留。"
      ],
      [
        "小对象且 profile 无分配瓶颈呢？",
        "优先简单分配",
        "必须池化所有对象",
        "复杂度应有测量收益。"
      ],
      [
        "GC 后 Get 取不到旧对象，是 bug 吗？",
        "不是，池允许丢弃",
        "是，必须持久保留",
        "sync.Pool 不是可靠仓库。"
      ]
    ],
    "sources": [
      [
        "Go sync.Pool",
        "https://pkg.go.dev/sync#Pool"
      ],
      [
        "Go bytes.Buffer",
        "https://pkg.go.dev/bytes#Buffer"
      ]
    ]
  },
  {
    "id": 168,
    "title": "下载 10GB 文件为什么不能先 io.ReadAll？",
    "scene": "Go 代理服务需转发 10GB 导出文件，容器只有 512MiB；先 ReadAll 再写响应造成内存暴涨，客户端取消后还在读取。",
    "constraints": [
      "数据可以顺序转发",
      "总大小、超时和取消仍要限制"
    ],
    "options": [
      [
        "有界缓冲流式复制",
        "峰值内存与文件大小解耦",
        "中途失败可能已经发出部分响应",
        "可流式协议"
      ],
      [
        "整体缓冲",
        "可完整校验后一次输出",
        "内存随输入增长",
        "明确小文件且有硬大小上限"
      ]
    ],
    "answer": "用 io.Copy/有界缓冲传输并绑定取消与长度策略；需要完整校验时用受限临时文件而非无界内存。",
    "failure": "流式并不自动限制总字节或时长，也不自动处理已经发送后的失败语义。",
    "steps": [
      "流式让背压从慢接收方传回读取方。",
      "限制总字节、连接寿命和取消路径。",
      "响应已发出后无法改成另一完整 JSON 错误体。"
    ],
    "limit": "代码用短输入和内存输出验证块大小；输出缓冲仍积累全量。生产需直接写网络或文件才能获得有界总内存，本课不证明大文件吞吐。",
    "revisit": "必须先完整校验签名或解密才能输出。",
    "rule": "大数据边读边走；缓冲有界还要总量有界。",
    "flow": "flowchart LR\n A[\"输入 Reader\"] --> B[\"有界缓冲\"]\n B --> C[\"输出 Writer\"]\n C --> D[\"慢消费者背压\"]\n D --> B",
    "labels": [
      "整体读入",
      "小缓冲复制"
    ],
    "frames": [
      [
        "文件大小=10240MiB",
        "容器=512MiB",
        "策略=ReadAll"
      ],
      [
        "内存需求=10240MiB",
        "预算=512MiB",
        "结果=OOM"
      ],
      [
        "文件大小=10240MiB",
        "缓冲=32KiB",
        "策略=流式"
      ],
      [
        "缓冲=32KiB",
        "已传=逐步增长",
        "取消=向上游传播"
      ]
    ],
    "quiz": [
      [
        "10GB ReadAll 对 512MiB 容器有什么风险？",
        "内存超预算",
        "Go 自动无限换盘",
        "ReadAll 将内容保存在内存。"
      ],
      [
        "流式降低哪种量？",
        "同时驻留的缓冲",
        "文件总字节数",
        "输入规模不变，驻留方式变。"
      ],
      [
        "io.Copy 自动限制总大小和时长吗？",
        "不会",
        "会",
        "必须单独实施策略。"
      ],
      [
        "需完整校验大文件后才能发怎么办？",
        "受限临时文件加校验发布",
        "仍先无界 ReadAll",
        "保留完整性同时控制内存。"
      ],
      [
        "只有最多 4KB 的配置文件呢？",
        "硬上限下整体读取合理",
        "任何 ReadAll 都错误",
        "约束决定实现复杂度。"
      ],
      [
        "已发送一半后上游失败，能再写完整错误 JSON 吗？",
        "不能作为新的完整响应",
        "可以覆盖已发字节",
        "需要中断和可识别的不完整协议。"
      ]
    ],
    "sources": [
      [
        "Go io.Copy",
        "https://pkg.go.dev/io#Copy"
      ],
      [
        "Go HTTP requests",
        "https://pkg.go.dev/net/http#NewRequestWithContext"
      ]
    ]
  },
  {
    "id": 169,
    "title": "1000 QPS、平均 50ms，需要多少在途容量？",
    "scene": "稳定系统每秒完成 1000 请求，平均系统内停留 50ms。团队只按 QPS 设 worker，不知道平均在途为 50。",
    "constraints": [
      "Little 定律用于稳定系统平均量",
      "峰值、尾部和利用率余量需另测"
    ],
    "options": [
      [
        "用平均关系估算再压测",
        "建立容量量纲和基线",
        "不能直接给出 P99 与峰值",
        "稳定负载"
      ],
      [
        "按 CPU 核数猜全部并发",
        "简单",
        "忽略 I/O 等待与任务时长",
        "仅纯 CPU 且已测量"
      ]
    ],
    "answer": "用 L=λW 得平均在途 50，明确 W 是否含排队；容量需加余量并用负载曲线验证。",
    "failure": "把平均在途 50 当硬并发上限，或混用毫秒与秒。",
    "steps": [
      "1000/s×0.05s=50。",
      "系统边界一致，λ 是稳定吞吐而非无界到达量。",
      "接近饱和时排队非线性增长，平均关系不预测分布。"
    ],
    "limit": "代码计算平均估算值，不承诺生产 worker 数或 P99；不稳定积压阶段不能直接套稳态。",
    "revisit": "服务时间、流量分布或目标利用率变化。",
    "rule": "吞吐乘停留，得到平均在途；平均不是峰值配额。",
    "flow": "flowchart LR\n A[\"稳定吞吐 1000/s\"] --> C[\"平均在途 50\"]\n B[\"平均停留 0.05s\"] --> C\n C --> D[\"加余量并压测尾部\"]",
    "labels": [
      "把均值当上限",
      "估算后留余量"
    ],
    "frames": [
      [
        "吞吐=1000",
        "停留=50ms",
        "平均在途=50"
      ],
      [
        "上限=50",
        "突发=80",
        "排队=30"
      ],
      [
        "平均在途=50",
        "容量候选=80",
        "负载=渐增"
      ],
      [
        "吞吐=测量",
        "P99=验证",
        "上限=按SLO选"
      ]
    ],
    "quiz": [
      [
        "平均在途是多少？",
        "50",
        "50000",
        "50ms 换成 0.05s。"
      ],
      [
        "L=λW 用的是什么量？",
        "同边界稳定平均量",
        "任意峰值混搭",
        "边界和量纲要一致。"
      ],
      [
        "50 可直接作为硬并发上限吗？",
        "不宜，需余量和压测",
        "必然最优",
        "平均未覆盖突发和尾部。"
      ],
      [
        "怎样修正毫秒单位错误？",
        "先统一秒再相乘",
        "直接除 CPU 数",
        "量纲决定正确计算。"
      ],
      [
        "服务时间变成 200ms、吞吐不变呢？",
        "平均在途变成 200",
        "仍为 50",
        "停留时间四倍，在途也四倍。"
      ],
      [
        "队列一直增长时可用到达速率当稳态吞吐吗？",
        "不能直接这样套用",
        "可以",
        "系统不稳定且输入输出不平衡。"
      ]
    ],
    "sources": [
      [
        "MIT queueing and Little's Law lecture",
        "https://web.mit.edu/course/2/2.810/www/files/lectures/lec12-time-analysis-2016.pdf"
      ]
    ]
  },
  {
    "id": 170,
    "title": "微基准快 30%，上线为什么可能没有收益？",
    "scene": "改写序列化函数基准快 30%，但函数只占端到端 5%。新版还增加内存保留，真实流量 P99 反而恶化。",
    "constraints": [
      "正确性不变",
      "比较相同负载、工具链与资源"
    ],
    "options": [
      [
        "基准加端到端对照",
        "验证局部和真实收益",
        "实验与统计成本",
        "生产优化"
      ],
      [
        "只凭单次 ns/op",
        "快速",
        "噪声、过拟合和副作用",
        "仅早期探索线索"
      ]
    ],
    "answer": "先明确瓶颈占比和收益目标，重复基准用统计比较，再在同负载测吞吐、P99、CPU、分配和内存。",
    "failure": "把局部收益当全局收益，或只报最快一次，忽略正确性与容量回归。",
    "steps": [
      "Amdahl 约束整体收益，5% 的局部优化不能带来 30% 总提升。",
      "基准需防编译优化消除并保留真实输入分布。",
      "端到端比较包含失败率和资源代价，保留回退路径。"
    ],
    "limit": "实验结论仅适用于测量负载与版本；小样本没有稳定显著性保障。",
    "revisit": "输入分布、工具链或瓶颈占比变化。",
    "rule": "局部快要算总账，收益也要算副作用。",
    "flow": "flowchart LR\n A[\"正确性验证\"] --> B[\"重复基准与统计\"]\n B --> C[\"同负载端到端对照\"]\n C --> D[\"收益及资源门槛\"]\n D --> E[\"发布或回退\"]",
    "labels": [
      "只看局部基准",
      "端到端对照"
    ],
    "frames": [
      [
        "局部函数=占比5%",
        "微基准=快30%",
        "假设=全局快30%"
      ],
      [
        "端到端=收益有限",
        "内存保留=增加",
        "P99=恶化"
      ],
      [
        "正确性=通过",
        "重复基准=统计比较",
        "同负载端到端=完整测量"
      ],
      [
        "吞吐=记录",
        "P99=门槛",
        "内存=门槛",
        "发布决策=收益达标才继续"
      ]
    ],
    "quiz": [
      [
        "局部快 30% 就全局快 30% 吗？",
        "不成立",
        "成立",
        "只有部分请求时间被优化。"
      ],
      [
        "对照实验需控制什么？",
        "负载、版本和资源条件",
        "只让新版本用更强机器",
        "混入变量无法归因。"
      ],
      [
        "一次最快结果能证明稳定收益吗？",
        "不能",
        "能",
        "调度和环境存在噪声。"
      ],
      [
        "如何修复只看 ns/op 的验收？",
        "加入正确性、分配和端到端 SLO",
        "仅跑更多不同输入但不记录",
        "多维结果决定实际收益。"
      ],
      [
        "函数占 90% CPU 且输入稳定时呢？",
        "局部优化可能有显著全局收益但仍验证",
        "所有局部优化都无效",
        "占比改变收益上限。"
      ],
      [
        "吞吐升但 P99 超标应怎样处理？",
        "按既定目标判回归并回退或修复",
        "只宣布吞吐胜利",
        "验收目标不能事后换成有利指标。"
      ]
    ],
    "sources": [
      [
        "Go testing benchmarks",
        "https://pkg.go.dev/testing#hdr-Benchmarks"
      ],
      [
        "Go benchstat",
        "https://pkg.go.dev/golang.org/x/perf/cmd/benchstat"
      ]
    ],
    "links": [
      [
        [
          1,
          2,
          "错误外推"
        ]
      ],
      [
        [
          1,
          2,
          "可能影响尾部"
        ]
      ],
      [
        [
          0,
          1,
          "前提"
        ],
        [
          1,
          2,
          "验证真实收益"
        ]
      ],
      [
        [
          0,
          3,
          "收益"
        ],
        [
          1,
          3,
          "约束"
        ],
        [
          2,
          3,
          "约束"
        ]
      ]
    ],
    "kind": "graph"
  }
];
export default seeds.map(s=>make({...s,code:codes[s.id]})) satisfies Lesson[];
