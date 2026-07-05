// 楕円ツール。arrow.jsと同じ構成（tool/type登録）に合わせた実装。
//  - tool: onDown/onMove/onUp で state.draft を操作し、onUpで items に確定
//  - type: draw(ctx, item) / hitTest(item, pt) を registry に登録
import { registerType, registerTool } from './registry.js';
import { state, genId, pushHistory, emit } from '../state.js';
import { normRect, toLocalPoint } from './geom.js';

function draw(ctx, item) {
  const { x, y, w, h } = normRect(item);
  const { color, lineWidth } = item;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = w / 2;
  const ry = h / 2;
  if (rx < 0.5 || ry < 0.5) return;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.shadowColor = 'rgba(0,0,0,.35)';
  ctx.shadowBlur = lineWidth;
  ctx.shadowOffsetY = 1;

  ctx.beginPath();
  // ctx.ellipseは回転角を直接受け取れる
  ctx.ellipse(cx, cy, rx, ry, item.rotation || 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function hitTest(item, pt) {
  const tol = Math.max(8, item.lineWidth);
  const r = normRect(item);
  pt = toLocalPoint(item, pt); // 回転を打ち消してローカル座標で判定
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const rx = r.w / 2;
  const ry = r.h / 2;
  if (rx <= 0 || ry <= 0) return false;

  // 中心からの正規化距離（楕円周上で1になる）
  const d = Math.sqrt(
    ((pt.x - cx) * (pt.x - cx)) / (rx * rx) +
    ((pt.y - cy) * (pt.y - cy)) / (ry * ry)
  );
  // 楕円周からのおおよその距離（半径の小さい方を基準にスケール）
  const distFromEdge = Math.abs(d - 1) * Math.min(rx, ry);
  return distFromEdge <= tol;
}

const tool = {
  onDown(pt) {
    state.draft = {
      id: genId(),
      type: 'ellipse',
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
    // ドラッグ幅・高さが小さすぎる（ほぼクリック）場合は破棄
    const r = normRect(d);
    if (r.w > 4 || r.h > 4) {
      pushHistory();
      state.items.push(d);
    }
    emit();
  },
};

registerType('ellipse', { draw, hitTest });
registerTool('ellipse', tool);
