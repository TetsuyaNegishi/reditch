// テキストツール: クリック位置にtextareaオーバーレイを表示し、確定時にitem化する。
// Enterで確定 / Shift+Enterで改行 / Escでキャンセル / フォーカスが外れたら確定。
import { registerType, registerTool } from './registry.js';
import { state, genId, pushHistory, emit } from '../state.js';
import { itemBounds, boundsContain } from './geom.js';
import { getCanvas } from '../renderer.js';

const FONT_STACK = '-apple-system, "Hiragino Sans", "Helvetica Neue", Arial, sans-serif';

function fontOf(item) {
  return `bold ${item.fontSize}px ${FONT_STACK}`;
}

function draw(ctx, item) {
  ctx.save();
  ctx.font = fontOf(item);
  ctx.textBaseline = 'top';
  ctx.lineJoin = 'round';
  const lineHeight = item.fontSize * 1.25;
  const lines = item.text.split('\n');
  ctx.shadowColor = 'rgba(0,0,0,.4)';
  ctx.shadowBlur = item.fontSize / 8;
  ctx.shadowOffsetY = 1;
  for (let i = 0; i < lines.length; i++) {
    const y = item.y1 + i * lineHeight;
    // 白フチで背景から浮かせて視認性を確保
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = Math.max(2, item.fontSize / 10);
    ctx.strokeText(lines[i], item.x1, y);
    ctx.fillStyle = item.color;
    ctx.fillText(lines[i], item.x1, y);
  }
  ctx.restore();
}

function hitTest(item, pt) {
  return boundsContain(itemBounds(item), pt);
}

function measure(text, fontSize) {
  const ctx = getCanvas().getContext('2d');
  ctx.save();
  ctx.font = `bold ${fontSize}px ${FONT_STACK}`;
  let w = 0;
  const lines = text.split('\n');
  for (const line of lines) {
    w = Math.max(w, ctx.measureText(line).width);
  }
  ctx.restore();
  return { w, h: lines.length * fontSize * 1.25 };
}

let editing = null; // { pt } 編集中の挿入位置（canvas内部座標）
let editorEl = null;

function getEditor() {
  if (!editorEl) {
    editorEl = document.getElementById('text-editor');
    editorEl.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        commitIfOpen();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    });
    editorEl.addEventListener('blur', () => commitIfOpen());
    editorEl.addEventListener('input', autosize);
  }
  return editorEl;
}

function autosize() {
  const el = getEditor();
  el.style.width = '1px';
  el.style.height = '1px';
  el.style.width = `${el.scrollWidth + 8}px`;
  el.style.height = `${el.scrollHeight}px`;
}

function open(pt) {
  const canvas = getCanvas();
  const el = getEditor();
  const scale = canvas.clientWidth / canvas.width;
  editing = { pt };
  el.value = '';
  el.style.display = 'block';
  el.style.left = `${canvas.offsetLeft + pt.x * scale}px`;
  el.style.top = `${canvas.offsetTop + pt.y * scale}px`;
  el.style.fontSize = `${state.fontSize * scale}px`;
  el.style.lineHeight = '1.25';
  el.style.fontFamily = FONT_STACK;
  el.style.color = state.color;
  autosize();
  // pointerupの後にフォーカス（即blurを防ぐ）
  setTimeout(() => el.focus(), 0);
}

export function commitIfOpen() {
  if (!editing) return;
  const el = getEditor();
  const text = el.value.replace(/\s+$/, '');
  const { pt } = editing;
  editing = null;
  el.style.display = 'none';
  if (text.trim() !== '') {
    const { w, h } = measure(text, state.fontSize);
    pushHistory();
    state.items.push({
      id: genId(),
      type: 'text',
      x1: pt.x, y1: pt.y,
      w, h,
      text,
      color: state.color,
      fontSize: state.fontSize,
    });
  }
  emit();
}

export function isEditing() {
  return editing != null;
}

function cancel() {
  editing = null;
  getEditor().style.display = 'none';
  emit();
}

const tool = {
  onDown() {
    // 既存の編集があればまず確定（blurで確定されるが念のため）
    commitIfOpen();
  },
  onMove() {},
  onUp(pt) {
    open(pt);
  },
};

// フォントサイズ変更後に幅・高さを再計測する（handles.jsのリサイズから使用）
function remeasure(item) {
  const { w, h } = measure(item.text, item.fontSize);
  item.w = w;
  item.h = h;
}

registerType('text', { draw, hitTest, remeasure });
registerTool('text', tool);
