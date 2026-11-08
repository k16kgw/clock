# clock

現在時刻（日本時間）を大きく表示するだけのシンプルな時計ページ。

**https://seminar.k16kgw.com/clock/**

- 24 時間表示 `HH:MM:SS` と日付（例: `2026年11月8日（日）`）
- 端末のタイムゾーン設定に関係なく常に `Asia/Tokyo` で表示
- クリック / タップ / `F` キーで全画面切り替え
- 依存ライブラリなし・ビルド不要の静的 `index.html` 1 枚

## 公開方法

GitHub Pages（`main` ブランチの root）で配信。
カスタムドメイン `seminar.k16kgw.com` はユーザーサイト `k16kgw.github.io` の設定を引き継ぐため、
このリポジトリには **`CNAME` ファイルを置かない**こと。

## ローカルで確認

```bash
open index.html
```

仕様: [docs/spec.md](docs/spec.md)
