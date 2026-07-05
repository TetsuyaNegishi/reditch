// 幾何ユーティリティ（全ツール共通）

export function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// x1/y1/x2/y2 を正規化した矩形 {x, y, w, h}
export function normRect(item) {
  const x = Math.min(item.x1, item.x2);
  const y = Math.min(item.y1, item.y2);
  return { x, y, w: Math.abs(item.x2 - item.x1), h: Math.abs(item.y2 - item.y1) };
}

// itemの外接矩形（選択枠・当たり判定のフォールバック用）
export function itemBounds(item) {
  let x1, y1, x2, y2;
  if (item.points) {
    x1 = x2 = item.points[0];
    y1 = y2 = item.points[1];
    for (let i = 2; i < item.points.length; i += 2) {
      x1 = Math.min(x1, item.points[i]);
      x2 = Math.max(x2, item.points[i]);
      y1 = Math.min(y1, item.points[i + 1]);
      y2 = Math.max(y2, item.points[i + 1]);
    }
  } else if (item.w != null) {
    // テキスト等、左上+サイズを持つitem
    x1 = item.x1;
    y1 = item.y1;
    x2 = item.x1 + item.w;
    y2 = item.y1 + item.h;
  } else {
    x1 = Math.min(item.x1, item.x2);
    y1 = Math.min(item.y1, item.y2);
    x2 = Math.max(item.x1, item.x2);
    y2 = Math.max(item.y1, item.y2);
  }
  const pad = (item.lineWidth ?? 0) / 2 + 4;
  return { x: x1 - pad, y: y1 - pad, w: x2 - x1 + pad * 2, h: y2 - y1 + pad * 2 };
}

export function boundsContain(b, pt) {
  return pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h;
}

// (px,py) を (cx,cy) 中心に angle ラジアン回転した点を返す
export function rotatePoint(px, py, cx, cy, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = px - cx;
  const dy = py - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

// 回転を持つitem（rect/ellipse）の当たり判定用: 点をitemのローカル座標（無回転状態）へ逆変換
export function toLocalPoint(item, pt) {
  const rot = item.rotation || 0;
  if (rot === 0) return pt;
  const r = normRect(item);
  return rotatePoint(pt.x, pt.y, r.x + r.w / 2, r.y + r.h / 2, -rot);
}
