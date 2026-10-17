import {architectureLesson} from '../architecture-builder';
import {q,frame,experiment} from '../builders';
import type {Lesson} from '../types';
type QA=[string,string,string,string];
type Seed={id:number;title:string;scene:string;constraints:string[];options:[string,string,string,string][];answer:string;failure:string;steps:string[];limit:string;revisit:string;rule:string;flow:string;labels:[string,string];frames:[string[],string[],string[],string[]];quiz:QA[];sources:[string,string][];code?:CodeSpec;links?:[number,number,string][][];kind?:'bars'|'graph'|'timeline'};
type CodeSpec={starter:string;solution:string;starterOutput:string;expectedOutput:string;testCode:string};
function make(s:Seed){const stages=s.frames.map((values,i)=>{const f=frame(i%2?'观察结果':'进入场景',i%2?s.answer:s.labels[Math.floor(i/2)],values,i%2?Math.min(1,values.length-1):0);f.edges=(s.links?.[i]??[]).map(([a,b,label])=>({from:`n${a}`,to:`n${b}`,label}));return f;});return architectureLesson({id:s.id,title:s.title,scenario:s.scene,constraints:s.constraints,options:s.options.map(([title,benefits,costs,when])=>({title,benefits,costs,when})),recommendation:s.answer,pitfall:s.failure,mechanism:s.steps,boundary:s.limit,revisitWhen:[s.revisit],mnemonic:s.rule,sources:s.sources.map(([title,url])=>({title,url})),diagram:[{title:s.title,kind:'flow',source:s.flow,caption:s.steps.join('；')}],experiment:experiment(s.kind??'bars','资源与状态实验','逐步观察状态变化，再切换条件。数值为确定性教学模型，不代表真实系统压测。',[stages[0],stages[1]],[stages[2],stages[3]],s.labels),quizzes:s.quiz.map(x=>q(...x)),code:s.code});}

const codes:Record<number,CodeSpec>={
  "143": {
    "starter": "package main\n\nimport (\n\t\"fmt\"\n\t\"hash/fnv\"\n)\n\nfunc hashKey(key string) uint32 {\n\th := fnv.New32a()\n\t_, _ = h.Write([]byte(key))\n\treturn h.Sum32()\n}\nfunc ttl(key string, base, spread int) int { return base }\nfunc solve() string                        { return fmt.Sprint(ttl(\"sku-a\", 300, 60) != ttl(\"sku-b\", 300, 60)) }\nfunc main()                                { fmt.Println(solve()) }\n",
    "solution": "package main\n\nimport (\n\t\"fmt\"\n\t\"hash/fnv\"\n)\n\nfunc hashKey(key string) uint32 {\n\th := fnv.New32a()\n\t_, _ = h.Write([]byte(key))\n\treturn h.Sum32()\n}\nfunc ttl(key string, base, spread int) int {\n\tif spread <= 0 {\n\t\treturn base\n\t}\n\treturn base + int(hashKey(key)%uint32(spread+1))\n}\nfunc solve() string { return fmt.Sprint(ttl(\"sku-a\", 300, 60) != ttl(\"sku-b\", 300, 60)) }\nfunc main()         { fmt.Println(solve()) }\n",
    "starterOutput": "false",
    "expectedOutput": "true",
    "testCode": "package main\n\nimport \"testing\"\n\nfunc TestBehavior(t *testing.T) {\n\tseen := map[int]bool{}\n\tfor _, k := range []string{\"a\", \"b\", \"c\", \"d\", \"e\", \"f\"} {\n\t\tn := ttl(k, 300, 60)\n\t\tif n < 300 || n > 360 || ttl(k, 300, 60) != n {\n\t\t\tt.Fatal(k, n)\n\t\t}\n\t\tseen[n] = true\n\t}\n\tif len(seen) < 2 {\n\t\tt.Fatal(\"all keys expire together\")\n\t}\n\tif ttl(\"a\", 10, 0) != 10 {\n\t\tt.Fatal(\"zero spread\")\n\t}\n}\nfunc TestSolution(t *testing.T) {\n\tif got := solve(); got != \"true\" {\n\t\tt.Fatal(got)\n\t}\n}\nfunc BenchmarkSolution(b *testing.B) {\n\tfor i := 0; i < b.N; i++ {\n\t\t_ = solve()\n\t}\n}\n"
  },
  "146": {
    "starter": "package main\n\nimport (\n\t\"fmt\"\n)\n\nfunc points(ids []string) int {\n\ttotal := 0\n\tfor range ids {\n\t\ttotal += 10\n\t}\n\treturn total\n}\nfunc solve() string { return fmt.Sprint(points([]string{\"e1\", \"e1\", \"e2\"})) }\nfunc main()         { fmt.Println(solve()) }\n",
    "solution": "package main\n\nimport (\n\t\"fmt\"\n)\n\nfunc points(ids []string) int {\n\tseen := map[string]bool{}\n\ttotal := 0\n\tfor _, id := range ids {\n\t\tif seen[id] {\n\t\t\tcontinue\n\t\t}\n\t\tseen[id] = true\n\t\ttotal += 10\n\t}\n\treturn total\n}\nfunc solve() string { return fmt.Sprint(points([]string{\"e1\", \"e1\", \"e2\"})) }\nfunc main()         { fmt.Println(solve()) }\n",
    "starterOutput": "30",
    "expectedOutput": "20",
    "testCode": "package main\n\nimport \"testing\"\n\nfunc TestBehavior(t *testing.T) {\n\tfor _, c := range []struct {\n\t\tids  []string\n\t\twant int\n\t}{{nil, 0}, {[]string{\"a\", \"a\", \"a\"}, 10}, {[]string{\"a\", \"b\"}, 20}, {[]string{\"b\", \"a\", \"b\", \"c\", \"a\"}, 30}} {\n\t\tif got := points(c.ids); got != c.want {\n\t\t\tt.Fatal(c, got)\n\t\t}\n\t}\n}\nfunc TestSolution(t *testing.T) {\n\tif got := solve(); got != \"20\" {\n\t\tt.Fatal(got)\n\t}\n}\nfunc BenchmarkSolution(b *testing.B) {\n\tfor i := 0; i < b.N; i++ {\n\t\t_ = solve()\n\t}\n}\n"
  },
  "147": {
    "starter": "package main\n\nimport (\n\t\"fmt\"\n)\n\nfunc deliver(ids []string, fail string) (saved, acked []string) {\n\tfor _, id := range ids {\n\t\tacked = append(acked, id)\n\t\tif id == fail {\n\t\t\tcontinue\n\t\t}\n\t\tsaved = append(saved, id)\n\t}\n\treturn\n}\nfunc solve() string {\n\ts, a := deliver([]string{\"coupon-1\"}, \"coupon-1\")\n\treturn fmt.Sprintf(\"%d %d\", len(s), len(a))\n}\nfunc main() { fmt.Println(solve()) }\n",
    "solution": "package main\n\nimport (\n\t\"fmt\"\n)\n\nfunc deliver(ids []string, fail string) (saved, acked []string) {\n\tfor _, id := range ids {\n\t\tif id == fail {\n\t\t\tcontinue\n\t\t}\n\t\tsaved = append(saved, id)\n\t\tacked = append(acked, id)\n\t}\n\treturn\n}\nfunc solve() string {\n\ts, a := deliver([]string{\"coupon-1\"}, \"coupon-1\")\n\treturn fmt.Sprintf(\"%d %d\", len(s), len(a))\n}\nfunc main() { fmt.Println(solve()) }\n",
    "starterOutput": "0 1",
    "expectedOutput": "0 0",
    "testCode": "package main\n\nimport \"testing\"\n\nfunc TestBehavior(t *testing.T) {\n\tfor _, fail := range []string{\"a\", \"b\", \"c\", \"none\"} {\n\t\ts, a := deliver([]string{\"a\", \"b\", \"c\"}, fail)\n\t\tif len(s) != len(a) {\n\t\t\tt.Fatal(\"ack before commit\", fail, s, a)\n\t\t}\n\t\tfor i, id := range a {\n\t\t\tif id == fail || id != s[i] {\n\t\t\t\tt.Fatal(\"uncommitted ack\", id)\n\t\t\t}\n\t\t}\n\t}\n\ts, a := deliver([]string{\"retry\"}, \"none\")\n\tif len(s) != 1 || len(a) != 1 || a[0] != \"retry\" {\n\t\tt.Fatal(\"retry recovery\")\n\t}\n}\nfunc TestSolution(t *testing.T) {\n\tif got := solve(); got != \"0 0\" {\n\t\tt.Fatal(got)\n\t}\n}\nfunc BenchmarkSolution(b *testing.B) {\n\tfor i := 0; i < b.N; i++ {\n\t\t_ = solve()\n\t}\n}\n"
  },
  "149": {
    "starter": "package main\n\nimport (\n\t\"fmt\"\n)\n\nfunc partition(order, n int) int {\n\tif n <= 0 || order < 0 {\n\t\treturn -1\n\t}\n\treturn 0\n}\nfunc solve() string { return fmt.Sprint(partition(10, 2), partition(11, 2)) }\nfunc main()         { fmt.Println(solve()) }\n",
    "solution": "package main\n\nimport (\n\t\"fmt\"\n)\n\nfunc partition(order, n int) int {\n\tif n <= 0 || order < 0 {\n\t\treturn -1\n\t}\n\treturn order % n\n}\nfunc solve() string { return fmt.Sprint(partition(10, 2), partition(11, 2)) }\nfunc main()         { fmt.Println(solve()) }\n",
    "starterOutput": "0 0",
    "expectedOutput": "0 1",
    "testCode": "package main\n\nimport \"testing\"\n\nfunc TestBehavior(t *testing.T) {\n\tfor _, c := range []struct{ order, n, want int }{{10, 2, 0}, {11, 2, 1}, {8, 3, 2}, {7, 3, 1}, {5, 1, 0}, {5, 0, -1}, {-1, 2, -1}} {\n\t\tif got := partition(c.order, c.n); got != c.want {\n\t\t\tt.Fatal(c, got)\n\t\t}\n\t}\n}\nfunc TestSolution(t *testing.T) {\n\tif got := solve(); got != \"0 1\" {\n\t\tt.Fatal(got)\n\t}\n}\nfunc BenchmarkSolution(b *testing.B) {\n\tfor i := 0; i < b.N; i++ {\n\t\t_ = solve()\n\t}\n}\n"
  },
  "150": {
    "starter": "package main\n\nimport (\n\t\"fmt\"\n)\n\ntype Event struct {\n\tVersion int\n\tState   string\n}\n\nfunc apply(current Event, events []Event) Event {\n\tfor _, e := range events {\n\t\tcurrent = e\n\t}\n\treturn current\n}\nfunc solve() string {\n\te := apply(Event{3, \"refunded\"}, []Event{{2, \"paid\"}})\n\treturn fmt.Sprintf(\"%d %s\", e.Version, e.State)\n}\nfunc main() { fmt.Println(solve()) }\n",
    "solution": "package main\n\nimport (\n\t\"fmt\"\n)\n\ntype Event struct {\n\tVersion int\n\tState   string\n}\n\nfunc apply(current Event, events []Event) Event {\n\tfor _, e := range events {\n\t\tif e.Version > current.Version {\n\t\t\tcurrent = e\n\t\t}\n\t}\n\treturn current\n}\nfunc solve() string {\n\te := apply(Event{3, \"refunded\"}, []Event{{2, \"paid\"}})\n\treturn fmt.Sprintf(\"%d %s\", e.Version, e.State)\n}\nfunc main() { fmt.Println(solve()) }\n",
    "starterOutput": "2 paid",
    "expectedOutput": "3 refunded",
    "testCode": "package main\n\nimport \"testing\"\n\nfunc TestBehavior(t *testing.T) {\n\te := apply(Event{}, []Event{{1, \"new\"}, {3, \"refunded\"}, {2, \"paid\"}, {3, \"duplicate\"}})\n\tif e.Version != 3 || e.State != \"refunded\" {\n\t\tt.Fatal(e)\n\t}\n\te = apply(e, []Event{{4, \"archived\"}})\n\tif e.Version != 4 || e.State != \"archived\" {\n\t\tt.Fatal(e)\n\t}\n\te = apply(e, nil)\n\tif e.Version != 4 {\n\t\tt.Fatal(e)\n\t}\n}\nfunc TestSolution(t *testing.T) {\n\tif got := solve(); got != \"3 refunded\" {\n\t\tt.Fatal(got)\n\t}\n}\nfunc BenchmarkSolution(b *testing.B) {\n\tfor i := 0; i < b.N; i++ {\n\t\t_ = solve()\n\t}\n}\n"
  }
};
const seeds:Seed[]=[
  {
    "id": 141,
    "title": "商品缓存放进程内还是放共享 Redis？",
    "scene": "30 个 Go 实例缓存价格，要求更新后 5 秒内一致。每实例本地缓存 60 秒且没有失效广播，用户切换实例看到不同价格。",
    "constraints": [
      "价格允许最多 5 秒旧数据",
      "热点读多，实例会频繁伸缩"
    ],
    "options": [
      [
        "共享缓存",
        "减少跨实例差异",
        "网络延迟与共享故障域",
        "一致失效优先"
      ],
      [
        "本地 L1 加共享 L2",
        "降低热点网络读",
        "失效广播和容量治理复杂",
        "已有版本与失效协议"
      ]
    ],
    "answer": "先共享缓存并明确 TTL；需要 L1 时配版本、失效事件和短 TTL，而非每实例随意存一份。",
    "failure": "进程缓存失效只作用于一个副本，其他副本继续读旧值。",
    "steps": [
      "缓存层级改变一致性和故障域。",
      "TTL 是允许陈旧上界的一部分，不能超业务承诺。",
      "L1 需要总内存预算与失效补偿。"
    ],
    "limit": "库存扣减和支付价格仍应在权威存储校验，缓存不承担最终原子约束。",
    "revisit": "共享缓存网络读成瓶颈且可承担 L1 协议。",
    "rule": "每加一层缓存，多一份陈旧责任；快不代表权威。",
    "flow": "flowchart LR\n A[\"Go 实例\"] --> B[\"可选短 TTL L1\"]\n B --> C[\"共享 L2\"]\n C --> D[\"权威数据库\"]\n E[\"更新事件\"] --> B",
    "labels": [
      "独立 60 秒 L1",
      "共享失效"
    ],
    "frames": [
      [
        "实例甲缓存=100",
        "实例乙缓存=100",
        "数据库价格=120"
      ],
      [
        "实例甲缓存=120",
        "实例乙缓存=100",
        "数据库价格=120"
      ],
      [
        "实例甲=查询",
        "实例乙=查询",
        "共享缓存价格=120",
        "数据库价格=120"
      ],
      [
        "实例甲=120",
        "实例乙=120",
        "共享缓存价格=120"
      ]
    ],
    "quiz": [
      [
        "只清甲实例缓存后乙会怎样？",
        "仍可能返回旧价",
        "自动同步甲的内存",
        "进程内存相互独立。"
      ],
      [
        "L1 引入什么额外责任？",
        "失效传播和内存预算",
        "仅配置一个 map",
        "要维护多份副本。"
      ],
      [
        "缓存可直接决定最终扣库存吗？",
        "不能替代权威原子校验",
        "可以，读得快就足够",
        "正确性边界不能由过期副本保证。"
      ],
      [
        "5 秒承诺与 60 秒 TTL 冲突怎么修？",
        "缩短 TTL 并补可靠失效或版本校验",
        "只提高实例数量",
        "副本更多使陈旧更复杂。"
      ],
      [
        "改为永不变的版本化商品图片呢？",
        "可长时间本地缓存",
        "仍必须 5 秒失效",
        "不可变内容改变一致性要求。"
      ],
      [
        "100 个实例每份缓存 200MB，总量多少？",
        "约 20GB，需整体预算",
        "仅 200MB",
        "每份副本都消耗内存。"
      ]
    ],
    "sources": [
      [
        "Redis client-side caching",
        "https://redis.io/docs/latest/develop/reference/client-side-caching/"
      ]
    ],
    "links": [
      [
        [
          0,
          2,
          "更新甲"
        ]
      ],
      [
        [
          0,
          2,
          "已刷新"
        ]
      ],
      [
        [
          0,
          2,
          "读"
        ],
        [
          1,
          2,
          "读"
        ],
        [
          2,
          3,
          "回源"
        ]
      ],
      [
        [
          2,
          0,
          "返回"
        ],
        [
          2,
          1,
          "返回"
        ]
      ]
    ],
    "kind": "graph"
  },
  {
    "id": 142,
    "title": "更新数据库和缓存，先删还是先写？",
    "scene": "商品名称更新同时有读请求。先删缓存再写数据库，读请求趁间隙把旧值重新装入缓存；旧值持续整个 TTL。",
    "constraints": [
      "数据库为权威",
      "允许短时陈旧但要可界定"
    ],
    "options": [
      [
        "提交数据库后失效",
        "写入失败不误删新数据",
        "仍有并发回填旧值窗口",
        "配版本或短 TTL"
      ],
      [
        "更新缓存副本",
        "读取更及时",
        "双写失败和乱序覆盖",
        "有版本检查及重试协议"
      ]
    ],
    "answer": "提交后失效并定义失败重试；对严格陈旧预算采用版本检查、事件驱动刷新或绕过缓存。",
    "failure": "把“先写库再删缓存”误当绝对一致，迟到的旧读仍可回填。",
    "steps": [
      "写库与缓存操作不在一个原子事务。",
      "失败与并发读两类窗口都要分析。",
      "版本号可阻止旧版本覆盖新缓存。"
    ],
    "limit": "延迟双删只是缩小某些窗口，不是任意网络延迟下的正确性证明。",
    "revisit": "业务从允许短时旧值改为严格读己之写。",
    "rule": "先定陈旧预算，再选失效协议；操作顺序不是一致性证明。",
    "flow": "flowchart LR\n A[\"提交数据库 v2\"] --> B[\"缓存失效\"]\n C[\"迟到旧读 v1\"] --> D[\"版本校验\"]\n D --> E[\"拒绝覆盖 v2\"]",
    "labels": [
      "先删后写",
      "版本防旧回填"
    ],
    "frames": [
      [
        "数据库=v1",
        "缓存=已删除",
        "读者=读取旧值"
      ],
      [
        "数据库=v2",
        "缓存=v1",
        "读者=迟到回填"
      ],
      [
        "数据库=v2",
        "缓存=v2",
        "迟到读者=v1"
      ],
      [
        "数据库=v2",
        "缓存=v2",
        "迟到读者=版本拒绝"
      ]
    ],
    "quiz": [
      [
        "先删后写期间读者可造成什么？",
        "旧值重新回填",
        "自动等待数据库提交",
        "读者不知更新事务。"
      ],
      [
        "写库后删为何仍非绝对一致？",
        "旧读结果可能迟到回填",
        "缓存删除总是失败",
        "并发窗口独立于单次操作顺序。"
      ],
      [
        "延迟双删是否适用任何网络延迟？",
        "不能保证",
        "可以数学保证",
        "固定延迟不是无界延迟的上界。"
      ],
      [
        "如何防旧版覆盖已缓存新版本？",
        "缓存写入比较版本",
        "只延长 TTL",
        "版本顺序才能识别迟到写。"
      ],
      [
        "改为不可变 ID 指向新版本对象呢？",
        "新版本用新 key 简化更新",
        "仍重写同一 key 多次",
        "不可变键减少覆盖冲突。"
      ],
      [
        "删除失败后为何要重试或观测？",
        "旧缓存可能长期残留",
        "数据库会自动清缓存",
        "两个系统没有自动联动。"
      ]
    ],
    "sources": [
      [
        "Redis client-side caching",
        "https://redis.io/docs/latest/develop/reference/client-side-caching/"
      ]
    ],
    "links": [
      [
        [
          0,
          2,
          "读到 v1"
        ]
      ],
      [
        [
          2,
          1,
          "回填 v1"
        ]
      ],
      [
        [
          2,
          1,
          "请求写入 v1"
        ]
      ],
      [
        [
          0,
          1,
          "保留 v2"
        ]
      ]
    ],
    "kind": "graph"
  },
  {
    "id": 143,
    "title": "百万热点 key 同时过期，如何避免击穿数据库？",
    "scene": "活动开始时批量预热 100 万 key，全部 TTL=300 秒。第 300 秒大量缓存未命中同时回源。",
    "constraints": [
      "允许 TTL 在 300–360 秒之间",
      "数据库回源有并发预算"
    ],
    "options": [
      [
        "TTL 抖动加回源限流",
        "分散失效峰值且保护数据库",
        "部分值更陈旧",
        "业务允许过期区间"
      ],
      [
        "热点预刷新",
        "提前补充高价值 key",
        "需要热点识别和刷新预算",
        "少量极热 key"
      ]
    ],
    "answer": "给 key 确定性抖动分散过期，同时限制回源并发；单个极热 key 用请求合并或预刷新。",
    "failure": "抖动只能分散多 key，不能解决同一个 key 被百万用户同时请求。",
    "steps": [
      "按 key 哈希分配到允许 TTL 区间。",
      "回源必须有超时、队列上限和降级。",
      "区分多 key 雪崩与单 key 击穿。"
    ],
    "limit": "代码使用确定性哈希观察分布，不证明真实随机性、数据库负载或缓存一致性。",
    "revisit": "流量集中到一个 key 或陈旧预算缩小。",
    "rule": "多 key 打散，单 key 合并；两者都要限回源。",
    "flow": "flowchart LR\n A[\"批量预热\"] --> B[\"按 key 抖动 TTL\"]\n B --> C[\"分散过期\"]\n C --> D[\"有界回源\"]",
    "labels": [
      "TTL 全相同",
      "按 key 抖动"
    ],
    "frames": [
      [
        "key数=6",
        "TTL=300s",
        "时刻=0"
      ],
      [
        "300秒过期=6",
        "回源=6",
        "峰值=集中"
      ],
      [
        "TTL最小=300s",
        "TTL最大=360s",
        "key数=6"
      ],
      [
        "过期桶=分散",
        "回源=有界",
        "数据库=受保护"
      ]
    ],
    "quiz": [
      [
        "所有 TTL 相同有什么风险？",
        "集中回源",
        "所有 key 永不过期",
        "同一时刻失效。"
      ],
      [
        "抖动主要解决什么？",
        "多 key 同步过期",
        "所有单 key 热点",
        "同 key 仍共享一个 TTL。"
      ],
      [
        "抖动能保证数据库永不过载吗？",
        "不能，还要限流",
        "能，时间散开就足够",
        "总负载和单热点仍可能过高。"
      ],
      [
        "单个热点同时被十万请求击中应加什么？",
        "按 key 请求合并",
        "只随机每个请求的 TTL",
        "合并减少重复回源。"
      ],
      [
        "数据必须最多 5 秒陈旧，能用 360 秒吗？",
        "不能，缩到允许范围",
        "能，缓存吞吐最重要",
        "TTL 受业务约束。"
      ],
      [
        "冷 key 极多且回源很贵，只有抖动够吗？",
        "不够，要回源预算和降级",
        "够，key 很分散",
        "平均流量仍可能超容量。"
      ]
    ],
    "sources": [
      [
        "Redis EXPIRE",
        "https://redis.io/docs/latest/commands/expire/"
      ]
    ]
  },
  {
    "id": 144,
    "title": "singleflight 能让 20 个实例只回源一次吗？",
    "scene": "每个 Go 实例有自己的请求合并器，20 个实例同时收到相同热 key。团队以为所有请求只查一次数据库。",
    "constraints": [
      "进程内合并范围明确",
      "分布式协调也有故障与租约成本"
    ],
    "options": [
      [
        "每进程合并",
        "实现简单减少本地重复",
        "最多仍有实例数级回源",
        "数据库可承受有限并行"
      ],
      [
        "共享缓存加租约协调",
        "跨实例减少重复",
        "租约过期、持有者崩溃和 fencing 复杂",
        "回源极贵且需要跨实例协调"
      ]
    ],
    "answer": "把 singleflight 当进程内优化，结合共享缓存和回源配额；跨进程协调按收益选择。",
    "failure": "进程内 map 或 singleflight 不是全局互斥锁。",
    "steps": [
      "同一 group 同一 key 才会合并。",
      "共享结果的取消和错误传播需要设计。",
      "分布式锁过期后旧持有者仍可能完成写入。"
    ],
    "limit": "合并只能减少重复工作，不提供持久幂等，也不保证缓存一致性。",
    "revisit": "实例数量或回源成本上升导致本地合并不足。",
    "rule": "合并先问范围；一进程一次不等于全局一次。",
    "flow": "flowchart LR\n A[\"实例甲 group\"] --> C[\"一次回源\"]\n B[\"实例乙 group\"] --> D[\"另一次回源\"]\n C --> E[\"数据库\"]\n D --> E",
    "labels": [
      "误当全局一次",
      "按实例预算"
    ],
    "frames": [
      [
        "实例甲group=同key",
        "实例乙group=同key",
        "数据库=等待"
      ],
      [
        "实例甲group=回源一次",
        "实例乙group=回源一次",
        "数据库=两次回源"
      ],
      [
        "实例甲group=同key",
        "实例乙group=同key",
        "共享缓存=填充中",
        "回源配额=有界"
      ],
      [
        "实例甲group=命中",
        "实例乙group=命中",
        "共享缓存=已填充"
      ]
    ],
    "quiz": [
      [
        "20 个 group 同一 key 最少能否仍回源 20 次？",
        "可能",
        "不可能，key 全局唯一",
        "group 只在当前进程共享。"
      ],
      [
        "合并的边界是什么？",
        "同进程同 group 同 key",
        "整个集群同字符串",
        "对象作用域决定边界。"
      ],
      [
        "singleflight 等于持久消费去重吗？",
        "不是",
        "是",
        "完成后的重复请求仍可能执行。"
      ],
      [
        "全局回源超预算应怎么修？",
        "共享缓存、配额或评估租约协调",
        "再给每实例各加一个锁",
        "本地锁不能统一多个进程。"
      ],
      [
        "单实例小服务且回源便宜呢？",
        "本地合并通常足够",
        "必须分布式锁",
        "成本取决于部署约束。"
      ],
      [
        "租约过期后旧持有者写入怎么办？",
        "需要版本或 fencing 等保护",
        "认定旧进程一定死亡",
        "过期不是远端执行已停止的证明。"
      ]
    ],
    "sources": [
      [
        "Go singleflight",
        "https://pkg.go.dev/golang.org/x/sync/singleflight"
      ]
    ],
    "links": [
      [
        [
          0,
          2,
          "回源"
        ],
        [
          1,
          2,
          "回源"
        ]
      ],
      [
        [
          2,
          0,
          "结果"
        ],
        [
          2,
          1,
          "结果"
        ]
      ],
      [
        [
          0,
          2,
          "查缓存"
        ],
        [
          1,
          2,
          "查缓存"
        ],
        [
          2,
          3,
          "申请配额"
        ]
      ],
      [
        [
          2,
          0,
          "共享结果"
        ],
        [
          2,
          1,
          "共享结果"
        ]
      ]
    ],
    "kind": "graph"
  },
  {
    "id": 145,
    "title": "Redis 故障时全部回源，为什么数据库也倒了？",
    "scene": "正常 99% 命中、总流量 10 万 QPS，数据库平时 1000 QPS。Redis 断开后所有请求直接读库，容量瞬间超额。",
    "constraints": [
      "数据库可承受 3000 QPS",
      "部分页面允许陈旧或降级"
    ],
    "options": [
      [
        "有界回源加降级",
        "保护权威存储",
        "部分请求变旧或失败",
        "缓存只是加速层"
      ],
      [
        "全量直接回源",
        "逻辑简单保持数据新",
        "可能放大为数据库故障",
        "低流量且数据库有容量证明"
      ]
    ],
    "answer": "设置独立回源预算，允许的读走陈旧副本或降级；超预算快速拒绝并监测恢复。",
    "failure": "缓存故障的自动回源把小故障扩成全站数据库故障。",
    "steps": [
      "按未命中放大计算灾难流量。",
      "限流放在回源入口而非数据库过载后。",
      "缓存恢复时逐步填充，避免再次同步打库。"
    ],
    "limit": "余额、权限等不能随意返回陈旧值，要按业务区别降级。",
    "revisit": "数据库容量或可陈旧业务范围变化。",
    "rule": "缓存失守，回源有门；降级必须按业务选。",
    "flow": "flowchart LR\n A[\"缓存不可用\"] --> B[\"回源预算门\"]\n B --> C[\"数据库最多 3000 QPS\"]\n B --> D[\"陈旧读或快速失败\"]",
    "labels": [
      "无界回源",
      "限制回源"
    ],
    "frames": [
      [
        "缓存=故障",
        "回源请求=100000",
        "数据库容量=3000"
      ],
      [
        "回源请求=100000",
        "数据库=过载"
      ],
      [
        "回源请求=100000",
        "准入配额=3000",
        "数据库=可用"
      ],
      [
        "数据库QPS=3000",
        "降级或拒绝=97000",
        "数据库=受保护"
      ]
    ],
    "quiz": [
      [
        "缓存失效后回源从 1000 增到多少？",
        "100000",
        "3000",
        "无界回源等于总流量。"
      ],
      [
        "预算应在哪里实施？",
        "发起数据库回源之前",
        "数据库崩溃之后",
        "准入保护避免资源已耗尽。"
      ],
      [
        "所有读都能返回旧数据吗？",
        "不能，权限余额有约束",
        "能，缓存本来就是旧的",
        "降级必须遵守业务安全。"
      ],
      [
        "怎么阻止故障扩散？",
        "有界回源、按业务降级和拒绝",
        "无限重试 Redis 再读库",
        "重试也消耗预算。"
      ],
      [
        "请求仅 100 QPS 且库余量万级呢？",
        "可验证后直接回源",
        "永远禁止回源",
        "容量条件已改变。"
      ],
      [
        "缓存恢复立刻全量预热安全吗？",
        "未必，仍须限速",
        "一定安全",
        "预热与在线请求共享数据库。"
      ]
    ],
    "sources": [
      [
        "Redis latency troubleshooting",
        "https://redis.io/docs/latest/operate/oss_and_stack/management/optimization/latency/"
      ]
    ],
    "links": [
      [
        [
          1,
          2,
          "全部直连"
        ]
      ],
      [
        [
          0,
          1,
          "无界回源"
        ]
      ],
      [
        [
          0,
          1,
          "限额"
        ],
        [
          1,
          2,
          "允许部分"
        ]
      ],
      [
        [
          0,
          2,
          "限额内处理"
        ]
      ]
    ],
    "kind": "bars"
  },
  {
    "id": 146,
    "title": "消息重复投递，积分怎么只增加一次？",
    "scene": "支付完成消息因确认丢失被投递两次。消费者每收到一次加 10 分，用户得到 20 分。",
    "constraints": [
      "消息至少一次投递",
      "积分更新和去重标记必须共同提交"
    ],
    "options": [
      [
        "持久 inbox 与积分同事务",
        "重复事件可识别且崩溃安全",
        "去重存储、保留期限成本",
        "副作用同库"
      ],
      [
        "进程内 seen map",
        "实现便宜",
        "重启失效且多实例不共享",
        "仅临时非关键去重"
      ]
    ],
    "answer": "用稳定事件 ID 建唯一记录，与积分更新同事务提交；重复 ID 返回已处理。",
    "failure": "先标已处理再加分会漏处理，先加分后独立标记会重复。",
    "steps": [
      "去重键是事件身份，不是每次投递的新 ID。",
      "写入副作用和 inbox 必须同提交点。",
      "去重保留期覆盖可能重放时间。"
    ],
    "limit": "代码用内存原子步骤模型，生产需持久事务和并发唯一约束。",
    "revisit": "需要超过去重保留期的历史重放。",
    "rule": "去重与副作用一起提交；内存记得不代表重启记得。",
    "flow": "flowchart LR\n A[\"事件 ID\"] --> B[\"事务内唯一检查\"]\n B --> C[\"新增 inbox 与积分\"]\n B --> D[\"重复则不再加分\"]",
    "labels": [
      "每次都加",
      "按事件 ID 去重"
    ],
    "frames": [
      [
        "事件=e1",
        "积分=0",
        "投递次数=1"
      ],
      [
        "事件=e1 重复",
        "积分=20",
        "投递次数=2"
      ],
      [
        "事件=e1",
        "积分=0",
        "seen=空"
      ],
      [
        "seen=e1",
        "积分=10",
        "重复=跳过"
      ]
    ],
    "quiz": [
      [
        "同一支付消息两次都加分会怎样？",
        "重复副作用",
        "broker 自动撤销一次",
        "消费者必须防重复。"
      ],
      [
        "去重记录与加分如何提交？",
        "同事务",
        "独立两次提交",
        "独立提交存在崩溃窗口。"
      ],
      [
        "本地 map 足够应对重启吗？",
        "不够",
        "足够",
        "内存会丢失且进程不共享。"
      ],
      [
        "去重键怎么选？",
        "稳定业务事件 ID",
        "每次收到时的新随机 ID",
        "新随机 ID 无法匹配重投。"
      ],
      [
        "要重放一年数据但去重只保留一周呢？",
        "扩展去重语义或重建专用投影",
        "直接重放到当前积分",
        "历史事件可能再次生效。"
      ],
      [
        "标已处理后崩溃且没加分，错在哪？",
        "两者未原子提交",
        "消息没有再重试",
        "重试看到已处理也会跳过。"
      ]
    ],
    "sources": [
      [
        "RabbitMQ acknowledgements",
        "https://www.rabbitmq.com/docs/confirms"
      ]
    ]
  },
  {
    "id": 147,
    "title": "消费者应该先 ack 还是先提交业务结果？",
    "scene": "发券消费者拿到消息立即 ack，随后数据库写入失败。broker 已删除待确认状态，优惠券永远没发。",
    "constraints": [
      "业务结果需要可靠落库",
      "允许重投但必须幂等"
    ],
    "options": [
      [
        "提交后 ack",
        "处理失败可重投",
        "提交后 ack 前崩溃会重复",
        "配合业务幂等"
      ],
      [
        "收到即 ack",
        "吞吐路径短",
        "处理失败可丢消息",
        "允许丢失的遥测"
      ]
    ],
    "answer": "业务副作用持久提交后确认；确认丢失引发重复由幂等处理。",
    "failure": "ack 是接受处理责任的协议边界，提前确认会失去恢复依据。",
    "steps": [
      "提交失败不 ack，按重试政策处理。",
      "提交成功确认失败，重投不能再执行副作用。",
      "限制未确认数量防止堆积资源。"
    ],
    "limit": "代码为顺序状态模型，不模拟 broker 网络和事务实现。",
    "revisit": "消息变为允许丢失的统计采样。",
    "rule": "先落地，再确认；晚确认靠幂等，早确认靠运气。",
    "flow": "flowchart LR\n A[\"投递\"] --> B[\"幂等业务事务\"]\n B --> C[\"提交成功\"]\n C --> D[\"ack\"]\n B --> E[\"失败保留重试\"]",
    "labels": [
      "先 ack",
      "提交后 ack"
    ],
    "frames": [
      [
        "消息=待处理",
        "业务=未提交",
        "确认=已发送"
      ],
      [
        "业务=失败",
        "待重投=0",
        "结果=丢失"
      ],
      [
        "消息=未确认",
        "业务=尝试提交",
        "结果=失败"
      ],
      [
        "待重投=1",
        "确认=未发送",
        "业务=待重试"
      ]
    ],
    "quiz": [
      [
        "先 ack 后失败有什么问题？",
        "消息可能丢失",
        "broker 必定重新投递",
        "已确认就是解除 broker 的责任。"
      ],
      [
        "正确确认时间？",
        "持久提交业务结果后",
        "刚接收消息时",
        "可靠性依据是完成效果。"
      ],
      [
        "后 ack 能避免一切重复吗？",
        "不能",
        "能",
        "提交后确认前仍有窗口。"
      ],
      [
        "如何修复确认丢失的重投？",
        "业务幂等",
        "收到重复就随机延迟",
        "延迟不消除重复副作用。"
      ],
      [
        "改成允许丢采样遥测呢？",
        "可按约束采用提前确认",
        "仍必须事务 inbox",
        "可靠性需求决定成本。"
      ],
      [
        "一次拉取数万未确认消息有何风险？",
        "内存与处理积压，需 prefetch 限制",
        "只提升吞吐无成本",
        "未完成工作也消耗资源。"
      ]
    ],
    "sources": [
      [
        "RabbitMQ consumer acknowledgements",
        "https://www.rabbitmq.com/docs/confirms"
      ]
    ]
  },
  {
    "id": 148,
    "title": "毒消息重试多少次，什么时候进死信？",
    "scene": "一条非法 JSON 消息每次都会失败，消费者立即重新入队，循环占满 CPU；有效订单被饿死。",
    "constraints": [
      "区分永久格式错误和短暂依赖错误",
      "失败消息可追踪并安全重放"
    ],
    "options": [
      [
        "分类重试与死信",
        "保护正常消息且保留诊断",
        "需死信监控、修复和重放流程",
        "生产消息处理"
      ],
      [
        "所有错误即时重试",
        "逻辑少",
        "毒消息热循环、放大故障",
        "几乎无合理持续运行边界"
      ]
    ],
    "answer": "永久错误直接隔离；暂时错误指数退避、抖动和有界次数，耗尽后死信并告警。",
    "failure": "死信队列无人处理只是把丢失延后，盲目重放仍会循环。",
    "steps": [
      "错误分类独立于尝试次数。",
      "记录事件 ID、失败原因、尝试和原始版本。",
      "修复原因后按限速幂等重放。"
    ],
    "limit": "不能仅凭字符串匹配所有错误，业务明确的不可重试类别需类型化。",
    "revisit": "依赖恢复、消息 schema 修复或死信增长。",
    "rule": "暂错慢重试，永错先隔离；死信必须有人收。",
    "flow": "flowchart TD\n A[\"处理失败\"] --> B[\"判断错误类型\"]\n B --> C[\"暂时错误有界退避\"]\n B --> D[\"永久错误死信\"]\n C --> D\n D --> E[\"修复后限速重放\"]",
    "labels": [
      "即时无限重试",
      "分类有界重试"
    ],
    "frames": [
      [
        "非法消息=解析失败",
        "重试队列=等待",
        "正常订单=100"
      ],
      [
        "非法消息=再次失败",
        "重试队列=立即重入",
        "正常订单=仍等待"
      ],
      [
        "非法消息=永久错误",
        "死信队列=接收",
        "正常订单=100"
      ],
      [
        "死信队列=待修复",
        "正常订单=处理完成",
        "修复后重放=有界"
      ]
    ],
    "quiz": [
      [
        "非法 JSON 无限重试会改善吗？",
        "不会，可能饿死正常消息",
        "会，次数足够就成功",
        "确定性永久错误不随等待消失。"
      ],
      [
        "暂错重试应具备什么？",
        "退避抖动和总预算",
        "毫无间隔无限次",
        "防止同步重试风暴。"
      ],
      [
        "死信等于问题已解决吗？",
        "不等于",
        "等于",
        "仍需诊断和恢复责任。"
      ],
      [
        "怎么修复毒消息循环？",
        "分类隔离并保留事件诊断",
        "加更多相同消费者",
        "扩容只放大无效工作。"
      ],
      [
        "依赖短断 200ms 且错误可重试呢？",
        "预算内退避重试",
        "所有消息立刻永久丢弃",
        "暂时故障值得有限恢复。"
      ],
      [
        "修复 schema 后如何重放百万死信？",
        "幂等且限速",
        "一次全量无界灌入",
        "避免恢复形成第二次故障。"
      ]
    ],
    "sources": [
      [
        "RabbitMQ dead letter exchanges",
        "https://www.rabbitmq.com/docs/dlx"
      ]
    ],
    "links": [
      [
        [
          0,
          1,
          "重新入队"
        ],
        [
          1,
          0,
          "再次处理"
        ]
      ],
      [
        [
          0,
          1,
          "无限循环"
        ],
        [
          1,
          0,
          "无限循环"
        ]
      ],
      [
        [
          0,
          1,
          "隔离"
        ]
      ],
      [
        [
          0,
          2,
          "修复后"
        ]
      ]
    ],
    "kind": "graph"
  },
  {
    "id": 149,
    "title": "订单消息需要全局有序还是按订单有序？",
    "scene": "一个订单必须先创建再付款，不同订单可以并行。全局单队列消费者成为瓶颈。",
    "constraints": [
      "同订单维持顺序",
      "不同订单独立可并行"
    ],
    "options": [
      [
        "按订单键分区",
        "同键有序且跨键并发",
        "热点键和分区数管理",
        "顺序范围是单订单"
      ],
      [
        "全局串行",
        "全局排序简单",
        "吞吐受单执行链限制",
        "确需全局序列的账本"
      ]
    ],
    "answer": "用稳定 order ID 分区并串行处理每个分区；状态版本拒绝重复或过期事件。",
    "failure": "broker 分区有序不自动保证异步 worker 完成顺序，也不保证跨分区顺序。",
    "steps": [
      "明确顺序是投递还是完成顺序。",
      "同键映射稳定，重分区要有迁移策略。",
      "热点订单无法靠更多分区拆开同键串行瓶颈。"
    ],
    "limit": "代码仅展示按键路由，不实现 broker 再均衡和消费提交。",
    "revisit": "业务需要跨订单的全局约束或出现极热 key。",
    "rule": "顺序跟业务键走；分区有序不等于任意 worker 有序。",
    "flow": "flowchart LR\n A[\"订单 A 创建付款\"] --> B[\"分区 0 串行\"]\n C[\"订单 B 创建付款\"] --> D[\"分区 1 串行\"]\n B --> E[\"订单状态机\"]\n D --> E",
    "labels": [
      "全局串行",
      "按订单分区"
    ],
    "frames": [
      [
        "订单A待处理=2",
        "订单B待处理=2",
        "worker=1"
      ],
      [
        "同时执行=1",
        "队列长度=3",
        "顺序=全局"
      ],
      [
        "订单A分区=0",
        "订单B分区=1",
        "worker=2"
      ],
      [
        "同时执行=2",
        "各键顺序=保留",
        "全局顺序=不承诺"
      ]
    ],
    "quiz": [
      [
        "不同订单没有顺序依赖，还要全局串行吗？",
        "不必，可按订单分区",
        "必须",
        "顺序范围决定并发空间。"
      ],
      [
        "分区键应选什么？",
        "稳定订单 ID",
        "每次随机 UUID",
        "同业务对象必须路由同序列。"
      ],
      [
        "异步 worker 会保留完成顺序吗？",
        "不一定",
        "一定跟 broker 一样",
        "并行处理时间不同。"
      ],
      [
        "怎样保护订单状态？",
        "同键串行并检查版本",
        "只靠消息到达时间",
        "重投与乱序需要状态约束。"
      ],
      [
        "若业务要求所有交易的全局编号顺序呢？",
        "评估全局序列瓶颈与设计",
        "照旧按订单无关分区",
        "约束升级改变取舍。"
      ],
      [
        "一个订单占 90% 流量，多加分区有用吗？",
        "对同键串行瓶颈帮助有限",
        "必然线性加速",
        "该 key 仍需有序。"
      ]
    ],
    "sources": [
      [
        "Apache Kafka introduction",
        "https://kafka.apache.org/intro"
      ]
    ]
  },
  {
    "id": 150,
    "title": "迟到的退款事件能覆盖已完成状态吗？",
    "scene": "订单状态事件在不同重试链路乱序到达。版本 3 已退款先到，版本 2 已支付后到；按到达顺序覆盖会回退状态。",
    "constraints": [
      "事件携带单调聚合版本",
      "区分状态快照与必须逐个执行的增量事件"
    ],
    "options": [
      [
        "版本门控快照",
        "拒绝旧状态覆盖",
        "须可靠版本来源",
        "完整状态快照事件"
      ],
      [
        "按序缓冲增量",
        "保留每个增量效果",
        "缺口等待、超时和修复复杂",
        "每一步都不能跳过"
      ]
    ],
    "answer": "完整快照只接受更高版本；增量事件遇到缺口需缓冲或回补，不能直接丢掉所有旧事件。",
    "failure": "把丢弃迟到快照的规则套到扣款增量上会漏账。",
    "steps": [
      "事件时间、到达时间和业务版本含义不同。",
      "相同版本重复不能再次施加副作用。",
      "版本缺口和长迟到要有核对路径。"
    ],
    "limit": "代码仅适用完整状态快照，不能用于必须逐条相加的账务流。",
    "revisit": "事件从快照变为增量，或多写者无法分配统一版本。",
    "rule": "快照比版本，增量补缺口；晚到不等于无价值。",
    "flow": "flowchart LR\n A[\"事件版本\"] --> B[\"与当前版本比较\"]\n B --> C[\"更高快照覆盖\"]\n B --> D[\"旧快照拒绝\"]\n E[\"增量流\"] --> F[\"缺口缓冲与回补\"]",
    "labels": [
      "按到达覆盖",
      "版本门控"
    ],
    "frames": [
      [
        "当前版本=3",
        "状态=已退款",
        "迟到版本=2"
      ],
      [
        "当前版本=2",
        "状态=已支付",
        "回退=发生"
      ],
      [
        "当前版本=3",
        "事件版本=2",
        "检查=版本比较"
      ],
      [
        "当前版本=3",
        "状态=已退款",
        "迟到快照=拒绝"
      ]
    ],
    "quiz": [
      [
        "v3 后到 v2 并直接覆盖风险？",
        "状态回退",
        "自然保持最新",
        "到达顺序不是业务顺序。"
      ],
      [
        "快照接收判断是什么？",
        "事件版本高于当前",
        "服务器当前时间较晚",
        "业务版本表达因果次序。"
      ],
      [
        "同一规则能用于每笔扣款增量吗？",
        "不能，旧增量也可能必须应用",
        "能，旧的一律无价值",
        "快照和增量语义不同。"
      ],
      [
        "遇到增量版本缺口怎样修？",
        "缓冲或回补并核对",
        "直接跳到最大版本",
        "跳过会漏掉副作用。"
      ],
      [
        "改成完整库存快照且单写者版本递增呢？",
        "可以拒绝旧快照",
        "必须把所有旧快照相加",
        "快照本身已包含前序结果。"
      ],
      [
        "两个源都自称版本 5，应该怎样做？",
        "先定义统一版本或冲突规则",
        "随便先到为准并声称正确",
        "版本比较依赖可比较的版本来源。"
      ]
    ],
    "sources": [
      [
        "Apache Kafka design",
        "https://kafka.apache.org/design/"
      ]
    ]
  }
];
export default seeds.map(s=>make({...s,code:codes[s.id]})) satisfies Lesson[];
