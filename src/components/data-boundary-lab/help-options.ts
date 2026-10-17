export type BoundaryHelpMode = 'diagram' | 'steps' | 'try';
export type BoundaryHelpOption = {key: BoundaryHelpMode; text: string};
const labels: Record<number, readonly [string, string, string]> = {
  71: ['字段去哪了', '逐字段过筛', '修复订单契约'],
  72: ['三种更新指令', '追踪一次更新', '保住未修改字段'],
  73: ['数字在哪变了', '比较保存策略', '寻找精度反例'],
  74: ['解码器读到哪里', '搭建校验流程', '找出漏网输入'],
  75: ['输入跨过哪条边界', '对照两条查询', '修复查询入口'],
  76: ['谁占着连接', '追踪退出路径', '修复资源泄漏'],
  77: ['修改属于哪个事务', '失败后余额去哪了', '修复转账流程'],
  78: ['连接借给了谁', '追踪等待与归还', '解除自等待'],
  79: ['路径实际走向哪里', '比较三层检查', '堵住越界入口'],
  80: ['三种输出边界', '追踪编码过程', '选择正确处理方式'],
};
const modes: BoundaryHelpMode[] = ['diagram', 'steps', 'try'];
export function boundaryHelpOptions(id: number): BoundaryHelpOption[] | undefined {
  return labels[id]?.map((text, i) => ({key: modes[i], text}));
}
