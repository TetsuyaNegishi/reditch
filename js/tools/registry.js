// itemタイプ（draw/hitTest）とツール（onDown/onMove/onUp）のレジストリ。
// 各ツールモジュールはimport時に自身を登録する。

const types = new Map(); // type名 -> { draw(ctx, item), hitTest(item, pt) }
const tools = new Map(); // tool名 -> { onDown(pt), onMove(pt), onUp(pt), cursor? }

export function registerType(name, mod) {
  types.set(name, mod);
}
export function registerTool(name, tool) {
  tools.set(name, tool);
}
export function getType(name) {
  return types.get(name);
}
export function getTool(name) {
  return tools.get(name);
}
