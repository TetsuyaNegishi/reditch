# リリース手順

macOS版（Apple Silicon）のビルド・配布は [.github/workflows/release.yml](../.github/workflows/release.yml) により自動化されています。`vX.Y.Z` 形式のタグをpushすると、GitHub Actions が以下を自動実行します。

1. `npm ci` → `npm run dist`（electron-builderでdmg/zipをビルド、arm64のみ）
2. `dist/` 内の成果物からSHA256チェックサム（`SHA256SUMS.txt`）を生成
3. GitHub Releaseを作成し、dmg・zip・チェックサムを添付

## タグを切る手順

1. リリース対象の変更を `main` にマージ・push しておく
2. `package.json` の `version` をリリースするバージョンに更新する（コミットしてpush）
   ```bash
   npm version 1.1.0 --no-git-tag-version
   git add package.json package-lock.json
   git commit -m "Bump version to 1.1.0"
   git push origin main
   ```
3. `v` プレフィックス付きのタグを作成してpushする（`package.json` のバージョンと一致させる）
   ```bash
   git tag v1.1.0
   git push origin v1.1.0
   ```
4. push後、[Actionsタブ](https://github.com/TetsuyaNegishi/reditch/actions) でワークフローの進行を確認する
5. 完了後、[Releasesページ](https://github.com/TetsuyaNegishi/reditch/releases) に `Reditch-1.1.0-arm64.dmg` などの成果物が添付されていることを確認する

## 手動でワークフローを実行する場合

タグをpushせずに動作確認したい場合は、Actionsタブから `Release` ワークフローを選び `Run workflow` で手動実行できる（`workflow_dispatch` トリガー）。この場合もタグ経由と同じビルド・チェックサム生成が行われるが、GitHub Releaseの作成は行われる点に注意（既存タグが無い状態で実行するとリリースの紐付けに失敗する可能性があるため、通常はタグpushでの利用を推奨）。

## タグを間違えた場合

ローカル・リモート双方のタグを削除してから、正しいバージョンで作り直す。

```bash
git tag -d v1.1.0
git push origin :refs/tags/v1.1.0
```

対応するGitHub Releaseも手動で削除する必要がある（自動では消えない）。

## 署名・公証について

現時点ではApple Developer IDによるコード署名・公証を行っていない未署名ビルド。Apple Silicon Mac向けに署名なしで配布した場合、初回起動時にGatekeeperにより「壊れている」と表示されることがある。署名・公証を導入する場合は本ワークフローの `CSC_IDENTITY_AUTO_DISCOVERY` まわりの設定変更が必要になるため、別途対応する。

## Homebrew配布について

Homebrew Cask経由での配布は別途検討中（未着手）。本ドキュメントのリリース手順で生成されるdmg/zipとSHA256SUMS.txtは、Cask定義ファイル作成時にそのまま利用できる想定。
