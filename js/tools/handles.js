// 選択中itemのハンドル（端点移動・リサイズ・回転・スケール）の定義と適用ロジック。
// renderer.js（描画）と select.js（ドラッグ操作）の両方から使われる。
import { normRect, itemBounds, rotatePoint } from './geom.js';
import { getType } from './registry.js';

// 端点を持つitem / 矩形ベースのitem の分類
const ENDPOINT_TYPES = new Set(['arrow', 'line']);
const RECT_TYPES = new Set(['rect', 'ellipse', 'mosaic']);
// 回転に対応するタイプ（モザイクはピクセル軸並行のため非対応）
const ROTATABLE = new Set(['rect', 'ellipse']);

const OPPOSITE = { nw: 'se', ne: 'sw', se: 'nw', sw: 'ne' };

// 回転ハンドルの枠上端からのオフセット（キャンバス座標。scaleで表示上一定に）
const ROT_OFFSET = 26;

function rectCorners(r) {
  return {
    nw: { x: r.x, y: r.y },
    ne: { x: r.x + r.w, y: r.y },
    se: { x: r.x + r.w, y: r.y + r.h },
    sw: { x: r.x, y: r.y + r.h },
  };
}

// item のハンドル一覧（キャンバス座標・回転適用済み）を返す。
// scale = キャンバス内部px / 表示px（高解像度画像でもハンドルの見た目サイズを一定にする）
export function getHandles(item, scale = 1) {
  if (ENDPOINT_TYPES.has(item.type)) {
    return [
      { id: 'p1', x: item.x1, y: item.y1 },
      { id: 'p2', x: item.x2, y: item.y2 },
    ];
  }

  if (RECT_TYPES.has(item.type)) {
    const r = normRect(item);
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const rot = item.rotation || 0;
    const corners = rectCorners(r);
    const handles = Object.entries(corners).map(([id, p]) => {
      const rp = rotatePoint(p.x, p.y, cx, cy, rot);
      return { id, x: rp.x, y: rp.y };
    });
    if (ROTATABLE.has(item.type)) {
      const top = rotatePoint(cx, r.y - ROT_OFFSET * scale, cx, cy, rot);
      handles.push({ id: 'rot', x: top.x, y: top.y });
    }
    return handles;
  }

  if (item.type === 'pen') {
    const b = itemBounds(item);
    return Object.entries(rectCorners(b)).map(([id, p]) => ({ id, x: p.x, y: p.y }));
  }

  if (item.type === 'text') {
    return [{ id: 'se', x: item.x1 + item.w, y: item.y1 + item.h }];
  }

  return [];
}

// pt に最も近いハンドルを返す（tolはキャンバス座標での許容距離）
export function hitHandle(item, pt, tol, scale = 1) {
  let best = null;
  let bestDist = tol;
  for (const h of getHandles(item, scale)) {
    const d = Math.hypot(pt.x - h.x, pt.y - h.y);
    if (d <= bestDist) {
      best = h;
      bestDist = d;
    }
  }
  return best;
}

// ハンドルドラッグの開始。ドラッグ中の各pointermoveで apply(pt) を呼ぶ。
// 開始時点のitem状態を基準に計算するため、適用は冪等（同じptなら同じ結果）。
export function createHandleDrag(item, handleId) {
  // --- 端点移動（矢印・直線: サイズと向きを同時に変更） ---
  if (ENDPOINT_TYPES.has(item.type)) {
    return {
      apply(pt) {
        if (handleId === 'p1') {
          item.x1 = pt.x;
          item.y1 = pt.y;
        } else {
          item.x2 = pt.x;
          item.y2 = pt.y;
        }
      },
    };
  }

  // --- 回転（rect/ellipse: 中心固定で回転） ---
  if (handleId === 'rot') {
    const r = normRect(item);
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    // ハンドルは枠の真上にあるので、ポインタ角度 + π/2 が回転角
    return {
      apply(pt) {
        item.rotation = Math.atan2(pt.y - cy, pt.x - cx) + Math.PI / 2;
      },
    };
  }

  // --- 矩形ベースのリサイズ（対角コーナーを固定、回転フレーム内で計算） ---
  if (RECT_TYPES.has(item.type)) {
    const r0 = normRect(item);
    const c0 = { x: r0.x + r0.w / 2, y: r0.y + r0.h / 2 };
    const rot = item.rotation || 0;
    const anchor = rectCorners(r0)[OPPOSITE[handleId]]; // ローカル（無回転）座標の固定点
    return {
      apply(pt) {
        // ポインタをドラッグ開始時の回転フレームのローカル座標へ
        const pl = rotatePoint(pt.x, pt.y, c0.x, c0.y, -rot);
        const lx1 = anchor.x, ly1 = anchor.y;
        const lx2 = pl.x, ly2 = pl.y;
        const w = Math.abs(lx2 - lx1);
        const h = Math.abs(ly2 - ly1);
        // ローカル中心 → ワールド中心（回転はc0周りで凍結して逆変換）
        const lc = { x: (lx1 + lx2) / 2, y: (ly1 + ly2) / 2 };
        const wc = rotatePoint(lc.x, lc.y, c0.x, c0.y, rot);
        item.x1 = wc.x - w / 2;
        item.y1 = wc.y - h / 2;
        item.x2 = wc.x + w / 2;
        item.y2 = wc.y + h / 2;
      },
    };
  }

  // --- ペンのスケール（対角コーナーを固定して点列を線形変換） ---
  if (item.type === 'pen') {
    const b = itemBounds(item);
    const corners = rectCorners(b);
    const anchor = corners[OPPOSITE[handleId]];
    const start = corners[handleId];
    const origPoints = item.points.slice();
    return {
      apply(pt) {
        const denomX = start.x - anchor.x;
        const denomY = start.y - anchor.y;
        const sx = denomX === 0 ? 1 : (pt.x - anchor.x) / denomX;
        const sy = denomY === 0 ? 1 : (pt.y - anchor.y) / denomY;
        for (let i = 0; i < origPoints.length; i += 2) {
          item.points[i] = anchor.x + (origPoints[i] - anchor.x) * sx;
          item.points[i + 1] = anchor.y + (origPoints[i + 1] - anchor.y) * sy;
        }
      },
    };
  }

  // --- テキストのサイズ変更（右下ハンドルで高さに比例したフォントサイズ） ---
  if (item.type === 'text') {
    const h0 = item.h;
    const fontSize0 = item.fontSize;
    return {
      apply(pt) {
        const ratio = Math.max(0.2, (pt.y - item.y1) / h0);
        item.fontSize = Math.max(8, Math.round(fontSize0 * ratio));
        // 幅・高さを再計測（text.jsがtypeモジュールに登録したremeasureを使用）
        getType('text')?.remeasure?.(item);
      },
    };
  }

  return null;
}
