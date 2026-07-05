// モザイクツール: 矩形範囲を指定。実際のピクセレート描画は renderer.js が行う。
import { registerType, registerTool } from './registry.js';
import { state, genId, pushHistory, emit } from '../state.js';
import { normRect, boundsContain } from './geom.js';

function draw() {
  // renderer.js がモザイクを特別扱いで描画するため、ここでは何もしない
}

function hitTest(item, pt) {
  return boundsContain(normRect(item), pt);
}

const tool = {
  onDown(pt) {
    state.draft = {
      id: genId(),
      type: 'mosaic',
      x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y,
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
    const r = normRect(d);
    if (r.w > 4 && r.h > 4) {
      pushHistory();
      state.items.push(d);
    }
    emit();
  },
};

registerType('mosaic', { draw, hitTest });
registerTool('mosaic', tool);
