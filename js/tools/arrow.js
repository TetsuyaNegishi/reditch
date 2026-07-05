// 矢印ツール。図形系ツールの手本実装:
//  - tool: onDown/onMove/onUp で state.draft を操作し、onUpで items に確定
//  - type: draw(ctx, item) / hitTest(item, pt) を registry に登録
import { registerType, registerTool } from './registry.js';
import { state, genId, pushHistory, emit } from '../state.js';
import { distToSegment } from './geom.js';

function draw(ctx, item) {
  const { x1, y1, x2, y2, color, lineWidth } = item;
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 1) return;

  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLen = Math.min(Math.max(lineWidth * 3.5, 14), len * 0.6);
  const headWidth = headLen * 0.7;
  // 軸線は矢じりの根本まで（先端に線がはみ出さないように）
  const bx = x2 - Math.cos(angle) * headLen;
  const by = y2 - Math.sin(angle) * headLen;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(0,0,0,.35)';
  ctx.shadowBlur = lineWidth;
  ctx.shadowOffsetY = 1;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(bx, by);
  ctx.stroke();

  const perpX = Math.cos(angle + Math.PI / 2) * headWidth / 2;
  const perpY = Math.sin(angle + Math.PI / 2) * headWidth / 2;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(bx + perpX, by + perpY);
  ctx.lineTo(bx - perpX, by - perpY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function hitTest(item, pt) {
  const tol = Math.max(8, item.lineWidth);
  return distToSegment(pt.x, pt.y, item.x1, item.y1, item.x2, item.y2) <= tol;
}

const tool = {
  onDown(pt) {
    state.draft = {
      id: genId(),
      type: 'arrow',
      x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y,
      color: state.color,
      lineWidth: state.lineWidth,
    };
    emit();
  },
  onMove(pt) {
    if (!state.draft) return;
    state.draft.x2 = pt.x;
    state.draft.y2 = pt.y;
    emit();
  },
  onUp() {
    const d = state.draft;
    if (!d) return;
    state.draft = null;
    // クリックしただけ（移動距離ほぼゼロ）は破棄
    if (Math.hypot(d.x2 - d.x1, d.y2 - d.y1) > 3) {
      pushHistory();
      state.items.push(d);
    }
    emit();
  },
};

registerType('arrow', { draw, hitTest });
registerTool('arrow', tool);
