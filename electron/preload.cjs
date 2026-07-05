// レンダラーへ公開する最小限のブリッジ
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // canvasのdataURLをOSクリップボードへ画像としてコピー
  copyImage: (dataURL) => ipcRenderer.invoke('copy-image', dataURL),
  // 範囲指定スクリーンショットを開始（macOSのみ）
  captureRegion: () => ipcRenderer.invoke('capture-region'),
  // 合成PNGのOSネイティブドラッグを開始
  startDrag: (dataURL) => ipcRenderer.send('start-drag', dataURL),
  // アプリメニューからのアクション（'open' | 'save' | 'copy-image'）
  onMenu: (handler) => {
    ipcRenderer.on('menu', (_event, action) => handler(action));
  },
  // メインプロセスからの画像読み込み（キャプチャ完了時）
  onLoadImage: (handler) => {
    ipcRenderer.on('load-image', (_event, dataURL) => handler(dataURL));
  },
});
