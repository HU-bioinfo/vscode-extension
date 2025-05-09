# HU bioinfo launcher

`HU bioinfo launcher` は、統一された R および Python 開発環境を提供する解析用の VSCode 拡張機能です。Docker コンテナを用いて、一貫性のある開発環境をセットアップし、ユーザーに提供します。

## 機能

- **統一された開発環境**: R と Python の統一環境を Docker コンテナで提供
- **簡単なセットアップ**: VSCode の UI を通じて簡単に環境構築が可能
- **キャッシュ共有**: ライブラリやパッケージなどをキャッシュとして共有可能

## システム要件

- **サポートされている OS**: Linux, macOS
- **Windows 対応**: WSL（Windows Subsystem for Linux）経由で使用可能
- **事前要件**:
  - Docker がインストールされていること
  - Dev Container エクステンションがインストールされていること

## 基本的な使い方

1. コマンドパレットから `bioinfo-launcher: Start bioinfo-launcher` を実行
2. 作業環境ディレクトリとGitHub PATを設定
3. 環境構築後、コンテナ内でVS Codeが開き作業開始

## ディレクトリ構造

```
選択した親ディレクトリ/
├── cache/                # キャッシュディレクトリ
└── container/            # コンテナ設定とプロジェクト
```

## 詳細情報

詳細な情報は以下のドキュメントを参照してください:

- [仕様書](docs/specification.md) - 拡張機能の詳細仕様と実装内容

## License

MIT License
