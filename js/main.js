// エントリポイント: イベント配線・ツールバー制御・キーボードショートカット
import { state, subscribe, emit, undo, redo, canUndo, canRedo, pushHistory, resetForNewImage } from './state.js';
import { initRenderer, requestRender, setCanvasSize, exportCanvas } from './renderer.js';
import { getTool } from './tools/registry.js';
import { commitIfOpen, isEditing } from './tools/text.js';
import { initLoaders, savePNG, copyToClipboard } from './io.js';

// ツールモジュールの登録（import時に自己登録される）
import './tools/select.js';
import './tools/arrow.js';
import './tools/line.js';
import './tools/rect.js';
import './tools/ellipse.js';
import './tools/pen.js';
import './tools/mosaic.js';
// text.jsは上でimport済み

const canvas = document.getElementById('canvas');
const dropHint = document.getElementById('drop-hint');
const statusMessage = document.getElementById('status-message');
const imageInfo = document.getElementById('image-info');
const fileInput = document.getElementById('file-input');
const textEditor = document.getElementById('text-editor');

initRenderer(canvas);
subscribe(requestRender);
subscribe(updateToolbarState);

// ---- ステータス表示 ----
let statusTimer = null;
function setStatus(msg, transient = true) {
  statusMessage.textContent = msg;
  clearTimeout(statusTimer);
  if (transient) {
    statusTimer = setTimeout(() => {
      statusMessage.textContent = state.image ? '' : '画像を読み込んで注釈を付けましょう';
    }, 4000);
  }
}

// ---- 画像読み込み ----
function handleImage(img) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  setCanvasSize(w, h);
  resetForNewImage(img);
  dropHint.style.display = 'none';
  document.body.classList.add('has-image');
  imageInfo.textContent = `${w} × ${h}px`;
  setStatus('画像を読み込みました', true);
}

initLoaders({ fileInput, onImage: handleImage, onStatus: setStatus });

document.getElementById('btn-open').addEventListener('click', () => fileInput.click());
document.getElementById('btn-open-inline').addEventListener('click', () => fileInput.click());

// ---- 書き出し ----
document.getElementById('btn-save').addEventListener('click', () => {
  if (!state.image) return setStatus('先に画像を読み込んでください');
  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  savePNG(exportCanvas(), `reditch-${ts}.png`);
  setStatus('PNGを保存しました');
});

document.getElementById('btn-copy').addEventListener('click', async () => {
  if (!state.image) return setStatus('先に画像を読み込んでください');
  try {
    await copyToClipboard(exportCanvas());
    setStatus('クリップボードにコピーしました');
  } catch (err) {
    console.error(err);
    setStatus('コピーに失敗しました（PNG保存をご利用ください）');
  }
});

// ---- ツールバー: ツール選択 ----
const toolButtons = document.querySelectorAll('.tool-btn');
function setTool(name) {
  commitIfOpen();
  state.tool = name;
  state.selectedId = null;
  toolButtons.forEach((b) => b.classList.toggle('active', b.dataset.tool === name));
  canvas.dataset.tool = name;
  emit();
}
toolButtons.forEach((btn) => btn.addEventListener('click', () => setTool(btn.dataset.tool)));

// ---- ツールバー: 色・サイズ ----
document.querySelectorAll('.swatch').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.color = btn.dataset.color;
    document.querySelectorAll('.swatch').forEach((b) => b.classList.toggle('active', b === btn));
    // 選択中のitemがあれば色を変更
    const sel = state.items.find((it) => it.id === state.selectedId);
    if (sel && sel.color != null) {
      pushHistory();
      sel.color = state.color;
      emit();
    }
  });
});

document.getElementById('line-width').addEventListener('change', (e) => {
  state.lineWidth = Number(e.target.value);
  const sel = state.items.find((it) => it.id === state.selectedId);
  if (sel && sel.lineWidth != null) {
    pushHistory();
    sel.lineWidth = state.lineWidth;
    emit();
  }
});

document.getElementById('font-size').addEventListener('change', (e) => {
  state.fontSize = Number(e.target.value);
  const sel = state.items.find((it) => it.id === state.selectedId);
  if (sel && sel.type === 'text') {
    pushHistory();
    sel.fontSize = state.fontSize;
    emit();
  }
});

// ---- Undo / Redo ----
const btnUndo = document.getElementById('btn-undo');
const btnRedo = document.getElementById('btn-redo');
btnUndo.addEventListener('click', undo);
btnRedo.addEventListener('click', redo);

function updateToolbarState() {
  btnUndo.disabled = !canUndo();
  btnRedo.disabled = !canRedo();
}

// ---- ポインタイベント ----
function toCanvasPt(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) * canvas.width) / r.width,
    y: ((e.clientY - r.top) * canvas.height) / r.height,
  };
}

canvas.addEventListener('pointerdown', (e) => {
  if (!state.image || e.button !== 0) return;
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {
    // 合成イベント等でpointerIdが無効な場合は無視（キャプチャなしでも動作する）
  }
  getTool(state.tool)?.onDown(toCanvasPt(e));
});
canvas.addEventListener('pointermove', (e) => {
  if (!state.image) return;
  getTool(state.tool)?.onMove(toCanvasPt(e));
});
canvas.addEventListener('pointerup', (e) => {
  if (!state.image) return;
  getTool(state.tool)?.onUp(toCanvasPt(e));
});

// ---- キーボードショートカット ----
const TOOL_KEYS = {
  v: 'select', a: 'arrow', l: 'line', r: 'rect',
  o: 'ellipse', p: 'pen', t: 'text', m: 'mosaic',
};

document.addEventListener('keydown', (e) => {
  // テキスト編集中はショートカット無効
  if (isEditing() || e.target === textEditor) return;

  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    e.shiftKey ? redo() : undo();
    return;
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedId != null) {
    e.preventDefault();
    pushHistory();
    state.items = state.items.filter((it) => it.id !== state.selectedId);
    state.selectedId = null;
    setStatus('注釈を削除しました');
    emit();
    return;
  }
  if (e.key === 'Escape') {
    state.selectedId = null;
    emit();
    return;
  }
  if (!mod && TOOL_KEYS[e.key.toLowerCase()]) {
    setTool(TOOL_KEYS[e.key.toLowerCase()]);
  }
});

// ---- Electron連携（メニュー・キャプチャ・ドラッグアウト） ----
if (window.electronAPI) {
  document.body.classList.add('is-electron');

  window.electronAPI.onMenu((action) => {
    if (action === 'open') fileInput.click();
    else if (action === 'save') document.getElementById('btn-save').click();
    else if (action === 'copy-image') document.getElementById('btn-copy').click();
  });

  // キャプチャ完了時にメインプロセスから画像を受け取る
  window.electronAPI.onLoadImage((dataURL) => {
    const img = new Image();
    img.onload = () => handleImage(img);
    img.onerror = () => setStatus('キャプチャ画像の読み込みに失敗しました');
    img.src = dataURL;
  });

  document.getElementById('btn-capture').addEventListener('click', () => {
    window.electronAPI.captureRegion();
  });

  // ドラッグアウト: 合成PNGをOSネイティブドラッグで他アプリへ渡す
  document.getElementById('drag-out').addEventListener('dragstart', (e) => {
    e.preventDefault();
    if (!state.image) {
      setStatus('先に画像を読み込んでください');
      return;
    }
    commitIfOpen();
    window.electronAPI.startDrag(exportCanvas().toDataURL('image/png'));
  });
}

// 初期描画
emit();
