// 状態管理 + undo/redo。itemはJSONシリアライズ可能な平坦オブジェクトのみ。
export const state = {
  image: null,      // HTMLImageElement | null
  items: [],        // 確定済み注釈
  draft: null,      // ドラッグ中の仮注釈（履歴に積まない）
  selectedId: null,
  tool: 'select',
  color: '#f03e3e',
  lineWidth: 6,
  fontSize: 32,
};

let nextId = 1;
export function genId() {
  return nextId++;
}

const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
}
export function emit() {
  for (const fn of listeners) fn();
}

const undoStack = [];
const redoStack = [];

// 確定変更の直前に呼ぶ（現在のitemsをスナップショット）
export function pushHistory() {
  undoStack.push(structuredClone(state.items));
  redoStack.length = 0;
}

export function undo() {
  if (undoStack.length === 0) return;
  redoStack.push(structuredClone(state.items));
  state.items = undoStack.pop();
  state.selectedId = null;
  emit();
}

export function redo() {
  if (redoStack.length === 0) return;
  undoStack.push(structuredClone(state.items));
  state.items = redoStack.pop();
  state.selectedId = null;
  emit();
}

export function canUndo() {
  return undoStack.length > 0;
}
export function canRedo() {
  return redoStack.length > 0;
}

// 新しい画像を読み込んだら注釈と履歴をリセット
export function resetForNewImage(image) {
  state.image = image;
  state.items = [];
  state.draft = null;
  state.selectedId = null;
  undoStack.length = 0;
  redoStack.length = 0;
  emit();
}

export function getSelectedItem() {
  return state.items.find((it) => it.id === state.selectedId) ?? null;
}
