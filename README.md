# ラフトバーチャル

スマホ向けの見下ろし型バーチャル空間です。

## 機能
- 初回に8人のキャラクターから選択
- 同じ部屋でキャラの重複選択をロック
- バーチャルスティック + キーボード移動
- `idle` / `run` の2フレームアニメーション
- 未作成画像は自動で空白プレースホルダー表示
- 部屋内プレイヤーの位置・向きをリアルタイム同期

## ローカル実行
```bash
python3 -m http.server 4173
# http://127.0.0.1:4173
```

## GitHub Pages 公開
1. このフォルダを GitHub リポジトリへ push
2. GitHub の `Settings` -> `Pages`
3. `Build and deployment` を `Deploy from a branch` にする
4. Branch を `main` / Folder を `/ (root)` に設定して保存
5. 数分後に `https://<user>.github.io/<repo>/` で公開

## 使い方
- 画面上部で部屋IDを変更すると、別部屋として入室できます
- 「招待URLをコピー」で同じ部屋に他メンバーを招待できます
- キー `f` で全画面切替
