import {architectureLesson} from '../architecture-builder';
import {q,frame,experiment} from '../builders';
import type {Lesson} from '../types';
type QA=[string,string,string,string];
type Seed={id:number;title:string;scene:string;constraints:string[];options:[string,string,string,string][];answer:string;failure:string;steps:string[];limit:string;revisit:string;rule:string;flow:string;labels:[string,string];frames:[string[],string[],string[],string[]];quiz:QA[];sources:[string,string][];code?:CodeSpec;links?:[number,number,string][][];kind?:'bars'|'graph'|'timeline'};
type CodeSpec={starter:string;solution:string;starterOutput:string;expectedOutput:string;testCode:string};
function make(s:Seed){const stages=s.frames.map((values,i)=>{const f=frame(i%2?'观察结果':'进入场景',i%2?s.answer:s.labels[Math.floor(i/2)],values,i%2?Math.min(1,values.length-1):0);f.edges=(s.links?.[i]??[]).map(([a,b,label])=>({from:`n${a}`,to:`n${b}`,label}));return f;});return architectureLesson({id:s.id,title:s.title,scenario:s.scene,constraints:s.constraints,options:s.options.map(([title,benefits,costs,when])=>({title,benefits,costs,when})),recommendation:s.answer,pitfall:s.failure,mechanism:s.steps,boundary:s.limit,revisitWhen:[s.revisit],mnemonic:s.rule,sources:s.sources.map(([title,url])=>({title,url})),diagram:[{title:s.title,kind:'flow',source:s.flow,caption:s.steps.join('；')}],experiment:experiment(s.kind??'bars','资源与状态实验','逐步观察状态变化，再切换条件。数值为确定性教学模型，不代表真实系统压测。',[stages[0],stages[1]],[stages[2],stages[3]],s.labels),quizzes:s.quiz.map(x=>q(...x)),code:s.code});}

const codes:Record<number,CodeSpec>={
  "131": {
    "starter": "package main\n\nimport (\n\t\"fmt\"\n)\n\nfunc budget(total, reserve, n int) int {\n\tif n <= 0 || total <= reserve {\n\t\treturn 0\n\t}\n\treturn total / n\n}\nfunc solve() string { return fmt.Sprint(budget(240, 60, 12)) }\nfunc main()         { fmt.Println(solve()) }\n",
    "solution": "package main\n\nimport (\n\t\"fmt\"\n)\n\nfunc budget(total, reserve, n int) int {\n\tif n <= 0 || total <= reserve {\n\t\treturn 0\n\t}\n\treturn (total - reserve) / n\n}\nfunc solve() string { return fmt.Sprint(budget(240, 60, 12)) }\nfunc main()         { fmt.Println(solve()) }\n",
    "starterOutput": "20",
    "expectedOutput": "15",
    "testCode": "package main\n\nimport \"testing\"\n\nfunc TestBehavior(t *testing.T) {\n\tfor _, c := range []struct{ total, reserve, n, want int }{{240, 60, 12, 15}, {240, 60, 15, 12}, {120, 20, 5, 20}, {50, 60, 2, 0}, {240, 60, 0, 0}} {\n\t\tif got := budget(c.total, c.reserve, c.n); got != c.want {\n\t\t\tt.Fatalf(\"%+v got %d\", c, got)\n\t\t}\n\t}\n}\nfunc TestSolution(t *testing.T) {\n\tif got := solve(); got != \"15\" {\n\t\tt.Fatal(got)\n\t}\n}\nfunc BenchmarkSolution(b *testing.B) {\n\tfor i := 0; i < b.N; i++ {\n\t\t_ = solve()\n\t}\n}\n"
  },
  "132": {
    "starter": "package main\n\nimport (\n\t\"fmt\"\n)\n\nfunc update(current, want int) (int, bool) { return current + 1, true }\nfunc solve() string {\n\tv, _ := update(7, 7)\n\tv, ok := update(v, 7)\n\treturn fmt.Sprintf(\"%d %t\", v, ok)\n}\nfunc main() { fmt.Println(solve()) }\n",
    "solution": "package main\n\nimport (\n\t\"fmt\"\n)\n\nfunc update(current, want int) (int, bool) {\n\tif current != want {\n\t\treturn current, false\n\t}\n\treturn current + 1, true\n}\nfunc solve() string {\n\tv, _ := update(7, 7)\n\tv, ok := update(v, 7)\n\treturn fmt.Sprintf(\"%d %t\", v, ok)\n}\nfunc main() { fmt.Println(solve()) }\n",
    "starterOutput": "9 true",
    "expectedOutput": "8 false",
    "testCode": "package main\n\nimport \"testing\"\n\nfunc TestBehavior(t *testing.T) {\n\tfor _, c := range []struct {\n\t\tcurrent, want, next int\n\t\tok                  bool\n\t}{{8, 7, 8, false}, {8, 8, 9, true}, {42, 40, 42, false}, {0, 0, 1, true}} {\n\t\tv, ok := update(c.current, c.want)\n\t\tif v != c.next || ok != c.ok {\n\t\t\tt.Fatal(c, v, ok)\n\t\t}\n\t}\n}\nfunc TestSolution(t *testing.T) {\n\tif got := solve(); got != \"8 false\" {\n\t\tt.Fatal(got)\n\t}\n}\nfunc BenchmarkSolution(b *testing.B) {\n\tfor i := 0; i < b.N; i++ {\n\t\t_ = solve()\n\t}\n}\n"
  },
  "133": {
    "starter": "package main\n\nimport (\n\t\"fmt\"\n)\n\nfunc transfer(a, b, n int, secondFails bool) (int, int) {\n\tif n < 0 || a < n {\n\t\treturn a, b\n\t}\n\tnextA := a - n\n\tif secondFails {\n\t\treturn nextA, b\n\t}\n\treturn nextA, b + n\n}\nfunc solve() string {\n\ta, b := transfer(100, 20, 30, true)\n\treturn fmt.Sprintf(\"%d %d\", a, b)\n}\nfunc main() { fmt.Println(solve()) }\n",
    "solution": "package main\n\nimport (\n\t\"fmt\"\n)\n\nfunc transfer(a, b, n int, secondFails bool) (int, int) {\n\tif n < 0 || a < n {\n\t\treturn a, b\n\t}\n\tnextA := a - n\n\tif secondFails {\n\t\treturn a, b\n\t}\n\treturn nextA, b + n\n}\nfunc solve() string {\n\ta, b := transfer(100, 20, 30, true)\n\treturn fmt.Sprintf(\"%d %d\", a, b)\n}\nfunc main() { fmt.Println(solve()) }\n",
    "starterOutput": "70 20",
    "expectedOutput": "100 20",
    "testCode": "package main\n\nimport \"testing\"\n\nfunc TestBehavior(t *testing.T) {\n\tfor _, c := range []struct {\n\t\ta, b, n int\n\t\tfail    bool\n\t\twa, wb  int\n\t}{{100, 20, 30, true, 100, 20}, {100, 20, 30, false, 70, 50}, {10, 20, 30, false, 10, 20}, {70, 9, 5, true, 70, 9}, {40, 2, -1, false, 40, 2}} {\n\t\ta, b := transfer(c.a, c.b, c.n, c.fail)\n\t\tif a != c.wa || b != c.wb || a+b != c.a+c.b {\n\t\t\tt.Fatal(c, a, b)\n\t\t}\n\t}\n}\nfunc TestSolution(t *testing.T) {\n\tif got := solve(); got != \"100 20\" {\n\t\tt.Fatal(got)\n\t}\n}\nfunc BenchmarkSolution(b *testing.B) {\n\tfor i := 0; i < b.N; i++ {\n\t\t_ = solve()\n\t}\n}\n"
  },
  "135": {
    "starter": "package main\n\nimport (\n\t\"fmt\"\n)\n\nfunc commitOrders(ids []string, fail bool) (map[string]bool, []string) {\n\torders := map[string]bool{}\n\tvar events []string\n\tif fail {\n\t\treturn orders, events\n\t}\n\tfor _, id := range ids {\n\t\torders[id] = true\n\t}\n\treturn orders, events\n}\nfunc solve() string {\n\torders, events := commitOrders([]string{\"o1\"}, false)\n\treturn fmt.Sprintf(\"%t %d\", orders[\"o1\"], len(events))\n}\nfunc main() { fmt.Println(solve()) }\n",
    "solution": "package main\n\nimport (\n\t\"fmt\"\n)\n\nfunc commitOrders(ids []string, fail bool) (map[string]bool, []string) {\n\torders := map[string]bool{}\n\tvar events []string\n\tif fail {\n\t\treturn orders, events\n\t}\n\tfor _, id := range ids {\n\t\tif orders[id] {\n\t\t\tcontinue\n\t\t}\n\t\torders[id] = true\n\t\tevents = append(events, id)\n\t}\n\treturn orders, events\n}\nfunc solve() string {\n\torders, events := commitOrders([]string{\"o1\"}, false)\n\treturn fmt.Sprintf(\"%t %d\", orders[\"o1\"], len(events))\n}\nfunc main() { fmt.Println(solve()) }\n",
    "starterOutput": "true 0",
    "expectedOutput": "true 1",
    "testCode": "package main\n\nimport \"testing\"\n\nfunc TestBehavior(t *testing.T) {\n\tfor _, ids := range [][]string{{\"a\"}, {\"a\", \"b\", \"a\"}, {\"z\", \"q\", \"r\"}, nil} {\n\t\torders, events := commitOrders(ids, false)\n\t\tseen := map[string]bool{}\n\t\tfor _, id := range events {\n\t\t\tif seen[id] || !orders[id] {\n\t\t\t\tt.Fatal(\"invalid event\", id)\n\t\t\t}\n\t\t\tseen[id] = true\n\t\t}\n\t\tfor _, id := range ids {\n\t\t\tif !orders[id] || !seen[id] {\n\t\t\t\tt.Fatal(\"missing order/event\", id)\n\t\t\t}\n\t\t}\n\t}\n\torders, events := commitOrders([]string{\"a\", \"b\"}, true)\n\tif len(orders) != 0 || len(events) != 0 {\n\t\tt.Fatal(\"rollback\")\n\t}\n}\nfunc TestSolution(t *testing.T) {\n\tif got := solve(); got != \"true 1\" {\n\t\tt.Fatal(got)\n\t}\n}\nfunc BenchmarkSolution(b *testing.B) {\n\tfor i := 0; i < b.N; i++ {\n\t\t_ = solve()\n\t}\n}\n"
  },
  "139": {
    "starter": "package main\n\nimport (\n\t\"fmt\"\n)\n\nfunc batches(total, size int) []int {\n\tif total <= 0 || size <= 0 {\n\t\treturn nil\n\t}\n\treturn []int{total}\n}\nfunc solve() string { return fmt.Sprint(batches(8, 3)) }\nfunc main()         { fmt.Println(solve()) }\n",
    "solution": "package main\n\nimport (\n\t\"fmt\"\n)\n\nfunc batches(total, size int) []int {\n\tif total <= 0 || size <= 0 {\n\t\treturn nil\n\t}\n\tvar out []int\n\tfor total > 0 {\n\t\tn := size\n\t\tif total < n {\n\t\t\tn = total\n\t\t}\n\t\tout = append(out, n)\n\t\ttotal -= n\n\t}\n\treturn out\n}\nfunc solve() string { return fmt.Sprint(batches(8, 3)) }\nfunc main()         { fmt.Println(solve()) }\n",
    "starterOutput": "[8]",
    "expectedOutput": "[3 3 2]",
    "testCode": "package main\n\nimport \"testing\"\n\nfunc TestBehavior(t *testing.T) {\n\tfor _, c := range []struct{ total, size int }{{8, 3}, {19, 4}, {2, 10}, {10, 1}} {\n\t\tsum := 0\n\t\tfor _, n := range batches(c.total, c.size) {\n\t\t\tif n <= 0 || n > c.size {\n\t\t\t\tt.Fatal(\"unbounded batch\", c, n)\n\t\t\t}\n\t\t\tsum += n\n\t\t}\n\t\tif sum != c.total {\n\t\t\tt.Fatal(\"lost rows\", c, sum)\n\t\t}\n\t}\n\tif len(batches(5, 0)) != 0 || len(batches(0, 3)) != 0 {\n\t\tt.Fatal(\"boundary\")\n\t}\n}\nfunc TestSolution(t *testing.T) {\n\tif got := solve(); got != \"[3 3 2]\" {\n\t\tt.Fatal(got)\n\t}\n}\nfunc BenchmarkSolution(b *testing.B) {\n\tfor i := 0; i < b.N; i++ {\n\t\t_ = solve()\n\t}\n}\n"
  }
};
const seeds:Seed[]=[
  {
    "id": 131,
    "title": "扩容到 12 个副本后，连接池该设多大？",
    "scene": "订单服务从 6 扩到 12 副本。数据库连接上限 240，其他服务与运维预留 60；旧配置每实例 30 个连接。",
    "constraints": [
      "按最大副本数含滚动发布 surge 预算",
      "池大小受数据库容量和请求等待双重约束"
    ],
    "options": [
      [
        "每实例 15 个",
        "全局不超过 180 个业务连接",
        "高峰可能排队",
        "数据库预算固定"
      ],
      [
        "每实例 30 个",
        "单实例并发余量大",
        "12 副本可能占 360 个",
        "数据库预算已扩大并压测"
      ]
    ],
    "answer": "先按 (240−60)/12=15 设上限，再观察连接等待、事务时长和数据库负载。",
    "failure": "每进程连接池不会自动协调全局，扩容会倍增连接。",
    "steps": [
      "SetMaxOpenConns 约束单个 sql.DB。",
      "计算发布峰值副本和全部池的总和。",
      "限制连接后须防止事务持连接又向 DB 借连接。"
    ],
    "limit": "预算上限不代表性能最优值；此代码只算容量，不压测数据库。",
    "revisit": "副本峰值、预留连接或数据库容量变化。",
    "rule": "先算全局账，再调本地池；不过额不等于低延迟。",
    "flow": "flowchart LR\n A[\"12 个副本\"] --> B[\"每池 15\"]\n B --> C[\"业务 180\"]\n C --> D[\"数据库上限 240\"]\n E[\"预留 60\"] --> D",
    "labels": [
      "旧池 30",
      "预算池 15"
    ],
    "frames": [
      [
        "副本=6",
        "每池=30",
        "连接=180"
      ],
      [
        "副本=12",
        "每池=30",
        "连接=360"
      ],
      [
        "副本=12",
        "每池=15",
        "连接=180"
      ],
      [
        "副本=12",
        "每池=15",
        "连接=180",
        "预留=60"
      ]
    ],
    "quiz": [
      [
        "旧配置扩到 12 副本的理论连接数？",
        "360",
        "180",
        "池按进程叠加。"
      ],
      [
        "扣除预留后每副本预算？",
        "15",
        "20",
        "180 除以 12。"
      ],
      [
        "连接不超预算就能保证 P99 吗？",
        "不能，还需测量排队和执行",
        "能，不超额就是充足",
        "容量约束不同于延迟目标。"
      ],
      [
        "滚动发布最多 15 副本，应怎样修正？",
        "按 15 副本算每池 12",
        "保持每池 15",
        "短时副本同样持有连接。"
      ],
      [
        "最多只有 6 副本且预算不变呢？",
        "每池预算最多 30",
        "仍必须 15",
        "最大并发实例减少改变上限。"
      ],
      [
        "另一服务再占 60，本服务 12 副本，预算？",
        "每池 10",
        "每池 15",
        "剩余业务容量 120。"
      ]
    ],
    "sources": [
      [
        "Go connection management",
        "https://go.dev/doc/database/manage-connections"
      ]
    ]
  },
  {
    "id": 132,
    "title": "低冲突库存编辑用乐观锁还是悲观锁？",
    "scene": "两位运营偶尔同时基于版本 7 编辑商品库存说明；无条件 UPDATE 会覆盖另一人的修改。",
    "constraints": [
      "冲突率低，可重新加载",
      "版本比较和更新必须原子"
    ],
    "options": [
      [
        "版本条件更新",
        "不长期持锁",
        "冲突需重读和合并",
        "低冲突"
      ],
      [
        "短事务行锁",
        "把热点修改串行化",
        "等待与死锁成本",
        "高冲突且事务短"
      ]
    ],
    "answer": "WHERE version=? 更新并检查受影响行数；冲突重新读取后重算。",
    "failure": "仅展示版本号却无条件写入，没有并发保护。",
    "steps": [
      "比较和写入是同一个原子操作。",
      "零行更新不能当成功。",
      "旧值换新版本号重发会覆盖有效修改。"
    ],
    "limit": "代码模拟 CAS 结果，不模拟数据库锁与并发。",
    "revisit": "冲突率与重试成本显著增长。",
    "rule": "低冲突比版本，高冲突算锁账；重试要重读。",
    "flow": "flowchart LR\n A[\"读版本 7\"] --> B[\"条件更新版本 7\"]\n B --> C[\"提交版本 8\"]\n D[\"另一份版本 7\"] --> E[\"冲突后重读\"]",
    "labels": [
      "无条件覆盖",
      "检查版本"
    ],
    "frames": [
      [
        "版本=7",
        "甲=7",
        "乙=7"
      ],
      [
        "甲提交=8",
        "乙覆盖=9",
        "冲突=隐藏"
      ],
      [
        "版本=7",
        "甲期望=7",
        "乙期望=7"
      ],
      [
        "版本=8",
        "甲=成功",
        "乙=冲突"
      ]
    ],
    "quiz": [
      [
        "旧版本无条件写入风险？",
        "后写覆盖先写",
        "数据库自动合并",
        "必须用条件保护。"
      ],
      [
        "条件更新成功判据？",
        "检查影响行数",
        "没有语法错误即可",
        "零行更新可没有 SQL 错误。"
      ],
      [
        "模型能证明数据库隔离行为吗？",
        "不能，需目标库测试",
        "能覆盖所有数据库",
        "内存逻辑不等于数据库实现。"
      ],
      [
        "冲突后如何处理？",
        "重读并重新计算或合并",
        "旧值换新版本号重发",
        "输入依据已过期。"
      ],
      [
        "每秒上千次争抢同一行时呢？",
        "评估短事务锁或业务串行化",
        "无限立即乐观重试",
        "高冲突会放大工作。"
      ],
      [
        "修改账户名返回零行但无错误，能报成功？",
        "不能，区分冲突与不存在",
        "能，无 SQL 错误就是成功",
        "检查业务条件。"
      ]
    ],
    "sources": [
      [
        "Go database/sql",
        "https://pkg.go.dev/database/sql"
      ],
      [
        "PostgreSQL explicit locking",
        "https://www.postgresql.org/docs/current/explicit-locking.html"
      ]
    ]
  },
  {
    "id": 133,
    "title": "扣款和入账应在哪层开启事务？",
    "scene": "同库转账：扣 A 30 元后，加 B 失败。两个仓储各自提交，导致总余额减少。",
    "constraints": [
      "同一数据库中保护总余额",
      "提交错误不得报告成功"
    ],
    "options": [
      [
        "用例层事务",
        "覆盖完整资金不变量",
        "仓储需共用 Tx",
        "同库业务原子操作"
      ],
      [
        "仓储各自提交",
        "单方法封装直接",
        "跨方法不变量无保障",
        "操作确实独立"
      ]
    ],
    "answer": "转账用例持有 Tx，全部读写使用同一个 Tx，全部成功才提交。",
    "failure": "事务中调用全局 DB 写入逃出事务，或把外部网络调用包进长事务。",
    "steps": [
      "事务边界跟随业务不变量。",
      "失败回滚，提交错误核对结果。",
      "外部通知由可靠事件衔接。"
    ],
    "limit": "代码是 copy-on-write 事务模型，不能验证真实提交不确定性。",
    "revisit": "账户拆到不同数据库。",
    "rule": "一条不变量一笔事务；外部世界不受本地回滚控制。",
    "flow": "flowchart TD\n A[\"BeginTx\"] --> B[\"扣 A\"]\n B --> C[\"加 B\"]\n C --> D[\"全部成功 Commit\"]\n B --> E[\"失败 Rollback\"]\n C --> E",
    "labels": [
      "逐项提交",
      "同一事务"
    ],
    "frames": [
      [
        "A=100",
        "B=20",
        "转账=30"
      ],
      [
        "A=70",
        "B=20",
        "总额=90"
      ],
      [
        "原 A=100",
        "草稿=70 和 50",
        "第二步=失败"
      ],
      [
        "A=100",
        "B=20",
        "总额=120"
      ]
    ],
    "quiz": [
      [
        "第二笔失败且各自提交会怎样？",
        "破坏总余额",
        "第一笔自动回滚",
        "独立提交没有原子关系。"
      ],
      [
        "谁决定事务范围？",
        "完整转账用例",
        "每个 SQL 方法单独决定",
        "需要同时覆盖两次写。"
      ],
      [
        "Rollback 能撤销外部已扣款吗？",
        "不能",
        "能广播给外部系统",
        "本地事务没有该能力。"
      ],
      [
        "怎样防止第二笔逃出事务？",
        "传递相同 Tx",
        "继续用全局 DB.Exec",
        "后者可能借另一连接。"
      ],
      [
        "迁成两个数据库如何调整？",
        "跨库业务流程与补偿",
        "一个 sql.Tx 传给两库",
        "单库事务不能跨库。"
      ],
      [
        "Commit 报错应如何答复？",
        "核对结果，不声称确定成功",
        "直接返回成功",
        "提交错误可能需要业务键核对。"
      ]
    ],
    "sources": [
      [
        "Go transactions",
        "https://go.dev/doc/database/execute-transactions"
      ]
    ]
  },
  {
    "id": 134,
    "title": "两位值班医生同时下线，事务为何没守住业务？",
    "scene": "至少一位医生必须在线。甲乙事务都读到两人在线，再各自更新不同的医生行，最终零人在线。",
    "constraints": [
      "跨行至少一位在线不变量",
      "PostgreSQL READ COMMITTED + 共同排班行锁，或 SERIALIZABLE + 完整事务重试"
    ],
    "options": [
      [
        "串行化事务并重试",
        "检测无法串行化的执行",
        "中止与完整事务重试成本",
        "跨行谓词约束"
      ],
      [
        "READ COMMITTED 下共同排班行锁",
        "每位写者按同一锁协议串行检查",
        "全部写路径须遵守，锁后另发新 SQL 重读",
        "已验证语句级新快照且共同锁先于判断"
      ]
    ],
    "answer": "采用 SERIALIZABLE 并完整事务重试；或明确用 READ COMMITTED，先锁共同排班行，再用新的 SQL 语句重读在线人数后修改。",
    "failure": "REPEATABLE READ 中等待锁不会刷新事务快照；仅锁不更新共同排班行，锁后仍可能看见旧人数。",
    "steps": [
      "跨行判断需要共同协调点，不能只锁自己的医生行。",
      "PostgreSQL READ COMMITTED 下先锁共同排班行，随后新语句重读才能看到前一个事务提交。",
      "REPEATABLE READ 的旧快照不因等待自动更新；可改 SERIALIZABLE 完整重试，或设计共同版本写入以产生冲突。"
    ],
    "limit": "必须在目标数据库与确切隔离级别测试；不能把同名隔离级别或锁等待等同于获得新快照。",
    "revisit": "约束可变成单行条件更新或允许零在线。",
    "rule": "先说不变量，再选隔离；不同行也能互相冲突。",
    "flow": "flowchart LR\n A[\"甲读 2\"] --> C[\"甲下线\"]\n B[\"乙读 2\"] --> D[\"乙下线\"]\n C --> E[\"在线 0\"]\n D --> E",
    "labels": [
      "各自判断",
      "共同约束锁"
    ],
    "frames": [
      [
        "医生甲=在线",
        "医生乙=在线",
        "排班=至少一位在线"
      ],
      [
        "医生甲=离线",
        "医生乙=离线",
        "在线人数=0"
      ],
      [
        "排班锁=甲持有",
        "医生甲=在线",
        "医生乙=等待"
      ],
      [
        "医生甲=离线",
        "医生乙=保持在线",
        "在线人数=1"
      ]
    ],
    "quiz": [
      [
        "修改不同的行还可能什么问题？",
        "写偏差",
        "必然安全",
        "业务谓词横跨多行。"
      ],
      [
        "共同排班行锁方案在本题如何保证看见甲已下线？",
        "READ COMMITTED 下拿锁后另发 SQL 重读",
        "REPEATABLE READ 下等待完锁就自动刷新快照",
        "锁等待不刷新事务快照，READ COMMITTED 后续语句才获取新快照。"
      ],
      [
        "Serializable 后能删重试逻辑吗？",
        "不能",
        "能，数据库无限重试",
        "冲突可中止事务。"
      ],
      [
        "只锁自己那行怎样修复？",
        "SERIALIZABLE 完整重试，或按明确新快照协议锁共同记录再重读",
        "在 REPEATABLE READ 中仅锁共同记录就一定安全",
        "仅锁不写的共同记录不会保证刷新旧事务快照。"
      ],
      [
        "改为一行库存大于零才能扣减呢？",
        "条件 UPDATE 并检查行数",
        "必须继续锁全表",
        "单行可以原子判断。"
      ],
      [
        "不同会议室共享总预算，分行写就安全吗？",
        "仍需保护总预算",
        "一定安全",
        "聚合约束并不独立。"
      ]
    ],
    "sources": [
      [
        "PostgreSQL isolation",
        "https://www.postgresql.org/docs/current/transaction-iso.html"
      ]
    ],
    "links": [
      [
        [
          0,
          2,
          "读取"
        ],
        [
          1,
          2,
          "读取"
        ]
      ],
      [],
      [
        [
          0,
          1,
          "授权"
        ],
        [
          2,
          0,
          "等待"
        ]
      ],
      [
        [
          0,
          2,
          "统计"
        ],
        [
          1,
          2,
          "统计"
        ]
      ]
    ],
    "kind": "graph"
  },
  {
    "id": 135,
    "title": "订单提交后消息丢了，Outbox 补上哪个窗口？",
    "scene": "订单提交成功后进程在发仓库消息前崩溃。订单存在但仓库始终收不到事件。",
    "constraints": [
      "接受消息延迟和重复",
      "订单与待发送事件可同库提交"
    ],
    "options": [
      [
        "事务 Outbox",
        "业务与发送依据一起落库",
        "投递、清理与幂等成本",
        "关键可靠通知"
      ],
      [
        "直接双写",
        "正常路径短",
        "崩溃窗口可丢消息",
        "尽力通知可丢失"
      ]
    ],
    "answer": "订单和 Outbox 同事务写；投递器重试，消费者按事件 ID 幂等。",
    "failure": "发送成功但标记前崩溃仍会重复，Outbox 不等于端到端恰好一次。",
    "steps": [
      "同事务消除有订单无发送依据。",
      "投递确认与标记仍有重复窗口。",
      "监测积压及最老事件年龄。"
    ],
    "limit": "代码仅模拟事务记录存在性，不模拟 WAL 与消息 broker。",
    "revisit": "投递延迟超过业务 SLO。",
    "rule": "一起落库，重复可认；Outbox 仍需幂等。",
    "flow": "flowchart LR\n A[\"本地事务\"] --> B[\"订单\"]\n A --> C[\"Outbox\"]\n C --> D[\"重试投递\"]\n D --> E[\"幂等消费者\"]",
    "labels": [
      "提交后发送",
      "事务 Outbox"
    ],
    "frames": [
      [
        "订单=未提交",
        "事件=无",
        "进程=运行"
      ],
      [
        "订单=已提交",
        "事件=丢失",
        "进程=崩溃"
      ],
      [
        "订单草稿=有",
        "事件草稿=有",
        "事务=提交"
      ],
      [
        "订单=已提交",
        "事件=待投递",
        "重启=继续发送"
      ]
    ],
    "quiz": [
      [
        "提交后崩溃的风险？",
        "永久缺消息",
        "broker 自动查订单表",
        "不存在共同提交点。"
      ],
      [
        "Outbox 和什么同事务？",
        "业务记录",
        "消费日志",
        "必须同时留下发送依据。"
      ],
      [
        "它保证只投递一次吗？",
        "不能",
        "能，ID 唯一就足够",
        "消费者需真正去重。"
      ],
      [
        "发送成功却未标记后重放怎么办？",
        "消费端事件 ID 幂等",
        "删除全部待发事件",
        "未知状态不能直接丢弃。"
      ],
      [
        "可丢的在线提示应如何选？",
        "可考虑尽力发送",
        "必须建复杂 Outbox",
        "复杂度匹配可靠性要求。"
      ],
      [
        "一天没发货但进程健康，先看什么？",
        "最老未投递年龄与积压",
        "仅存活探针",
        "业务链路有独立时效。"
      ]
    ],
    "sources": [
      [
        "AWS transactional outbox",
        "https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html"
      ]
    ]
  },
  {
    "id": 136,
    "title": "订票失败时，补偿为什么不是数据库回滚？",
    "scene": "先锁酒店再订机票，机票售罄需释放酒店；释放接口暂时失败，进程还可能重启。",
    "constraints": [
      "无共同数据库",
      "补偿需持久化、幂等与人工兜底"
    ],
    "options": [
      [
        "持久化 Saga",
        "可恢复步骤和补偿进度",
        "状态机和运营复杂度",
        "跨服务长流程"
      ],
      [
        "同步顺序调用",
        "简单直接",
        "崩溃可能丢补偿",
        "小量业务可人工补救"
      ]
    ],
    "answer": "持久化步骤、未知结果与补偿待办；重试失败转人工，未补偿不宣称完全取消。",
    "failure": "补偿不能抹去短信、手续费或价格变化。",
    "steps": [
      "用业务键核对超时后真实结果。",
      "每步及补偿都需幂等。",
      "记录责任人和超期处理路径。"
    ],
    "limit": "不可逆操作要前置确认或人工流程。",
    "revisit": "补偿失败和人工积压超预算。",
    "rule": "长流程记状态，补偿记欠账；反向调用不是倒带。",
    "flow": "flowchart TD\n A[\"酒店已锁\"] --> B[\"机票失败\"]\n B --> C[\"补偿待办\"]\n C --> D[\"重试释放\"]\n D --> E[\"已取消或人工处理\"]",
    "labels": [
      "内存补偿",
      "持久化补偿"
    ],
    "frames": [
      [
        "酒店=已锁",
        "航班=失败",
        "补偿=仅内存"
      ],
      [
        "酒店=仍占用",
        "进程=重启"
      ],
      [
        "酒店=已锁",
        "航班=失败",
        "补偿待办=持久化"
      ],
      [
        "酒店=已释放",
        "订单=已取消",
        "补偿待办=完成"
      ]
    ],
    "quiz": [
      [
        "释放失败能称完全取消吗？",
        "不能",
        "可以，已发送请求",
        "请求不等于成功。"
      ],
      [
        "持久化主要解决什么？",
        "崩溃恢复和结果核对",
        "跨库原子提交",
        "Saga 不是数据库锁。"
      ],
      [
        "能补偿已发送短信吗？",
        "不能撤回现实影响",
        "能调用反向接口",
        "外部动作可能不可逆。"
      ],
      [
        "持续补偿失败怎么办？",
        "有界重试并转人工",
        "隐藏异常订单",
        "异常需要可见责任路径。"
      ],
      [
        "操作都迁回同库且很短，优先考虑？",
        "本地事务",
        "永久保留复杂 Saga",
        "边界改变可简化。"
      ],
      [
        "供应商超时但可能已预订，下一步？",
        "按业务键查询",
        "换新 ID 再订",
        "避免重复副作用。"
      ]
    ],
    "sources": [
      [
        "AWS Saga",
        "https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/saga-orchestration.html"
      ]
    ],
    "links": [
      [
        [
          1,
          2,
          "触发"
        ],
        [
          2,
          0,
          "准备释放"
        ]
      ],
      [],
      [
        [
          1,
          2,
          "触发"
        ],
        [
          2,
          0,
          "可恢复重试"
        ]
      ],
      [
        [
          2,
          0,
          "释放成功"
        ],
        [
          0,
          1,
          "确认终态"
        ]
      ]
    ],
    "kind": "graph"
  },
  {
    "id": 137,
    "title": "刚保存却读到旧昵称，如何实现读己之写？",
    "scene": "更新昵称后详情请求落在延迟 2 秒的副本，用户看到旧值再次保存；普通公开列表允许旧数据。",
    "constraints": [
      "自己的写后详情立即可见",
      "其他列表允许短时陈旧"
    ],
    "options": [
      [
        "写后读主库",
        "简单明确",
        "主库读压力",
        "写后敏感请求少"
      ],
      [
        "携带提交位点等副本",
        "精确到某次写入",
        "依赖数据库能力及超时回退",
        "副本提供可靠位点"
      ]
    ],
    "answer": "详情按写后标记读主库或等待提交位点；普通列表继续副本。",
    "failure": "把复制正常当零延迟，固定 sleep 也无法保证尾部。",
    "steps": [
      "主库提交不等于副本已应用。",
      "一致性按请求承诺。",
      "等待超时回主库或明确失败。"
    ],
    "limit": "固定粘主窗口只有假设内保障，跨设备也需考虑。",
    "revisit": "复制尾延迟或主库容量变化。",
    "rule": "自己的新写先确认；平均延迟不是上界。",
    "flow": "flowchart LR\n A[\"写主库 v9\"] --> B[\"详情至少 v9\"]\n B --> C[\"主库或等待位点\"]\n D[\"普通列表\"] --> E[\"副本 v8 可接受\"]",
    "labels": [
      "立即读副本",
      "写后读主"
    ],
    "frames": [
      [
        "主库=v9",
        "副本=v8",
        "详情=待查询"
      ],
      [
        "主库=v9",
        "副本=v8",
        "详情=旧昵称"
      ],
      [
        "主库=v9",
        "副本=v8",
        "详情=写后标记"
      ],
      [
        "主库=v9",
        "副本=v8",
        "详情=新昵称"
      ]
    ],
    "quiz": [
      [
        "保存成功为何读旧？",
        "副本没应用提交",
        "保存必然是假成功",
        "异步复制允许时间差。"
      ],
      [
        "一致性应绑定什么？",
        "请求所需版本",
        "全站永久读主",
        "按实际需求区分。"
      ],
      [
        "固定睡 2 秒保证任何情况吗？",
        "不保证",
        "保证，平均是 2 秒",
        "平均不代表最大。"
      ],
      [
        "等位点超时怎么办？",
        "预算内回主库或报失败",
        "返回旧值却标一致",
        "不能悄悄降低承诺。"
      ],
      [
        "公开榜单允许 30 秒旧数据呢？",
        "读副本监测延迟",
        "每次强制主库",
        "需求放松带来扩展空间。"
      ],
      [
        "另一设备看刚付款订单，浏览器粘主够吗？",
        "不够",
        "足够",
        "会话边界不同。"
      ]
    ],
    "sources": [
      [
        "PostgreSQL standby",
        "https://www.postgresql.org/docs/current/hot-standby.html"
      ]
    ],
    "links": [
      [
        [
          0,
          1,
          "复制未完成"
        ],
        [
          2,
          1,
          "读副本"
        ]
      ],
      [
        [
          1,
          2,
          "返回 v8"
        ]
      ],
      [
        [
          2,
          0,
          "写后路由"
        ]
      ],
      [
        [
          0,
          2,
          "返回 v9"
        ]
      ]
    ],
    "kind": "graph"
  },
  {
    "id": 138,
    "title": "滚动发布怎样安全重命名数据库字段？",
    "scene": "display_name 改 full_name，新旧实例并存 20 分钟且需支持应用回滚；直接删旧列会使旧实例报错。",
    "constraints": [
      "新旧代码共存",
      "兼容回滚窗口"
    ],
    "options": [
      [
        "扩展迁移收缩",
        "兼容共存和回滚",
        "多阶段、回填与双写成本",
        "滚动发布"
      ],
      [
        "停机迁移",
        "切换集中",
        "停机与恢复成本",
        "有明确维护窗口"
      ]
    ],
    "answer": "先新增和兼容读写，回填校验，再切读；旧版本退场且回滚窗口结束后独立删除旧列。",
    "failure": "应用回滚成功但数据库字段已删，仍无法服务。",
    "steps": [
      "扩展阶段旧版可运行。",
      "回填限速可恢复并处理并发新写。",
      "收缩是独立破坏性步骤。"
    ],
    "limit": "双写与回填顺序需防旧值覆盖新值。",
    "revisit": "旧调用归零、回填通过且回滚期结束。",
    "rule": "先添后搬再删；回滚代码不等于回滚数据。",
    "flow": "flowchart LR\n A[\"新增列\"] --> B[\"兼容写和回填\"]\n B --> C[\"切读新列\"]\n C --> D[\"旧版退出\"]\n D --> E[\"独立删旧列\"]",
    "labels": [
      "直接重命名",
      "分阶段迁移"
    ],
    "frames": [
      [
        "旧应用=读旧列",
        "新应用=读新列",
        "数据库=旧列和新列"
      ],
      [
        "旧应用=报错",
        "新应用=读新列",
        "数据库=仅新列"
      ],
      [
        "旧应用=兼容读取",
        "新应用=兼容写入",
        "数据库=双列回填"
      ],
      [
        "新应用=读新列",
        "数据库=保留旧列至回滚期结束"
      ]
    ],
    "quiz": [
      [
        "直接删列影响谁？",
        "旧实例与回滚版本",
        "只有新版本",
        "旧代码仍依赖旧模式。"
      ],
      [
        "为何分离收缩？",
        "保护共存和回滚窗口",
        "Go 不支持改名",
        "问题在部署兼容。"
      ],
      [
        "回填期间有写入，可只复制一次吗？",
        "不能，需并发写策略",
        "可以忽略新写",
        "存在覆盖和遗漏时序。"
      ],
      [
        "如何修复单次破坏性部署？",
        "拆成扩展迁移收缩",
        "旧实例重试缺失字段",
        "重试恢复不了模式。"
      ],
      [
        "可停机且无旧在线实例时呢？",
        "可评估离线迁移和恢复",
        "仍强制双写数月",
        "停机约束不同。"
      ],
      [
        "回填完但还允许回滚一周，能删列吗？",
        "不能",
        "能",
        "回滚代码仍要兼容。"
      ]
    ],
    "sources": [
      [
        "PostgreSQL ALTER TABLE",
        "https://www.postgresql.org/docs/current/sql-altertable.html"
      ]
    ],
    "links": [
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
        ]
      ],
      [
        [
          1,
          2,
          "读成功"
        ]
      ],
      [
        [
          0,
          2,
          "旧列"
        ],
        [
          1,
          2,
          "兼容写"
        ]
      ],
      [
        [
          0,
          1,
          "切换后验证"
        ]
      ]
    ],
    "kind": "graph"
  },
  {
    "id": 139,
    "title": "千万行导入用一个事务还是可恢复分批？",
    "scene": "导入千万商品时在线订单仍访问同库；大事务占锁和日志，后段失败会全部重来。",
    "constraints": [
      "允许分批可见",
      "业务键唯一、断点可靠"
    ],
    "options": [
      [
        "有限批次和断点",
        "可恢复且资源有界",
        "部分成功及幂等成本",
        "允许分批提交"
      ],
      [
        "全量大事务",
        "全有全无",
        "资源峰值与回滚巨大",
        "小量或硬性原子需求"
      ]
    ],
    "answer": "压测确定批量，数据与检查点同事务提交；重放按稳定业务键幂等。",
    "failure": "断点先写会跳过，数据先写断点后写会重放。",
    "steps": [
      "断点表示已确认提交而非已读位置。",
      "批次与检查点同原子边界。",
      "限速并记录失败行和输入版本。"
    ],
    "limit": "示例只切批，不证明数据库吞吐和原子性。",
    "revisit": "要求导入全部完成才可见，改暂存版本再原子发布。",
    "rule": "断点跟提交走；分批不等于整批原子。",
    "flow": "flowchart LR\n A[\"输入流\"] --> B[\"有限批次\"]\n B --> C[\"数据和断点同事务\"]\n C --> D[\"下一批或断点恢复\"]",
    "labels": [
      "全量事务",
      "每批三条"
    ],
    "frames": [
      [
        "输入=8",
        "事务=8",
        "断点=0"
      ],
      [
        "第七条=失败",
        "重放=8",
        "峰值=8"
      ],
      [
        "输入=8",
        "批次=3",
        "已提交=3"
      ],
      [
        "批次=3,3,2",
        "断点=8",
        "峰值=3"
      ]
    ],
    "quiz": [
      [
        "大事务风险是什么？",
        "资源占用和大范围回滚",
        "每行立即提交",
        "范围大故障成本大。"
      ],
      [
        "断点含义是什么？",
        "已确认提交位置",
        "读取位置",
        "读取不等于落库。"
      ],
      [
        "分批是否全量原子可见？",
        "不是",
        "是",
        "多个提交点允许部分可见。"
      ],
      [
        "恢复重放怎样避免重复？",
        "稳定唯一业务键",
        "每次新随机商品 ID",
        "新键认不出重放。"
      ],
      [
        "全部导入后才可见的新需求？",
        "暂存版本后原子切引用",
        "略增批量",
        "需改可见性边界。"
      ],
      [
        "数据提交而断点失败会怎样？",
        "可能重放",
        "一定跳过",
        "落后的断点导致重复处理。"
      ]
    ],
    "sources": [
      [
        "Go transactions",
        "https://go.dev/doc/database/execute-transactions"
      ]
    ]
  },
  {
    "id": 140,
    "title": "接口 900ms 而 SQL 20ms，瓶颈到底在哪？",
    "scene": "订单 P99 900ms，慢查询日志只有 20ms。应用池已满，获取连接等待 850ms。",
    "constraints": [
      "池上限 20，数据库余量有限",
      "区分等待、执行、读取"
    ],
    "options": [
      [
        "分阶段测量",
        "定位排队和执行",
        "观测关联成本",
        "端到端耗时不一致"
      ],
      [
        "扩大连接池",
        "可能减少应用等待",
        "可能转移过载到数据库",
        "已有数据库余量证据"
      ]
    ],
    "answer": "关联 DB.Stats 窗口增量、InUse、事务时长及数据库执行时间，先查泄漏与长事务。",
    "failure": "只加索引，或无限加连接把数据库压垮。",
    "steps": [
      "等连接时间不属于数据库执行时间。",
      "未关闭 Rows 或长事务持有连接。",
      "累计 WaitDuration 要按窗口差分。"
    ],
    "limit": "累计等待不是单次 P99，须结合请求分段测量。",
    "revisit": "等待降低后瓶颈转到执行段。",
    "rule": "先分等待和执行，再选池或索引；累计要看增量。",
    "flow": "flowchart LR\n A[\"请求 900ms\"] --> B[\"等连接 850ms\"]\n B --> C[\"SQL 20ms\"]\n C --> D[\"读取返回 30ms\"]",
    "labels": [
      "只看 SQL",
      "分段观察"
    ],
    "frames": [
      [
        "请求耗时=900ms",
        "SQL耗时=20ms"
      ],
      [
        "请求耗时=895ms",
        "SQL耗时=15ms"
      ],
      [
        "连接等待=850ms",
        "SQL耗时=20ms",
        "返回耗时=30ms"
      ],
      [
        "连接等待=20ms",
        "SQL耗时=20ms",
        "返回耗时=30ms"
      ]
    ],
    "quiz": [
      [
        "SQL 很快接口仍慢，可能原因？",
        "连接排队",
        "必然 GC",
        "先测量而非猜测。"
      ],
      [
        "哪种池统计帮助排队分析？",
        "WaitCount/WaitDuration 窗口增量",
        "只看版本号",
        "统计描述获取连接等待。"
      ],
      [
        "累计 WaitDuration 就是本次 P99 吗？",
        "不是",
        "是",
        "累计量与分位数含义不同。"
      ],
      [
        "Rows 泄漏时优先做什么？",
        "关闭资源缩短占用",
        "无限加连接",
        "加容量会掩盖泄漏。"
      ],
      [
        "等待零但 SQL 850ms 呢？",
        "查计划、锁和 I/O",
        "继续扩池",
        "瓶颈证据已变。"
      ],
      [
        "事务持连接又调用 DB 查询死等，怎么修？",
        "使用同一 Tx",
        "无限重试",
        "受限池的嵌套借用可能死锁。"
      ]
    ],
    "sources": [
      [
        "Go connection management",
        "https://go.dev/doc/database/manage-connections"
      ]
    ]
  }
];
export default seeds.map(s=>make({...s,code:codes[s.id]})) satisfies Lesson[];
