// 描画エンジン: ベース画像 → モザイク → 図形/文字 → 選択枠 の順に再描画する。
import { state } from './state.js';
import { getType } from './tools/registry.js';
import { itemBounds, normRect, rotatePoint } from './tools/geom.js';
import { getHandles } from './tools/handles.js';

let canvas = null;
let ctx = null;
const mosaicScratch = document.createElement('canvas');

export function initRenderer(canvasEl) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
}

export function getCanvas() {
  return canvas;
}

// キャンバス内部px / 表示px。高解像度画像でもハンドル等の見た目サイズを一定にするための係数
export function getViewScale() {
  if (!canvas || !canvas.clientWidth) return 1;
  return canvas.width / canvas.clientWidth;
}

export function setCanvasSize(w, h) {
  canvas.width = w;
  canvas.height = h;
}

let pending = false;
export function requestRender() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    render();
  });
}

export function render() {
  if (!canvas) return;
  drawScene(ctx, canvas, { withSelection: true, withDraft: true });
}

// 書き出し用: 選択枠・ドラフトを含まない合成結果を新規canvasで返す
export function exportCanvas() {
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  drawScene(out.getContext('2d'), out, { withSelection: false, withDraft: false });
  return out;
}

function drawScene(c2d, targetCanvas, { withSelection, withDraft }) {
  c2d.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
  if (!state.image) return;
  c2d.drawImage(state.image, 0, 0, targetCanvas.width, targetCanvas.height);

  const items = withDraft && state.draft ? [...state.items, state.draft] : state.items;

  // モザイクは常に画像直上（図形・文字の下）
  for (const item of items) {
    if (item.type === 'mosaic') {
      drawMosaic(c2d, targetCanvas, item, withDraft && item === state.draft);
    }
  }
  for (const item of items) {
    if (item.type !== 'mosaic') {
      getType(item.type)?.draw(c2d, item);
    }
  }

  if (withSelection && state.selectedId != null) {
    const sel = state.items.find((it) => it.id === state.selectedId);
    if (sel) drawSelectionBox(c2d, sel);
  }
}

function drawMosaic(c2d, targetCanvas, item, isDraft) {
  let { x, y, w, h } = normRect(item);
  // canvas内にクランプ
  const cx1 = Math.max(0, Math.floor(x));
  const cy1 = Math.max(0, Math.floor(y));
  const cx2 = Math.min(targetCanvas.width, Math.ceil(x + w));
  const cy2 = Math.min(targetCanvas.height, Math.ceil(y + h));
  w = cx2 - cx1;
  h = cy2 - cy1;

  if (w >= 2 && h >= 2) {
    // ブロックサイズは画像の短辺に比例（最低10px）
    const block = Math.max(10, Math.round(Math.min(targetCanvas.width, targetCanvas.height) / 60));
    const sw = Math.max(1, Math.round(w / block));
    const sh = Math.max(1, Math.round(h / block));
    mosaicScratch.width = sw;
    mosaicScratch.height = sh;
    const sctx = mosaicScratch.getContext('2d');
    // この時点のtargetCanvasはベース画像(+先行モザイク)のみ描画済み
    sctx.drawImage(targetCanvas, cx1, cy1, w, h, 0, 0, sw, sh);
    c2d.save();
    c2d.imageSmoothingEnabled = false;
    c2d.drawImage(mosaicScratch, 0, 0, sw, sh, cx1, cy1, w, h);
    c2d.restore();
  }

  if (isDraft) {
    // ドラッグ中は範囲がわかるよう破線枠を表示
    c2d.save();
    c2d.strokeStyle = 'rgba(28,126,214,.9)';
    c2d.lineWidth = 2;
    c2d.setLineDash([6, 4]);
    const r = normRect(item);
    c2d.strokeRect(r.x, r.y, r.w, r.h);
    c2d.restore();
  }
}

function drawSelectionBox(c2d, item) {
  const scale = getViewScale();
  c2d.save();
  c2d.strokeStyle = '#1c7ed6';
  c2d.lineWidth = 2 * scale;
  c2d.setLineDash([6 * scale, 4 * scale]);

  // 破線の外形: 回転対応（rect/ellipseは回転した枠、それ以外は外接矩形）
  if ((item.type === 'rect' || item.type === 'ellipse' || item.type === 'mosaic') && item.rotation) {
    const r = normRect(item);
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const corners = [
      [r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h],
    ].map(([px, py]) => rotatePoint(px, py, cx, cy, item.rotation));
    c2d.beginPath();
    c2d.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) c2d.lineTo(corners[i].x, corners[i].y);
    c2d.closePath();
    c2d.stroke();
  } else if (item.type !== 'arrow' && item.type !== 'line') {
    const b = itemBounds(item);
    c2d.strokeRect(b.x, b.y, b.w, b.h);
  }

  // ハンドル描画（端点・四隅・回転）
  const handles = getHandles(item, scale);
  c2d.setLineDash([]);
  const radius = 5 * scale;
  for (const h of handles) {
    if (h.id === 'rot') {
      // 枠上端から回転ハンドルへのステム
      const top = handles.find((x) => x.id === 'nw');
      const top2 = handles.find((x) => x.id === 'ne');
      if (top && top2) {
        c2d.beginPath();
        c2d.moveTo((top.x + top2.x) / 2, (top.y + top2.y) / 2);
        c2d.lineTo(h.x, h.y);
        c2d.stroke();
      }
    }
    c2d.beginPath();
    c2d.arc(h.x, h.y, h.id === 'rot' ? radius * 1.1 : radius, 0, Math.PI * 2);
    c2d.fillStyle = h.id === 'rot' ? '#1c7ed6' : '#fff';
    c2d.fill();
    c2d.strokeStyle = h.id === 'rot' ? '#fff' : '#1c7ed6';
    c2d.lineWidth = 2 * scale;
    c2d.stroke();
    c2d.strokeStyle = '#1c7ed6';
  }
  c2d.restore();
}
