// 四角形ツール。arrow.jsと同じ構成（tool/type登録）に合わせた実装。
//  - tool: onDown/onMove/onUp で state.draft を操作し、onUpで items に確定
//  - type: draw(ctx, item) / hitTest(item, pt) を registry に登録
import { registerType, registerTool } from './registry.js';
import { state, genId, pushHistory, emit } from '../state.js';
import { normRect, boundsContain, toLocalPoint } from './geom.js';

function draw(ctx, item) {
  const { x, y, w, h } = normRect(item);
  const { color, lineWidth } = item;

  ctx.save();
  // 回転はitem中心を基準に適用
  if (item.rotation) {
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(item.rotation);
    ctx.translate(-(x + w / 2), -(y + h / 2));
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,.35)';
  ctx.shadowBlur = lineWidth;
  ctx.shadowOffsetY = 1;

  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

function hitTest(item, pt) {
  const tol = Math.max(8, item.lineWidth);
  const r = normRect(item);
  pt = toLocalPoint(item, pt); // 回転を打ち消してローカル座標で判定

  // 外側矩形（tol分拡大）
  const outer = { x: r.x - tol, y: r.y - tol, w: r.w + tol * 2, h: r.h + tol * 2 };
  if (!boundsContain(outer, pt)) return false;

  // 内側矩形（tol分縮小）。幅・高さが0以下なら枠線判定は不要（外側判定のみで確定）
  const innerW = r.w - tol * 2;
  const innerH = r.h - tol * 2;
  if (innerW <= 0 || innerH <= 0) return true;

  const inner = { x: r.x + tol, y: r.y + tol, w: innerW, h: innerH };
  // 内側矩形の中にも含まれる場合は、枠線ではなく内部＝ヒットしない
  return !boundsContain(inner, pt);
}

const tool = {
  onDown(pt) {
    state.draft = {
      id: genId(),
      type: 'rect',
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

registerType('rect', { draw, hitTest });
registerTool('rect', tool);
