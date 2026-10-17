import { architectureLesson as lesson } from '../architecture-builder';
import { q, frame, experiment } from '../builders';
import type { Lesson } from '../types';
const state=(...args:Parameters<typeof frame>)=>({...frame(...args),edges:[]});
const exp=(title:string, labels:[string,string], a:[string[],string[]], b:[string[],string[]])=>experiment([...a.flat(),...b.flat()].some(v=>/=[0-9]+(?:ms)?$/.test(v))?'bars':'graph',title,'切换条件并逐步比较状态。此图为教学模型，不是生产系统实测。',[state('输入条件','观察当前约束。',a[0]),state('方案后果','比较结果与付出。',a[1],1)],[state('输入条件','观察变化后的约束或方案。',b[0]),state('方案后果','判断适用边界。',b[1],1)],labels);
export default [
lesson({
  "id": 111,
  "title": "同一业务接口应选择 HTTP/JSON、gRPC 还是消息",
  "scenario": "面向浏览器的查询 API 与内部低延迟计算链路共用一个协议选型；报表导出却不要求立即完成。",
  "constraints": [
    "浏览器客户需要易集成",
    "内部调用有类型契约",
    "导出允许异步"
  ],
  "options": [
    {
      "title": "HTTP/JSON",
      "benefits": "通用客户端与调试生态",
      "costs": "需自行维护契约和流式约定",
      "when": "公开或浏览器友好接口"
    },
    {
      "title": "gRPC",
      "benefits": "生成类型契约与流式 RPC",
      "costs": "浏览器接入和基础设施需适配",
      "when": "受控内部服务通信"
    },
    {
      "title": "异步消息",
      "benefits": "解耦接收与处理时间",
      "costs": "重复、积压与结果查询需设计",
      "when": "任务可延迟且需持久交接"
    }
  ],
  "recommendation": "按交互需求分别选协议：公开查询优先 HTTP，受控内部 RPC 可评估 gRPC，导出建异步任务。",
  "pitfall": "为统一技术栈，把所有场景硬塞进同一种同步协议。",
  "mechanism": [
    "同步 RPC 直接返回调用结果，但双方可用时间耦合。",
    "消息确认与业务完成是不同事件。",
    "序列化协议不决定业务一致性或幂等性。"
  ],
  "boundary": "现有网关、客户端能力与团队运维经验可能改变协议选择。",
  "revisitWhen": [
    "需要双向流或高频内部调用",
    "请求生命周期超过可接受等待"
  ],
  "mnemonic": "先定交互，再选协议。",
  "sources": [
    {
      "title": "gRPC：核心概念",
      "url": "https://grpc.io/docs/what-is-grpc/core-concepts/"
    }
  ],
  "diagram": [
    {
      "title": "三类交互分开建模",
      "source": "flowchart LR\n B[\"浏览器查询\"] --> H[\"HTTP API\"]\n I[\"内部计算\"] --> R[\"RPC\"]\n E[\"导出申请\"] --> Q[\"持久任务队列\"]\n Q --> W[\"异步生成\"]",
      "caption": "协议按交互方式匹配，不代表某协议普遍更快。",
      "kind": "architecture"
    }
  ]
,experiment:exp("同一业务接口应选择 HTTP/JSON、gRPC 还是消息",["同步导出","异步导出"],[["请求=已接收","任务=长时间生成"],["连接=持续等待","超时=结果不确定"]],[["申请=持久化任务","请求=返回任务编号"],["后台=生成报表","客户端=查询状态","结果=可重取"]]),quizzes:[q("本题是否需要所有接口统一协议？","不必，按交互需求选择","必须全部变成消息","查询和异步任务有不同时间语义。"),q("消息已确认接收是否等于导出完成？","不等于","等于","交接与业务完成分离。"),q("浏览器缺少直接 gRPC 支持时？","评估网关或 HTTP 接口","假定所有浏览器可直接调用","客户端能力是约束。"),q("报表任务超过请求预算，应？","返回持久任务标识和状态查询","无限加长 HTTP 超时","需要明确异步生命周期。"),q("内部需双向流且客户端可生成，倾向？","评估 gRPC 流式 RPC","因为公开 API 用 JSON 而排除它","约束改变可带来不同协议。"),q("简单外部天气查询强调易接入，起点？","通用 HTTP 接口","要求用户先部署消息代理","交互复杂度要匹配需求。")]}),
lesson({
  "id": 112,
  "title": "领域类型能否直接充当公开 API 数据结构",
  "scenario": "User 结构体新增内部风控分数，HTTP handler 直接把 User 编码成 JSON，外部契约意外增加敏感字段。",
  "constraints": [
    "外部契约长期兼容",
    "内部字段频繁变化",
    "不能暴露内部风控数据"
  ],
  "options": [
    {
      "title": "直接序列化领域类型",
      "benefits": "代码少且少一次映射",
      "costs": "内部变化容易改变公开协议",
      "when": "小范围受控工具且风险可接受"
    },
    {
      "title": "独立传输 DTO",
      "benefits": "公开字段白名单和版本可控",
      "costs": "需要转换和契约测试",
      "when": "外部接口或敏感字段存在"
    }
  ],
  "recommendation": "建立明确响应 DTO，显式选择对外字段，并为兼容和敏感信息遗漏写契约测试。",
  "pitfall": "依赖开发者记得给每个新内部字段加 json:\"-\"。",
  "mechanism": [
    "序列化标签控制格式但不代替契约治理。",
    "DTO 可以与领域和存储模型不同步演进。",
    "映射点是字段暴露的明确审查边界。"
  ],
  "boundary": "内部短期工具可选择直接类型，但仍需认识耦合和信息暴露风险。",
  "revisitWhen": [
    "公开字段变更频繁",
    "同一领域对象有多种权限视图"
  ],
  "mnemonic": "对外列白名单，内部可自由变。",
  "sources": [
    {
      "title": "Go encoding/json",
      "url": "https://pkg.go.dev/encoding/json"
    }
  ],
  "diagram": [
    {
      "title": "显式映射公开数据",
      "source": "flowchart LR\n D[\"领域用户含风控字段\"] --> M[\"显式响应映射\"]\n M --> P[\"公开 UserDTO\"]\n P --> C[\"客户端\"]",
      "caption": "映射只包含批准公开的字段。",
      "kind": "flow"
    }
  ]
,experiment:exp("领域类型能否直接充当公开 API 数据结构",["直接编码","显式 DTO"],[["领域=新增风控分数","编码=完整对象"],["响应=包含新字段","客户端=看到内部信息"]],[["领域=新增风控分数","映射=显式字段清单"],["响应=既定公开字段","风控=留在内部","契约=未变化"]]),quizzes:[q("本题优先措施？","显式响应 DTO","给领域类型增加更多导出字段","需要可审查的公开字段边界。"),q("DTO 的价值是？","允许公开契约独立演进","让所有字段自动安全","安全来自明确映射和校验。"),q("短期本地工具能直接编码吗？","可在接受耦合风险后使用","任何情况下绝对禁止","抽象成本与风险相称。"),q("如何防止风控字段泄漏回归？","验证响应字段集合与权限视图","只检查 JSON 可以解析","能解析不代表暴露边界正确。"),q("同一用户给管理员和公众不同字段，应该？","明确区分响应视图","依赖客户端自行隐藏","服务端决定可见数据。"),q("库存内部新增供应商成本，公网商品 API 应？","维持独立 DTO 白名单","自动输出所有导出字段","内部扩展不应默认改变公网契约。")]}),
lesson({
  "id": 113,
  "title": "字段缺失、零值和显式清空如何区分",
  "scenario": "PATCH 用户资料时，{} 表示不修改姓名，null 表示清空，空字符串是有效的明确设置；当前代码把缺失也清空。",
  "constraints": [
    "缺失表示保留",
    "null 表示清空",
    "空字符串是显式输入"
  ],
  "options": [
    {
      "title": "直接使用零值字段",
      "benefits": "解码简单",
      "costs": "不能表达存在性",
      "when": "全部字段必填或全量替换"
    },
    {
      "title": "显式记录字段存在",
      "benefits": "保留未提供与清空区别",
      "costs": "需要额外解码和验证",
      "when": "局部更新具有三态语义"
    }
  ],
  "recommendation": "先检查字段是否存在，再解释 null 和实际值；传输层明确更新语义。",
  "pitfall": "以 nil 或空字符串统一表示用户没有提供字段。",
  "mechanism": [
    "值本身与是否提供是两维信息。",
    "指针可区分值与 null，但单独解码时缺失和 null 都可能为 nil。",
    "RawMessage 配合键存在性可表达本题三态。"
  ],
  "boundary": "字段掩码或独立操作对象也可表达局部更新；并非所有 API 都应规定 null 清空。",
  "revisitWhen": [
    "需要嵌套更新",
    "null 本身是合法业务值"
  ],
  "mnemonic": "先问有没有，再问是什么。",
  "sources": [
    {
      "title": "Go encoding/json：RawMessage",
      "url": "https://pkg.go.dev/encoding/json#RawMessage"
    }
  ],
  "diagram": [
    {
      "title": "局部更新三态",
      "source": "flowchart TD\n R[\"更新请求\"] --> P{\"包含 name 键\"}\n P -->|否| K[\"保留旧值\"]\n P -->|是| N{\"值为 null\"}\n N -->|是| C[\"清空\"]\n N -->|否| V[\"验证并设置值\"]",
      "caption": "null 清空是本题接口约定。",
      "kind": "flow"
    }
  ],
  "code": {
    "starter": "package main\n\nimport (\n\t\"encoding/json\"\n\t\"fmt\"\n)\n\nfunc patch(current, payload string) (string, error) {\n\tvar fields map[string]json.RawMessage\n\tif err := json.Unmarshal([]byte(payload), &fields); err != nil {\n\t\treturn \"\", err\n\t}\n\traw, ok := fields[\"name\"]\n\tif !ok {\n\t\treturn \"\", nil\n\t}\n\tvar value *string\n\tif err := json.Unmarshal(raw, &value); err != nil {\n\t\treturn \"\", err\n\t}\n\tif value == nil {\n\t\treturn \"\", nil\n\t}\n\treturn *value, nil\n}\nfunc solve() string {\n\ta, _ := patch(\"Ada\", \"{}\")\n\tb, _ := patch(\"Ada\", `{\"name\":null}`)\n\treturn fmt.Sprintf(\"missing=%s null=%s\", a, b)\n}\nfunc main() { fmt.Println(solve()) }\n",
    "solution": "package main\n\nimport (\n\t\"encoding/json\"\n\t\"fmt\"\n)\n\nfunc patch(current, payload string) (string, error) {\n\tvar fields map[string]json.RawMessage\n\tif err := json.Unmarshal([]byte(payload), &fields); err != nil {\n\t\treturn \"\", err\n\t}\n\traw, ok := fields[\"name\"]\n\tif !ok {\n\t\treturn current, nil\n\t}\n\tvar value *string\n\tif err := json.Unmarshal(raw, &value); err != nil {\n\t\treturn \"\", err\n\t}\n\tif value == nil {\n\t\treturn \"\", nil\n\t}\n\treturn *value, nil\n}\nfunc solve() string {\n\ta, _ := patch(\"Ada\", \"{}\")\n\tb, _ := patch(\"Ada\", `{\"name\":null}`)\n\treturn fmt.Sprintf(\"missing=%s null=%s\", a, b)\n}\nfunc main() { fmt.Println(solve()) }\n",
    "starterOutput": "missing= null=",
    "expectedOutput": "missing=Ada null=",
    "testCode": "package main\n\nimport (\n\t\"fmt\"\n\t\"reflect\"\n\t\"testing\"\n)\n\nvar _ = reflect.DeepEqual\nvar _ = fmt.Sprint\n\nfunc TestPatch(t *testing.T) {\n\tfor _, c := range []struct{ payload, want string }{{\"{}\", \"Ada\"}, {`{\"name\":null}`, \"\"}, {`{\"name\":\"\"}`, \"\"}, {`{\"name\":\"Lin\"}`, \"Lin\"}} {\n\t\tgot, err := patch(\"Ada\", c.payload)\n\t\tif err != nil || got != c.want {\n\t\t\tt.Fatalf(\"%s: got %q %v want %q\", c.payload, got, err, c.want)\n\t\t}\n\t}\n\tif _, err := patch(\"Ada\", `{\"name\":3}`); err == nil {\n\t\tt.Fatal(\"wrong type accepted\")\n\t}\n}\nfunc BenchmarkSolution(b *testing.B) {\n\tfor i := 0; i < b.N; i++ {\n\t\tsolve()\n\t}\n}\n"
  }
,experiment:exp("字段缺失、零值和显式清空如何区分",["把缺失当清空","保留字段存在性"],[["旧姓名=Ada","请求=空对象"],["姓名=被清空","用户意图=被覆盖"]],[["旧姓名=Ada","请求=空对象"],["键存在=否","姓名=Ada","其他字段=不受影响"]]),quizzes:[q("{} 应得到什么？","保留原姓名","清空姓名","缺失按契约表示不修改。"),q("仅 *string 为何不够？","缺失和 null 都可能得到 nil","指针不能保存字符串","还需要字段存在性。"),q("null 必须总表示清空吗？","由接口契约决定","所有 JSON 接口都如此","这是业务协议约定。"),q("修复代码应先检查？","map 中键是否存在","字符串是否为空","空值本身不表达缺失。"),q("改成全量 PUT 且所有字段必填时？","可拒绝缺失并按替换语义处理","仍必须无条件保留旧字段","操作契约改变了。"),q("商品补丁未提供库存而库存旧值为 8，按同约定？","保留 8","设为整数零值","缺失不等于清零。")]}),
lesson({
  "id": 114,
  "title": "如何设计向后兼容的 API 和事件变更",
  "scenario": "订单状态准备增加 reviewing，新版生产者先发事件，旧消费者把未知状态当失败并持续重试。",
  "constraints": [
    "新旧版本共存",
    "消费者独立升级",
    "未知字段与未知业务状态不同"
  ],
  "options": [
    {
      "title": "直接增加并立即发送",
      "benefits": "上线快",
      "costs": "旧读者可能不支持新语义",
      "when": "所有消费者已证实兼容"
    },
    {
      "title": "先扩展读者再启用写者",
      "benefits": "滚动期间兼容可验证",
      "costs": "需要分阶段开关与监控",
      "when": "消费者独立升级"
    }
  ],
  "recommendation": "先让读者明确处理新状态或安全未知态，验证后启用生产者；破坏性语义变更采用显式版本契约。",
  "pitfall": "把增加字段不会破坏 JSON 解析误当成所有语义变化都兼容。",
  "mechanism": [
    "兼容包括结构、语义和可观察行为。",
    "枚举新增值可能影响旧代码分支。",
    "部署顺序需让旧新组合都有已定义行为。"
  ],
  "boundary": "无法升级的外部消费者可能需要新版本接口或单独事件类型。",
  "revisitWhen": [
    "旧消费者不再可维护",
    "行为含义改变而非仅扩展"
  ],
  "mnemonic": "读者先理解，写者再发出。",
  "sources": [
    {
      "title": "Google AIP-180：兼容性",
      "url": "https://google.aip.dev/180"
    }
  ],
  "diagram": [
    {
      "title": "先读后写",
      "source": "flowchart LR\n A[\"读者支持新状态\"] --> T[\"验证旧新组合\"]\n T --> W[\"写者启用新状态\"]\n W --> O[\"监控消费错误\"]",
      "caption": "结构可解析不代表语义可接受。",
      "kind": "flow"
    }
  ]
,experiment:exp("如何设计向后兼容的 API 和事件变更",["写者先启用","读者先扩展"],[["写者=发送 reviewing","旧读者=未知即失败"],["消息=反复重试","积压=增长"]],[["读者=支持 reviewing","写者=仍发旧状态"],["验证=组合通过","写者=启用新值","消费=继续"]]),quizzes:[q("新增枚举值必然兼容吗？","不一定，旧分支可能拒绝","只增加就必然兼容","语义约束也属于契约。"),q("为什么先改读者？","避免共存期间写出无法理解的数据","因为读请求永远比写请求多","部署顺序保护版本组合。"),q("外部消费者永远无法升级时？","评估独立版本或事件类型","强制沿用旧字段名改变含义","旧消费者约束不能忽略。"),q("修复持续重试应？","定义新状态与未知态策略并分阶段发布","忽略所有业务状态直接成功","不能用吞错误替代语义兼容。"),q("只增加旧消费者确定忽略的可选描述字段？","经契约测试后可采用较简单发布","仍必定破坏所有客户端","实际兼容证据可简化流程。"),q("旧物流系统只认识两种状态，新加退回，先？","验证旧读者策略再启用新写入","只确认 JSON 语法合法","语法不是业务兼容。")]}),
lesson({
  "id": 115,
  "title": "Go error、HTTP 状态与业务错误码如何映射",
  "scenario": "存储层用 %w 包装 ErrMissing，handler 用 == 比较，原应 404 的资源缺失变成 500；内部 SQL 细节还被直接返回。",
  "constraints": [
    "内部保留错误因果",
    "公开错误稳定",
    "不能泄漏内部细节"
  ],
  "options": [
    {
      "title": "匹配错误字符串",
      "benefits": "短期改动小",
      "costs": "文案变化破坏分类",
      "when": "临时诊断而非正式契约"
    },
    {
      "title": "结构化分类并边界映射",
      "benefits": "错误链可追踪，协议稳定",
      "costs": "维护明确分类表",
      "when": "长期服务接口"
    }
  ],
  "recommendation": "用 errors.Is/As 识别稳定类别，在传输边界统一映射状态与公开错误码；内部细节留给受控观测。",
  "pitfall": "包装后用 == 或字符串包含关系决定业务错误类别。",
  "mechanism": [
    "%w 保留可遍历原因。",
    "错误身份与展示文本不同。",
    "HTTP 状态描述协议结果，业务码补充调用者可处理语义。"
  ],
  "boundary": "某些资源因防枚举要求可能有意统一返回 404；映射仍需遵守授权策略。",
  "revisitWhen": [
    "新增可恢复业务错误",
    "公开码含义需要改变"
  ],
  "mnemonic": "内部留因果，边界定契约。",
  "sources": [
    {
      "title": "Go errors：Is 与 As",
      "url": "https://pkg.go.dev/errors"
    }
  ],
  "diagram": [
    {
      "title": "内部错误到公开响应",
      "source": "flowchart LR\n D[\"存储错误\"] --> W[\"带上下文包装\"]\n W --> C[\"Is 或 As 分类\"]\n C --> P[\"稳定状态与业务码\"]\n W --> L[\"受控内部日志\"]",
      "caption": "响应不直接返回底层驱动错误文本。",
      "kind": "flow"
    }
  ],
  "code": {
    "starter": "package main\n\nimport (\n\t\"errors\"\n\t\"fmt\"\n)\n\nvar ErrInvalid = errors.New(\"invalid\")\nvar ErrMissing = errors.New(\"missing\")\n\nfunc status(err error) int {\n\tif err == nil {\n\t\treturn 200\n\t}\n\tif err == ErrInvalid {\n\t\treturn 400\n\t}\n\tif err == ErrMissing {\n\t\treturn 404\n\t}\n\treturn 500\n}\nfunc solve() string {\n\treturn fmt.Sprintf(\"status=%d\", status(fmt.Errorf(\"load account: %w\", ErrMissing)))\n}\nfunc main() { fmt.Println(solve()) }\n",
    "solution": "package main\n\nimport (\n\t\"errors\"\n\t\"fmt\"\n)\n\nvar ErrInvalid = errors.New(\"invalid\")\nvar ErrMissing = errors.New(\"missing\")\n\nfunc status(err error) int {\n\tif err == nil {\n\t\treturn 200\n\t}\n\tif errors.Is(err, ErrInvalid) {\n\t\treturn 400\n\t}\n\tif errors.Is(err, ErrMissing) {\n\t\treturn 404\n\t}\n\treturn 500\n}\nfunc solve() string {\n\treturn fmt.Sprintf(\"status=%d\", status(fmt.Errorf(\"load account: %w\", ErrMissing)))\n}\nfunc main() { fmt.Println(solve()) }\n",
    "starterOutput": "status=500",
    "expectedOutput": "status=404",
    "testCode": "package main\n\nimport (\n\t\"fmt\"\n\t\"reflect\"\n\t\"testing\"\n)\n\nvar _ = reflect.DeepEqual\nvar _ = fmt.Sprint\n\nfunc TestStatus(t *testing.T) {\n\tfor _, c := range []struct {\n\t\terr  error\n\t\twant int\n\t}{{nil, 200}, {ErrInvalid, 400}, {fmt.Errorf(\"outer: %w\", fmt.Errorf(\"inner: %w\", ErrMissing)), 404}, {fmt.Errorf(\"missing\"), 500}} {\n\t\tif got := status(c.err); got != c.want {\n\t\t\tt.Fatalf(\"got %d want %d\", got, c.want)\n\t\t}\n\t}\n}\nfunc BenchmarkSolution(b *testing.B) {\n\tfor i := 0; i < b.N; i++ {\n\t\tsolve()\n\t}\n}\n"
  }
,experiment:exp("Go error、HTTP 状态与业务错误码如何映射",["直接比较","沿链分类"],[["错误=包装 ErrMissing","比较=对象直接相等"],["HTTP=500","类别=丢失"]],[["错误=包装 ErrMissing","识别=errors.Is"],["HTTP=404","原因链=保留","内部细节=不公开"]]),quizzes:[q("包装后的 ErrMissing 应按本题返回？","404","500","分类应识别原因链。"),q("为什么不用错误文本分类？","文本不等于稳定错误身份","字符串比较运行不了","文案会随上下文变化。"),q("未授权资源为防枚举可否统一 404？","可由接口与安全策略决定","所有场景必须公开真实原因","错误映射也受信息边界约束。"),q("修复应使用？","errors.Is 或 errors.As","去掉全部错误上下文","无需牺牲内部诊断信息。"),q("未知数据库内部错误应？","返回稳定通用错误并内部记录","把完整 SQL 与驱动报错发给用户","公开契约不应泄漏内部细节。"),q("配置错误多层包装但原因是 ErrInvalid，按同分类？","识别为输入错误类别","凡包装过都变成 500","包装不应抹去类型语义。")]}),
lesson({
  "id": 116,
  "title": "并发写入下选择偏移分页还是游标分页",
  "scenario": "管理台按不可变递增 ID 浏览记录，读完 1、2 后，列表前方插入 ID 0；用偏移 2 继续时再次读到 2。",
  "constraints": [
    "按唯一不可变 ID 排序",
    "允许实时列表而非固定快照",
    "需要避免前方插入导致重复"
  ],
  "options": [
    {
      "title": "偏移分页",
      "benefits": "易跳到指定页",
      "costs": "前方增删会移动位置",
      "when": "小型静态列表或明确接受漂移"
    },
    {
      "title": "键集游标",
      "benefits": "从稳定边界继续读取",
      "costs": "任意页跳转困难，仍非快照",
      "when": "大列表连续浏览且有稳定排序键"
    }
  ],
  "recommendation": "按 id > lastID 继续读取并限制条数；实际接口用不透明游标保存过滤条件与边界。",
  "pitfall": "把数组下标当永久记录身份，或把游标分页宣称为完整快照。",
  "mechanism": [
    "偏移描述位置，键集描述排序边界。",
    "非唯一排序必须加入唯一 tie-breaker。",
    "实时游标仍受更新、删除和排序键变化影响。"
  ],
  "boundary": "需要严格导出某一时点的数据时，仍需快照或固定水位策略。",
  "revisitWhen": [
    "需要任意页跳转",
    "排序键可变或要求时点一致性"
  ],
  "mnemonic": "位置会漂移，边界靠稳定键。",
  "sources": [
    {
      "title": "Google AIP-158：分页",
      "url": "https://google.aip.dev/158"
    }
  ],
  "diagram": [
    {
      "title": "从稳定边界继续",
      "source": "flowchart LR\n A[\"已读 ID 1 和 2\"] --> C[\"游标 lastID 为 2\"]\n C --> Q[\"查询 ID 大于 2\"]\n Q --> R[\"返回 3 和 4\"]\n N[\"前方插入 ID 0\"] --> Q",
      "caption": "示例只使用稳定唯一 ID；不提供固定快照。",
      "kind": "flow"
    }
  ],
  "code": {
    "starter": "package main\n\nimport (\n\t\"fmt\"\n)\n\nfunc page(ids []int, after, limit int) []int {\n\tout := []int{}\n\tif limit <= 0 {\n\t\treturn out\n\t}\n\tfor i := after; i < len(ids) && len(out) < limit; i++ {\n\t\tif i >= 0 {\n\t\t\tout = append(out, ids[i])\n\t\t}\n\t}\n\treturn out\n}\nfunc solve() string { return fmt.Sprint(page([]int{0, 1, 2, 3, 4}, 2, 2)) }\nfunc main()         { fmt.Println(solve()) }\n",
    "solution": "package main\n\nimport (\n\t\"fmt\"\n)\n\nfunc page(ids []int, after, limit int) []int {\n\tout := []int{}\n\tif limit <= 0 {\n\t\treturn out\n\t}\n\tfor _, id := range ids {\n\t\tif id > after {\n\t\t\tout = append(out, id)\n\t\t\tif len(out) == limit {\n\t\t\t\tbreak\n\t\t\t}\n\t\t}\n\t}\n\treturn out\n}\nfunc solve() string { return fmt.Sprint(page([]int{0, 1, 2, 3, 4}, 2, 2)) }\nfunc main()         { fmt.Println(solve()) }\n",
    "starterOutput": "[2 3]",
    "expectedOutput": "[3 4]",
    "testCode": "package main\n\nimport (\n\t\"fmt\"\n\t\"reflect\"\n\t\"testing\"\n)\n\nvar _ = reflect.DeepEqual\nvar _ = fmt.Sprint\n\nfunc TestPage(t *testing.T) {\n\tfor _, ids := range [][]int{{1, 2, 3, 4}, {0, 1, 2, 3, 4}, {2, 3, 4}} {\n\t\tif got := page(ids, 2, 2); !reflect.DeepEqual(got, []int{3, 4}) {\n\t\t\tt.Fatalf(\"%v: %v\", ids, got)\n\t\t}\n\t}\n\tif len(page([]int{1}, 0, 0)) != 0 {\n\t\tt.Fatal(\"limit zero\")\n\t}\n\tif len(page([]int{1, 2}, 2, 10)) != 0 {\n\t\tt.Fatal(\"end\")\n\t}\n}\nfunc BenchmarkSolution(b *testing.B) {\n\tfor i := 0; i < b.N; i++ {\n\t\tsolve()\n\t}\n}\n"
  }
,experiment:exp("并发写入下选择偏移分页还是游标分页",["按偏移继续","按键继续"],[["已读=[1,2]","新列表=[0,1,2,3,4]"],["偏移=2","下一页=[2,3]"]],[["已读=[1,2]","边界=ID 大于 2"],["下一页=[3,4]","前方插入=不移动边界","快照保证=无"]]),quizzes:[q("前方插入后偏移 2 返回什么？","2 和 3","3 和 4","位置移动造成重复。"),q("键集分页依赖什么？","稳定且可唯一排序的边界","每条记录当前数组下标","边界要能跨请求定位。"),q("游标自动保证时点快照吗？","不保证","保证","实时数据仍能变化。"),q("按创建时间有重复，应？","加入唯一 ID 作为次排序键","随意选择同时间记录","必须确定完整排序。"),q("财务要求严格导出午夜状态，应？","配合快照或固定版本策略","仅换成游标就声称满足","分页与一致性是不同问题。"),q("小型不变结果集需直接跳第 8 页，可能选？","偏移分页","任何场景禁止偏移","访问模式与数据稳定性改变权衡。")]}),
lesson({
  "id": 117,
  "title": "创建请求超时后如何避免重复副作用",
  "scenario": "扣款成功但响应丢失，客户端以相同请求标识重试；服务再次扣款。示例用单进程顺序账本演示请求身份与结果复用。",
  "constraints": [
    "相同请求应复用结果",
    "同键不同金额必须拒绝",
    "示例不模拟数据库持久化"
  ],
  "options": [
    {
      "title": "每次重试都执行",
      "benefits": "实现直接",
      "costs": "超时后可能重复扣款",
      "when": "操作本身天然幂等"
    },
    {
      "title": "请求键加输入校验及结果存储",
      "benefits": "重试能识别同一意图",
      "costs": "需原子持久化、保留期与并发控制",
      "when": "非幂等业务允许重试"
    }
  ],
  "recommendation": "将幂等键绑定规范化输入和结果；生产系统中与业务副作用协调原子性，不能只在写完后补一条缓存。",
  "pitfall": "只检查相同键，不验证金额；或把进程内 map 当成跨实例持久保证。",
  "mechanism": [
    "网络超时不等于服务未执行。",
    "同一意图需要稳定标识，而非每次重试生成新键。",
    "幂等记录与副作用之间的崩溃窗口必须被协议覆盖。"
  ],
  "boundary": "本地示例只验证顺序行为；生产并发、崩溃和过期重放需要持久化唯一约束及事务设计。",
  "revisitWhen": [
    "扩为多个实例",
    "幂等记录过期但旧请求仍可能到达"
  ],
  "mnemonic": "同键同意图，同果不重做。",
  "sources": [
    {
      "title": "Google AIP-155：请求标识",
      "url": "https://google.aip.dev/155"
    }
  ],
  "diagram": [
    {
      "title": "幂等请求分类",
      "source": "flowchart TD\n R[\"请求键与金额\"] --> K{\"键已存在\"}\n K -->|否| E[\"协调业务执行与结果记录\"]\n K -->|是| P{\"输入相同\"}\n P -->|是| O[\"返回原结果\"]\n P -->|否| X[\"拒绝键冲突\"]",
      "caption": "生产原子性不能由内存示例推导。",
      "kind": "flow"
    }
  ],
  "code": {
    "starter": "package main\n\nimport (\n\t\"errors\"\n\t\"fmt\"\n)\n\ntype Receipt struct {\n\tAmount  int\n\tBalance int\n}\ntype Ledger struct {\n\tBalance int\n\tSeen    map[string]Receipt\n}\n\nfunc (l *Ledger) Charge(key string, amount int) (int, error) {\n\tif key == \"\" || amount <= 0 {\n\t\treturn l.Balance, errors.New(\"invalid\")\n\t}\n\tif amount > l.Balance {\n\t\treturn l.Balance, errors.New(\"insufficient\")\n\t}\n\tl.Balance -= amount\n\tl.Seen[key] = Receipt{amount, l.Balance}\n\treturn l.Balance, nil\n}\nfunc solve() string {\n\tl := Ledger{Balance: 100, Seen: map[string]Receipt{}}\n\tl.Charge(\"request-7\", 10)\n\tl.Charge(\"request-7\", 10)\n\treturn fmt.Sprintf(\"balance=%d\", l.Balance)\n}\nfunc main() { fmt.Println(solve()) }\n",
    "solution": "package main\n\nimport (\n\t\"errors\"\n\t\"fmt\"\n)\n\ntype Receipt struct {\n\tAmount  int\n\tBalance int\n}\ntype Ledger struct {\n\tBalance int\n\tSeen    map[string]Receipt\n}\n\nfunc (l *Ledger) Charge(key string, amount int) (int, error) {\n\tif key == \"\" || amount <= 0 {\n\t\treturn l.Balance, errors.New(\"invalid\")\n\t}\n\tif old, ok := l.Seen[key]; ok {\n\t\tif old.Amount != amount {\n\t\t\treturn l.Balance, errors.New(\"key conflict\")\n\t\t}\n\t\treturn old.Balance, nil\n\t}\n\tif amount > l.Balance {\n\t\treturn l.Balance, errors.New(\"insufficient\")\n\t}\n\tl.Balance -= amount\n\tl.Seen[key] = Receipt{amount, l.Balance}\n\treturn l.Balance, nil\n}\nfunc solve() string {\n\tl := Ledger{Balance: 100, Seen: map[string]Receipt{}}\n\tl.Charge(\"request-7\", 10)\n\tl.Charge(\"request-7\", 10)\n\treturn fmt.Sprintf(\"balance=%d\", l.Balance)\n}\nfunc main() { fmt.Println(solve()) }\n",
    "starterOutput": "balance=80",
    "expectedOutput": "balance=90",
    "testCode": "package main\n\nimport (\n\t\"fmt\"\n\t\"reflect\"\n\t\"testing\"\n)\n\nvar _ = reflect.DeepEqual\nvar _ = fmt.Sprint\n\nfunc TestCharge(t *testing.T) {\n\tl := Ledger{Balance: 100, Seen: map[string]Receipt{}}\n\ta, e := l.Charge(\"one\", 10)\n\tif e != nil || a != 90 {\n\t\tt.Fatal(a, e)\n\t}\n\tb, e := l.Charge(\"one\", 10)\n\tif e != nil || b != 90 || l.Balance != 90 {\n\t\tt.Fatal(\"duplicate changed balance\")\n\t}\n\tif _, e = l.Charge(\"one\", 20); e == nil || l.Balance != 90 {\n\t\tt.Fatal(\"conflict not rejected\")\n\t}\n\tif _, e = l.Charge(\"two\", 5); e != nil || l.Balance != 85 {\n\t\tt.Fatal(\"distinct request\")\n\t}\n}\nfunc BenchmarkSolution(b *testing.B) {\n\tfor i := 0; i < b.N; i++ {\n\t\tsolve()\n\t}\n}\n"
  }
,experiment:exp("创建请求超时后如何避免重复副作用",["无去重","复用已记录结果"],[["余额=100","请求=扣款 10"],["同键重试=再扣 10","余额=80"]],[["余额=100","请求=扣款 10"],["同键重试=返回旧结果","余额=90","新增副作用=0"]]),quizzes:[q("第一次成功但响应丢失，能认为未扣款吗？","不能","可以","超时只说明客户端没拿到结果。"),q("为什么同键要比较输入？","防止不同业务意图错误复用结果","只为节省字符串内存","键冲突必须可识别。"),q("内存 map 是否足够生产跨实例去重？","不够","足够","进程重启与并发实例不共享它。"),q("本地代码如何修复？","同键同金额返回原结果，异金额拒绝","每次重试重新生成键","新键会把重试变成新意图。"),q("业务改成设置目标余额且自带版本条件，可以？","重新评估天然幂等与并发语义","仍认定所有写操作绝不能重试","操作语义决定重试方案。"),q("订票成功响应丢失，重发同请求键但座位不同应？","拒绝键与输入冲突","静默返回旧座位","同一个标识不能混淆不同意图。")]}),
lesson({
  "id": 118,
  "title": "长耗时操作同步等待、异步轮询还是推送结果",
  "scenario": "导出报表需两分钟，网关只允许三十秒；用户关页后仍期望任务完成并能重新下载。",
  "constraints": [
    "任务长于请求预算",
    "结果需要再次获取",
    "页面关闭不等于撤销任务"
  ],
  "options": [
    {
      "title": "同步请求等待",
      "benefits": "调用流程直接",
      "costs": "连接和超时耦合",
      "when": "执行时间短且稳定"
    },
    {
      "title": "持久任务加轮询",
      "benefits": "跨页面恢复且状态明确",
      "costs": "任务存储与轮询负载",
      "when": "需要可靠恢复"
    },
    {
      "title": "推送完成事件",
      "benefits": "及时通知，减少轮询",
      "costs": "连接断开与漏通知需补偿",
      "when": "有推送基础且仍提供查询"
    }
  ],
  "recommendation": "持久创建任务并返回标识；查询状态是事实来源，推送可以加速通知但不替代恢复接口。",
  "pitfall": "handler 内起 goroutine 后立即成功，却不记录任务或错误。",
  "mechanism": [
    "接受任务、正在处理和已完成应明确区分。",
    "任务生命周期不能仅依附一次 HTTP 连接。",
    "查询接口需定义失败、取消、结果过期和权限。"
  ],
  "boundary": "短操作采用同步调用更简单；异步会增加持久状态和清理成本。",
  "revisitWhen": [
    "任务数造成轮询压力",
    "任务必须支持取消或进度恢复"
  ],
  "mnemonic": "接受给编号，完成有证据。",
  "sources": [
    {
      "title": "Google AIP-151：长耗时操作",
      "url": "https://google.aip.dev/151"
    }
  ],
  "diagram": [
    {
      "title": "任务状态机",
      "source": "stateDiagram-v2\n state \"已接收\" as Accepted\n state \"处理中\" as Running\n state \"成功\" as Succeeded\n state \"失败\" as Failed\n [*] --> Accepted\n Accepted --> Running\n Running --> Succeeded\n Running --> Failed",
      "caption": "状态持久化与结果访问权限需要同时设计。",
      "kind": "state"
    }
  ]
,experiment:exp("长耗时操作同步等待、异步轮询还是推送结果",["绑定请求生命周期","持久任务"],[["请求=等待导出","网关预算=30 秒"],["网关=超时","结果=无法可靠查询"]],[["请求=返回任务编号","任务=已持久接收"],["页面=可关闭","后台=继续处理","结果=按编号查询"]]),quizzes:[q("本题优先？","持久任务加状态查询","无限持有请求连接","操作超过预算且需恢复。"),q("已接收等于完成吗？","不等于","等于","接收只是任务状态之一。"),q("任务只需 20ms 且无恢复要求？","同步通常更简单","仍必须建任务系统","机制要匹配成本。"),q("推送断线后如何恢复？","按任务编号查询事实状态","假设未收到就没有完成","通知不是事实唯一来源。"),q("用户要求关页即取消，应？","显式定义并传递取消操作","只凭 TCP 断开永久删除数据","业务取消应有明确协议。"),q("视频转码需跨设备查结果，返回？","持久任务 ID 与查询方式","仅返回某个 goroutine 已启动","进程内启动不等于可靠接收。")]}),
lesson({
  "id": 119,
  "title": "流式接口如何处理慢客户端、取消和资源上限",
  "scenario": "日志流服务持续向浏览器推数据，少量客户端几分钟不读；无界待发送缓存逐渐占满内存。",
  "constraints": [
    "客户端速度不可控",
    "日志允许断点续读",
    "单连接资源必须有上限"
  ],
  "options": [
    {
      "title": "无界缓存等待",
      "benefits": "短期减少发送丢失",
      "costs": "慢客户端可耗尽内存",
      "when": "仅理论上可证明数据严格有界"
    },
    {
      "title": "有界缓冲并背压",
      "benefits": "资源可预测",
      "costs": "可能阻塞上游",
      "when": "上游能安全减速"
    },
    {
      "title": "有界缓冲并断开续读",
      "benefits": "隔离慢消费者",
      "costs": "需要游标与可恢复记录",
      "when": "流可重放且不能拖住全局"
    }
  ],
  "recommendation": "对可重放日志设置单连接缓冲和发送预算，慢客户端断开后按游标续读；检测 context 取消并释放订阅。",
  "pitfall": "把 channel 缓冲不断扩大当作长期容量策略。",
  "mechanism": [
    "流式传输不消除排队和内存成本。",
    "慢下游会把等待传播到上游或缓存。",
    "取消需传到生产者并等待资源释放。"
  ],
  "boundary": "不可丢且不可重放的业务数据需要可靠交接，不能简单断开即丢弃。",
  "revisitWhen": [
    "上游不能减速",
    "日志保留时间小于客户端离线时间"
  ],
  "mnemonic": "慢读有上限，重连有位置。",
  "sources": [
    {
      "title": "Go net/http：请求取消",
      "url": "https://pkg.go.dev/net/http#Request.Context"
    },
    {
      "title": "gRPC：流控",
      "url": "https://grpc.io/docs/guides/flow-control/"
    }
  ],
  "diagram": [
    {
      "title": "慢消费者隔离",
      "source": "flowchart LR\n L[\"可重放日志\"] --> B[\"有界单连接缓冲\"]\n B --> C[\"客户端\"]\n B -->|超预算| D[\"断开并保留游标\"]\n D --> R[\"重连续读\"]",
      "caption": "重放依赖服务端保留记录，并非 channel 自动提供。",
      "kind": "flow"
    }
  ]
,experiment:exp("流式接口如何处理慢客户端、取消和资源上限",["无界缓存","有界与续读"],[["生产=持续","客户端=暂停读取"],["待发送=持续增长","内存=无界"]],[["生产=持续","客户端=暂停读取"],["缓冲=达到上限","连接=终止","恢复=游标续读"]]),quizzes:[q("为什么流式仍会耗尽内存？","慢客户端使待发送数据积压","流式协议从不分配内存","排队不因流式而消失。"),q("缓冲容量控制什么？","可吸收的暂时积压","长期吞吐必定变大","缓冲不增加消费者处理速率。"),q("不可重放且不可丢的数据能直接断开丢弃吗？","不能，需可靠交接策略","可以，TCP 会永久保存","传输协议不提供业务持久性。"),q("客户端取消后应？","停止生产并释放订阅资源","只停止写响应而保留后台任务","取消要贯穿生命周期。"),q("上游可减速且每条都必须处理，倾向？","有界背压而非静默丢弃","继续无限增加缓存","业务可靠性决定过载行为。"),q("行情流允许只保留最新价格，慢客户端可？","明确采用合并或丢旧策略","默认保证收到每次历史更新","可丢语义改变了策略。")]}),
lesson({
  "id": 120,
  "title": "批量接口如何表达部分成功、重试粒度和顺序",
  "scenario": "一次发送三条通知，a 和 c 成功而 b 暂时失败；客户端把整个批次重试，导致成功通知重复发送。",
  "constraints": [
    "各条通知独立",
    "允许部分成功",
    "每项有稳定 ID"
  ],
  "options": [
    {
      "title": "整批原子执行",
      "benefits": "结果只有全成全败",
      "costs": "需要可实现的共同事务边界",
      "when": "业务要求真正不可分割"
    },
    {
      "title": "逐项结果",
      "benefits": "独立失败可精确重试",
      "costs": "客户端要处理部分结果",
      "when": "各项业务独立"
    },
    {
      "title": "异步批任务",
      "benefits": "适合大量长耗时项",
      "costs": "需持久状态和结果查询",
      "when": "批次超过同步预算"
    }
  ],
  "recommendation": "为每项返回稳定 ID、状态和错误类别，只重试可恢复的失败项；每项副作用仍需幂等策略。",
  "pitfall": "把单个 HTTP 200 当整批全部成功，或仅返回位置而无稳定项标识。",
  "mechanism": [
    "传输成功和所有业务项成功不同。",
    "重试粒度应匹配副作用原子单位。",
    "顺序保证需明确是提交顺序、执行顺序还是结果排列。"
  ],
  "boundary": "代码只筛出失败项；生产还需按错误类别和预算决定是否重试，不是所有失败都可重试。",
  "revisitWhen": [
    "业务要求批内原子性",
    "单批超过大小或时间预算"
  ],
  "mnemonic": "项有身份，失败独立，重试有界。",
  "sources": [
    {
      "title": "Google AIP-233：批量创建",
      "url": "https://google.aip.dev/233"
    }
  ],
  "diagram": [
    {
      "title": "按项选择重试",
      "source": "flowchart LR\n B[\"批次 a b c\"] --> R[\"逐项结果\"]\n R --> S[\"a 与 c 成功\"]\n R --> F[\"b 可恢复失败\"]\n F --> T[\"仅重试 b\"]",
      "caption": "成功项不自动重新执行，失败项仍需分类。",
      "kind": "flow"
    }
  ],
  "code": {
    "starter": "package main\n\nimport (\n\t\"fmt\"\n)\n\ntype Result struct {\n\tID string\n\tOK bool\n}\n\nfunc retryIDs(results []Result) []string {\n\tids := []string{}\n\tfor _, r := range results {\n\t\tif true {\n\t\t\tids = append(ids, r.ID)\n\t\t}\n\t}\n\treturn ids\n}\nfunc solve() string { return fmt.Sprint(retryIDs([]Result{{\"a\", true}, {\"b\", false}, {\"c\", true}})) }\nfunc main()         { fmt.Println(solve()) }\n",
    "solution": "package main\n\nimport (\n\t\"fmt\"\n)\n\ntype Result struct {\n\tID string\n\tOK bool\n}\n\nfunc retryIDs(results []Result) []string {\n\tids := []string{}\n\tfor _, r := range results {\n\t\tif !r.OK {\n\t\t\tids = append(ids, r.ID)\n\t\t}\n\t}\n\treturn ids\n}\nfunc solve() string { return fmt.Sprint(retryIDs([]Result{{\"a\", true}, {\"b\", false}, {\"c\", true}})) }\nfunc main()         { fmt.Println(solve()) }\n",
    "starterOutput": "[a b c]",
    "expectedOutput": "[b]",
    "testCode": "package main\n\nimport (\n\t\"fmt\"\n\t\"reflect\"\n\t\"testing\"\n)\n\nvar _ = reflect.DeepEqual\nvar _ = fmt.Sprint\n\nfunc TestRetryIDs(t *testing.T) {\n\tcases := []struct {\n\t\tin   []Result\n\t\twant []string\n\t}{{[]Result{{\"a\", true}, {\"b\", false}}, []string{\"b\"}}, {[]Result{{\"x\", false}, {\"y\", false}}, []string{\"x\", \"y\"}}, {[]Result{{\"z\", true}}, []string{}}, {nil, []string{}}}\n\tfor _, c := range cases {\n\t\tif got := retryIDs(c.in); !reflect.DeepEqual(got, c.want) {\n\t\t\tt.Fatalf(\"got %v want %v\", got, c.want)\n\t\t}\n\t}\n}\nfunc BenchmarkSolution(b *testing.B) {\n\tfor i := 0; i < b.N; i++ {\n\t\tsolve()\n\t}\n}\n"
  }
,experiment:exp("批量接口如何表达部分成功、重试粒度和顺序",["整批重试","失败项重试"],[["结果=a成功 b失败 c成功","重试=a b c"],["a=重复副作用","c=重复副作用"]],[["结果=a成功 b失败 c成功","重试候选=b"],["a=保持成功","c=保持成功","b=按预算重试"]]),quizzes:[q("本题重试候选应该是？","b","a、b、c","只挑失败项避免重复已成功副作用。"),q("HTTP 200 是否证明每项成功？","不证明，需读逐项结果","证明","传输与业务层结果不同。"),q("所有失败都可重试吗？","不，须看错误类别和预算","是","验证失败等永久错误不应盲目重试。"),q("结果如何稳定关联请求项？","每项携带稳定 ID","只依赖并发完成顺序","完成顺序可能不同于提交顺序。"),q("转账批次要求整体原子，应？","验证共同事务边界或重设业务协议","直接沿用逐项独立成功语义","原子性要求改变接口设计。"),q("上传三张照片两张成功，临时失败项重试时？","保留项 ID 并只重试失败项","重建所有 ID 重新上传全部","稳定身份支持精确恢复。")]})
] satisfies Lesson[];

