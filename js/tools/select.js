// 選択ツール: クリックで最前面のitemを選択、ドラッグで移動、
// ハンドルドラッグでリサイズ・回転・端点変更。削除はmain.jsのDeleteキー処理。
import { registerTool, getType } from './registry.js';
import { state, pushHistory, emit } from '../state.js';
import { itemBounds, boundsContain } from './geom.js';
import { hitHandle, createHandleDrag } from './handles.js';
import { getViewScale } from '../renderer.js';

let dragging = null;
// 移動: { kind:'move', item, startPt, orig, moved }
// ハンドル: { kind:'handle', drag, moved }

function findHit(pt) {
  // 後に描いたもの（配列末尾）が最前面
  for (let i = state.items.length - 1; i >= 0; i--) {
    const item = state.items[i];
    const type = getType(item.type);
    const hit = type?.hitTest
      ? type.hitTest(item, pt)
      : boundsContain(itemBounds(item), pt);
    if (hit) return item;
  }
  return null;
}

function translateItem(item, orig, dx, dy) {
  if (item.points) {
    for (let i = 0; i < item.points.length; i += 2) {
      item.points[i] = orig.points[i] + dx;
      item.points[i + 1] = orig.points[i + 1] + dy;
    }
  }
  if (orig.x1 != null) {
    item.x1 = orig.x1 + dx;
    item.y1 = orig.y1 + dy;
  }
  if (orig.x2 != null) {
    item.x2 = orig.x2 + dx;
    item.y2 = orig.y2 + dy;
  }
}

const tool = {
  onDown(pt) {
    const scale = getViewScale();

    // 1. 選択中itemのハンドルを優先的に判定（枠の外側にあるハンドルも掴めるように）
    const selected = state.items.find((it) => it.id === state.selectedId);
    if (selected) {
      const handle = hitHandle(selected, pt, 12 * scale, scale);
      if (handle) {
        const drag = createHandleDrag(selected, handle.id);
        if (drag) {
          dragging = { kind: 'handle', drag, moved: false };
          return;
        }
      }
    }

    // 2. item本体のヒット判定
    const hit = findHit(pt);
    state.selectedId = hit ? hit.id : null;
    if (hit) {
      dragging = {
        kind: 'move',
        item: hit,
        startPt: pt,
        orig: structuredClone(hit),
        moved: false,
      };
    } else {
      dragging = null;
    }
    emit();
  },
  onMove(pt) {
    if (!dragging) return;

    if (dragging.kind === 'handle') {
      if (!dragging.moved) {
        // 変更前の状態を履歴へ（applyは開始時状態基準なのでこの時点のitemsは未変更）
        pushHistory();
        dragging.moved = true;
      }
      dragging.drag.apply(pt);
      emit();
      return;
    }

    const dx = pt.x - dragging.startPt.x;
    const dy = pt.y - dragging.startPt.y;
    if (!dragging.moved && Math.hypot(dx, dy) > 2) {
      pushHistory();
      dragging.moved = true;
    }
    if (dragging.moved) {
      translateItem(dragging.item, dragging.orig, dx, dy);
      emit();
    }
  },
  onUp() {
    dragging = null;
  },
};

registerTool('select', tool);
