// Electronメインプロセス: ウィンドウ生成・メニュー・クリップボードIPC・範囲キャプチャ・ドラッグアウト
const { app, BrowserWindow, Menu, globalShortcut, ipcMain, clipboard, nativeImage } = require('electron');
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CAPTURE_SHORTCUT = 'CommandOrControl+Shift+7';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'Reditch',
    backgroundColor: '#1a1c20',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, '..', 'index.html'));
  return win;
}

function sendMenu(action) {
  BrowserWindow.getFocusedWindow()?.webContents.send('menu', action);
}

function mainWindow() {
  return BrowserWindow.getAllWindows()[0] ?? null;
}

// 範囲指定スクリーンショット（macOSのscreencapture -i = 対話的範囲選択）。
// 撮影後はウィンドウを前面に出し、画像を編集画面へ読み込む。
let capturing = false;
function captureRegion() {
  if (process.platform !== 'darwin' || capturing) return;
  capturing = true;
  const win = mainWindow() ?? createWindow();
  const tmp = path.join(os.tmpdir(), `reditch-capture-${Date.now()}.png`);
  // 自分のウィンドウが写り込まないよう隠してから範囲選択を開始
  win.hide();
  execFile('/usr/sbin/screencapture', ['-i', '-x', tmp], () => {
    capturing = false;
    win.show();
    win.focus();
    // Escでキャンセルされた場合はファイルが作られない
    fs.readFile(tmp, (err, buf) => {
      if (err || buf.length === 0) return;
      const dataURL = 'data:image/png;base64,' + buf.toString('base64');
      win.webContents.send('load-image', dataURL);
      fs.unlink(tmp, () => {});
    });
  });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'ファイル',
      submenu: [
        { label: '範囲を指定してキャプチャ', accelerator: CAPTURE_SHORTCUT, click: captureRegion },
        { label: '画像を開く…', accelerator: 'CmdOrCtrl+O', click: () => sendMenu('open') },
        { type: 'separator' },
        { label: 'PNGとして保存…', accelerator: 'CmdOrCtrl+S', click: () => sendMenu('save') },
        { label: '画像をコピー', accelerator: 'Shift+CmdOrCtrl+C', click: () => sendMenu('copy-image') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      // 注: Undo/Redoは意図的に置かない（Cmd+Zをレンダラーのkeydownで処理するため、
      // メニューアクセラレータに奪わせない）
      label: '編集',
      submenu: [
        { role: 'cut', label: '切り取り' },
        { role: 'copy', label: 'コピー' },
        { role: 'paste', label: '貼り付け' },
        { role: 'selectAll', label: 'すべてを選択' },
      ],
    },
    {
      label: '表示',
      submenu: [
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// レンダラーからの画像コピー要求（navigator.clipboardはfile://では使えないため）
ipcMain.handle('copy-image', (_event, dataURL) => {
  clipboard.writeImage(nativeImage.createFromDataURL(dataURL));
});

// レンダラーからのキャプチャ要求（ツールバーのボタン）
ipcMain.handle('capture-region', () => {
  captureRegion();
});

// ドラッグアウト: 合成PNGを一時ファイルに書き出し、OSネイティブのドラッグを開始する
// （FinderやSlack等へそのままドロップできる）
ipcMain.on('start-drag', (event, dataURL) => {
  const img = nativeImage.createFromDataURL(dataURL);
  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const tmp = path.join(os.tmpdir(), `reditch-${ts}.png`);
  fs.writeFileSync(tmp, img.toPNG());
  event.sender.startDrag({
    file: tmp,
    icon: img.resize({ width: 96 }),
  });
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    buildMenu();
    createWindow();
    // アプリが背面でも効くグローバルショートカット
    globalShortcut.register(CAPTURE_SHORTCUT, captureRegion);
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
