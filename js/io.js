// 入出力モジュール: ファイル読み込み（input/drag&drop/paste）、PNG保存、クリップボードコピー
// 外部依存なし・他モジュールへの依存なしの純粋なI/Oユーティリティ

// ---- 内部ヘルパー ----

/**
 * File（画像）をHTMLImageElementに変換する。
 * 成功時はonImageに画像を渡し、失敗時はonStatusにエラーメッセージを渡す。
 * image/*以外のファイルはonStatusで通知して無視する。
 */
function loadImageFile(file, { onImage, onStatus }) {
  if (!file) return;

  if (!file.type || !file.type.startsWith('image/')) {
    onStatus?.('画像ファイルを選択してください');
    return;
  }

  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    onImage?.(img);
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    onStatus?.('画像の読み込みに失敗しました');
  };
  img.src = url;
}

// ---- 公開API ----

/**
 * 画像読み込みの各種イベント（ファイル選択・ドラッグ＆ドロップ・ペースト）を配線する。
 * @param {{fileInput: HTMLInputElement, onImage: (img: HTMLImageElement) => void, onStatus: (msg: string) => void}} opts
 */
export function initLoaders({ fileInput, onImage, onStatus }) {
  // ---- ファイル選択（<input type="file">） ----
  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (file) {
      loadImageFile(file, { onImage, onStatus });
    }
    // 同じファイルを連続して選択できるようにリセットする
    fileInput.value = '';
  });

  // ---- ドラッグ＆ドロップ ----
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    document.body.classList.add('dragging');
  });

  document.addEventListener('dragleave', () => {
    document.body.classList.remove('dragging');
  });

  document.addEventListener('drop', (e) => {
    e.preventDefault();
    document.body.classList.remove('dragging');
    const file = e.dataTransfer?.files && e.dataTransfer.files[0];
    if (file) {
      loadImageFile(file, { onImage, onStatus });
    }
  });

  // ---- クリップボードペースト ----
  window.addEventListener('paste', (e) => {
    // テキスト編集中（textarea/input）はペーストを妨げない
    const target = e.target;
    const tag = target?.tagName?.toLowerCase();
    if (tag === 'textarea' || tag === 'input') return;

    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          loadImageFile(file, { onImage, onStatus });
        }
        break;
      }
    }
  });
}

/**
 * キャンバスの内容をPNGファイルとしてダウンロードする。
 * @param {HTMLCanvasElement} canvas
 * @param {string} filename
 */
export function savePNG(canvas, filename) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

/**
 * キャンバスの内容をPNGとしてクリップボードにコピーする。
 * navigator.clipboardやClipboardItemが未対応の環境ではエラーをthrowする
 * （呼び出し側でcatchしてユーザーにメッセージ表示する想定）。
 * @param {HTMLCanvasElement} canvas
 */
export async function copyToClipboard(canvas) {
  // Electron環境: file://ではnavigator.clipboardが使えないためIPC経由でコピー
  if (window.electronAPI?.copyImage) {
    await window.electronAPI.copyImage(canvas.toDataURL('image/png'));
    return;
  }

  if (!navigator.clipboard || typeof window.ClipboardItem === 'undefined') {
    throw new Error('このブラウザはクリップボードへの画像コピーに対応していません');
  }

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('PNGの生成に失敗しました'));
    }, 'image/png');
  });

  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
