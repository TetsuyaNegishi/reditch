// フリーハンド（ペン）ツール。arrow.jsと同じ構成（tool/type登録）に合わせた実装。
//  - item構造は x1/y1/x2/y2 ではなく points 配列 [x0,y0,x1,y1,...] を持つ
//  - tool: onDown/onMove/onUp で state.draft を操作し、onUpで items に確定
//  - type: draw(ctx, item) / hitTest(item, pt) を registry に登録
import { registerType, registerTool } from './registry.js';
import { state, genId, pushHistory, emit } from '../state.js';
import { distToSegment } from './geom.js';

function draw(ctx, item) {
  const { points, color, lineWidth } = item;
  if (!points || points.length < 4) return;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,.35)';
  ctx.shadowBlur = lineWidth;
  ctx.shadowOffsetY = 1;

  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);

  const n = points.length / 2;
  if (n === 2) {
    // 点が2個だけなら単純な直線
    ctx.lineTo(points[2], points[3]);
  } else {
    // 各セグメントの中点をquadraticCurveToの終点に使って滑らかに描画
    for (let i = 1; i < n - 1; i++) {
      const x = points[i * 2];
      const y = points[i * 2 + 1];
      const nx = points[(i + 1) * 2];
      const ny = points[(i + 1) * 2 + 1];
      const mx = (x + nx) / 2;
      const my = (y + ny) / 2;
      ctx.quadraticCurveTo(x, y, mx, my);
    }
    // 最後の点まで
    const lastX = points[(n - 1) * 2];
    const lastY = points[(n - 1) * 2 + 1];
    ctx.lineTo(lastX, lastY);
  }
  ctx.stroke();
  ctx.restore();
}

function hitTest(item, pt) {
  const tol = Math.max(8, item.lineWidth);
  const points = item.points;
  if (!points || points.length < 4) return false;
  const n = points.length / 2;
  for (let i = 0; i < n - 1; i++) {
    const x1 = points[i * 2];
    const y1 = points[i * 2 + 1];
    const x2 = points[(i + 1) * 2];
    const y2 = points[(i + 1) * 2 + 1];
    if (distToSegment(pt.x, pt.y, x1, y1, x2, y2) <= tol) return true;
  }
  return false;
}

const tool = {
  onDown(pt) {
    state.draft = {
      id: genId(),
      type: 'pen',
      points: [pt.x, pt.y],
      color: state.color,
      lineWidth: state.lineWidth,
    };
    emit();
  },
  onMove(pt) {
    if (!state.draft) return;
    const points = state.draft.points;
    const lastX = points[points.length - 2];
    const lastY = points[points.length - 1];
    // 最後の点から2px以上動いた場合のみ追加（無駄な点を間引く）
    if (Math.hypot(pt.x - lastX, pt.y - lastY) >= 2) {
      points.push(pt.x, pt.y);
      emit();
    }
  },
  onUp() {
    const d = state.draft;
    if (!d) return;
    state.draft = null;
    // 2点未満（実質1点=クリックのみ）は破棄
    if (d.points.length >= 4) {
      pushHistory();
      state.items.push(d);
    }
    emit();
  },
};

registerType('pen', { draw, hitTest });
registerTool('pen', tool);
