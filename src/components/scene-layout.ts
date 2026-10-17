import type {Frame, SceneNode} from '../content/types';

// Only literal arrays become cells; descriptors and prose keep their punctuation.
export function arrayCells(value: string): string[] | null {
  if (!/^\[[^\[\]]*\]$/.test(value)) return null;
  return value.slice(1, -1).split(/[,，\s]+/u).filter(Boolean);
}
export function wrapText(text: string, width: number, size: number): string[] {
  const lines: string[] = [];
  let line = '', used = 0;
  for (const char of Array.from(text)) {
    const advance = /[\u0020-\u007e]/u.test(char) ? size * .62 : size;
    if (char === '\n' || (used + advance > width && line)) {
      lines.push(line); line = ''; used = 0;
    }
    if (char !== '\n') { line += char; used += advance; }
  }
  lines.push(line);
  return lines;
}
export function layoutScene(frame: Frame, width: number, kind: string) {
  const linked = !!frame.edges?.length;
  const canvasWidth = linked ? Math.max(480, width) : Math.max(240, width);
  const left = Math.min(...frame.nodes.map(n=>n.x));
  const extent = Math.max(...frame.nodes.map(n=>n.x+(n.w??164)))-left;
  const scale = (canvasWidth-44)/extent;
  const columns = canvasWidth >= 580 ? 3 : canvasWidth >= 420 ? 2 : 1;
  let rowY = 22, rowHeight = 0;
  const nodes = frame.nodes.map((node, index) => {
    const w = linked ? (node.w ?? 164)*scale : (canvasWidth - 44 - (columns - 1) * 16) / columns;
    const labels = wrapText(node.label, w - 36, 12);
    const values = wrapText(node.value, w - 24, 14);
    const cells = kind === 'memory' ? arrayCells(node.value) : null;
    const cellWidth = cells?.length ? Math.max(40, ...cells.map(c => Array.from(c).reduce((s,ch)=>s+(/[\u0020-\u007e]/u.test(ch)?9:14),16))) : 40;
    const perRow = Math.max(1, Math.floor((w - 24) / cellWidth));
    const valueY = 18 + labels.length * 18;
    const h = valueY + (cells?.length ? Math.ceil(cells.length / perRow) * 40 : values.length * 21) + 18;
    if (!linked && index % columns === 0 && index) { rowY += rowHeight + 20; rowHeight = 0; }
    rowHeight = Math.max(rowHeight, h);
    return {...node, x: linked ? 22+(node.x-left)*scale : 22 + (index % columns) * (w + 16), y: linked ? node.y : rowY, w, h, labels, values, cells, perRow, valueY};
  });
  if (linked) {
    let y = 22;
    for (const originalY of [...new Set(nodes.map(n=>n.y))].sort((a,b)=>a-b)) {
      const row = nodes.filter(n=>n.y===originalY);
      const height = Math.max(...row.map(n=>n.h));
      for (const n of row) n.y=y;
      y+=height+52;
    }
  }
  return {width: canvasWidth, height: Math.max(150, ...nodes.map(n => n.y + n.h + 24)), nodes};
}
export function nodeChange(node: SceneNode, previous?: Frame) {
  if (!previous) return '';
  const before = previous.nodes.find(n => n.id === node.id && n.label === node.label)
    ?? previous.nodes.find(n => n.label === node.label);
  return !before ? '新增' : before.value !== node.value ? '更新' : '';
}

