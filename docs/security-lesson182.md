# 第 182 题：共享缓存键隔离

目标：解释同 ID 跨租户串数据；修复写、读、失效三条路径；构造冒号拼接反例；区分键隔离与授权。

呈现：两个资源到键地址的映射、缓存槽位执行视图、变更结果与预测并置。交互：配置三条键路径、顺序写入读取失效、预测和理由、回退、重置、反例输入与统一修复。条件修改清空缓存；更换可信主体或授权策略保留缓存，以观察授权边界。

帮助模式：example 使用寄存柜类比但实际操作缓存；diagram 可选中资源追踪到共享或独立槽位，切换分隔符输入；steps 引导执行碰撞、修复、不一致失效和分隔符实验；try 使用学校档案的新情境，先判断并解释，提交后反馈具体查找地址和权限缺口。帮助与主实验拥有独立 React 状态，不写进度、attempt 或 reveal。

边界：确定性内存映射，不模拟 TTL、并发、数据库回源或旧缓存迁移。后台写入是可信填充；请求读取与失效校验可信主体是否有权访问目标租户。结构化编码使用 JSON 字符串元组模拟 Go 可比较结构体键。

组件：default Lesson182Lab（无参数）；Lesson182Help({mode: 'example' | 'diagram' | 'steps' | 'try'})。根 testid security-lab-182 / security-help-182，状态节点 live-model 包含 data-state。步骤按钮 data-security-action 为 step/back/reset。

验证：node --import tsx --test tests/security-lesson182.test.ts；浏览器用 tests/browser/security-lesson182.spec.ts。模型测试覆盖串数据、不可变回退快照、三路径隔离、拼接歧义、错误失效、授权拒绝与关闭授权的边界。
