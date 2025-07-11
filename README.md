# HU bioinfo launcher

`HU bioinfo launcher` は、統一された R および Python 開発環境を提供する解析用の VSCode 拡張機能です。Docker コンテナを用いて、一貫性のある開発環境をセットアップし、ユーザーに提供します。

## 最新機能 (v1.4.2)

- **Docker イメージ自動更新機能**: DockerHub のイメージが更新された場合、自動的に検知して既存コンテナのリビルドを提案
- **コンテナイメージ設定機能**: 複数の Docker イメージから選択可能

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

### 初回セットアップ

1. コマンドパレットから `bioinfo-launcher: Start bioinfo-launcher` を実行
2. 作業環境ディレクトリを選択
3. GitHub Personal Access Token (PAT) を入力
4. 環境構築後、コンテナ内で VS Code が開き作業開始

### コマンド一覧

- `bioinfo-launcher: Start bioinfo-launcher` - 開発環境の起動
- `bioinfo-launcher: Reset Configuration` - 設定のリセットと再構築
- `bioinfo-launcher: Configure Container Image` - コンテナイメージの設定

## ディレクトリ構造

```
選択した親ディレクトリ/
├── cache/                # キャッシュディレクトリ
└── container/            # コンテナ設定とプロジェクト
```

## ドキュメント

- [仕様書](docs/specification.md) - 拡張機能の詳細仕様と実装内容

## 開発環境設定

開発環境の主な要件:

1. Node.js と npm
2. Docker (エンドユーザー環境用)
3. VS Code と開発用拡張機能

### テスト実行

```bash
# ユニットテストを実行
npm test

# カバレッジレポート付きで実行
npm run test:coverage
```

## 貢献ガイドライン

開発に貢献する場合は、以下のガイドラインに従ってください:

1. [仕様書](docs/specification.md) に記載されたアーキテクチャと設計方針に準拠する
2. 新機能追加時は対応するテストを追加する
3. コミットメッセージは明確で簡潔な内容にする
4. プルリクエスト前に既存のテストがすべて通過することを確認する
5. 仕様変更やコードの修正を行う場合、まず docs を確認しこれから行おうとしている修正をプランとして doc に記述する
6. コードの修正はプランを確認しながら行い、もしも修正がうまくいかずにプランの変更が必要であれば docs を修正してから次の修正に取り掛かる

## 今後の開発計画

1. **テスト強化**
   - ユニットテストのカバレッジ向上
   - モックを活用したテスト強化
   - CI/CD パイプラインの構築

2. **機能強化**
   - Windows 環境のネイティブサポート
   - UI/UX の改善
   - より詳細な設定オプションの追加
   - 多言語対応

3. **パフォーマンス最適化**
   - Docker イメージのサイズと起動時間の最適化
   - リソース使用量のモニタリングと改善

## License

MIT License
