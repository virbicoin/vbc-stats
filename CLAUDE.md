# CLAUDE.md - VBC Stats Project Guide

このファイルはAIアシスタント（Claude）がこのコードベースを効果的に理解・操作するためのガイドです。

## プロジェクト概要

**VBC Stats** はVirBiCoin/GreenVibes Coin (GVBC)ブロックチェーンネットワークのリアルタイム統計ダッシュボードです。

### 技術スタック

- **フロントエンド**: React 19 + Vite 8（SPA）, TypeScript 6
- **スタイリング**: Tailwind CSS 4（`@tailwindcss/postcss`）
- **チャート**: Recharts
- **マップ**: Leaflet, React-Leaflet
- **リアルタイム通信**: Primus 8 (WebSocket)
- **バックエンド**: Express 5, Node.js 20+
- **地理情報**: geoip-lite
- **Lint**: ESLint 10（`@eslint-react` + `typescript-eslint`）
- **ビルド/開発**: Vite 8（`@vitejs/plugin-react`）。開発時は server.ts が Vite を middleware mode で内包
- **ランタイム**: tsx（server.ts を TypeScript のまま実行）

## プロジェクト構造

```
vbc-stats/
├── index.html                  # Vite エントリ HTML（metadata・フォント・#root）
├── src/                        # フロントエンドソース（SPA）
│   ├── main.tsx                # エントリポイント（createRoot）
│   ├── App.tsx                 # ルート（Header + Dashboard + Footer）
│   ├── Dashboard.tsx           # メインダッシュボード（旧 app/page.tsx）
│   ├── index.css               # グローバルスタイル（Tailwind）
│   ├── components/             # 再利用可能UIコンポーネント
│   │   ├── Charts.tsx          # チャートグリッド（Recharts、Map を lazy ロード）
│   │   ├── HalvingCountdown.tsx # ブロック報酬削減カウントダウン
│   │   ├── Nodes.tsx           # ノードテーブル
│   │   ├── Map.tsx             # Leafletマップコンポーネント
│   │   ├── MinerBlocks.tsx     # マイナーブロック表示
│   │   ├── header.tsx          # ヘッダー
│   │   └── footer.tsx          # フッター
│   ├── types/                  # TypeScript型定義
│   │   ├── server.d.ts         # Primus等のambient型宣言
│   │   └── stats.ts            # 統計データ型定義
│   └── vite-env.d.ts           # Vite クライアント型参照
├── lib/                        # サーバーサイドライブラリ（TypeScript）
│   ├── express.ts              # Expressアプリ設定（/geoip 配線）
│   ├── collection.ts           # ノードコレクション管理
│   ├── routes/
│   │   └── geoip.ts            # GeoIP APIハンドラ（Express）
│   └── utils/
│       └── config.ts           # サーバー設定（banned/reserved）
├── server.ts                   # 統合サーバー（Express + Vite/static + Primus）
├── vite.config.ts              # Vite 設定（client build → dist/、@ エイリアス）
├── public/                     # 静的ファイル
├── tsconfig.json               # 型チェック設定（src + server.ts + lib、paths: @/* → ./src/*）
└── Dockerfile                  # 本番Dockerイメージ
```

## 開発コマンド

```bash
# 開発サーバー起動（server.ts が Vite を middleware mode で内包し、WebSocketと単一ポートで統合）
npm run dev

# 本番ビルド
npm run build

# 本番サーバー起動
npm run start

# リント & フォーマット確認 & 型チェック
npm run check

# コードフォーマット
npm run format

# 型チェックのみ
npm run typecheck
```

### Git フック（pre-push）

`npm install` 時に `prepare` スクリプトが `core.hooksPath` を `.githooks` に設定します。`git push` の前に [.githooks/pre-push](.githooks/pre-push) が自動で `npm run check` を実行し、失敗すると push が中止されます（CI と同一のチェック）。

```bash
# 失敗時の自動修正
npm run lint:fix && npm run format

# 緊急時のみスキップ（非推奨）
git push --no-verify
```

## 環境変数

`.env`ファイルで設定（`.gitignore`に含まれています）：

```env
PORT=5000              # 統合サーバーポート（Vite/static + WebSocket）
WS_SECRET=xxx          # WebSocket認証シークレット（複数可：xxx|yyy|zzz）
VITE_WS_URL=           # クライアント用WebSocket URL（省略時は同一オリジン、Viteがバンドルに露出）
```

## 重要な実装パターン

### 1. 統合サーバーアーキテクチャ

開発時は `server.ts` が単一ポートでクライアント配信（Vite middleware）と Primus WebSocket を同時に提供。本番はフロント（`dist/`）を Nginx が静的配信し、下記の WebSocket と geoip のみ server.ts へリバースプロキシする（フロント/バック分離の SSG 構成、[deploy/nginx.conf.example](deploy/nginx.conf.example)）：

- `/primus` - クライアント（ブラウザ）向けWebSocket
- `/external` - 外部サービス向けWebSocket
- `/api` - ノード（マイナー）からのデータ受信WebSocket
- `/geoip` - GeoIPルックアップ（Express、`lib/routes/geoip.ts`）。Primusが`/api`を占有するため`/api`配下に置けない
- その他全て（`/`） - 開発時は Vite middleware（HMR）。本番は Nginx が `dist/` を静的配信＋SPAフォールバック（server.ts は本番で静的配信しない）

開発時の HMR WebSocket は同じ http サーバーを共有（`hmr: { server }`）し、Primus の各エンドポイントと共存する。

### 2. eth-netstats-client (geth) 互換性

geth/gvbcノードからのデータ通信プロトコル：

**Latency計測フロー:**

1. クライアント → サーバー: `node-ping` with `{id, clientTime}`
2. サーバー → クライアント: `node-pong` with `{clientTime, serverTime}`
3. クライアント → サーバー: `latency` with `{id, latency}` (RTT計算結果、文字列)

**Blockデータ:**

- gethは`difficulty`と`totalDiff`を**文字列**として送信
- `totalDiff`フィールドを`totalDifficulty`にマッピング
- 受信時に`parseInt()`で数値に変換

### 3. 数値の型安全性

`toFixed()`などのメソッド呼び出し前に必ず型チェックを行う：

```typescript
// ✅ 正しい
if (typeof value === 'number' && !isNaN(value)) {
  return value.toFixed(2);
}
return 'N/A';

// ❌ 危険
return value.toFixed(2); // valueがundefinedや文字列の場合エラー
```

### 4. ResponsiveContainerの使用

Rechartsの`ResponsiveContainer`には必ず`minWidth`と`minHeight`を指定：

```tsx
<ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
  <LineChart data={data}>...</LineChart>
</ResponsiveContainer>
```

### 5. リアルタイムデータの安定化

ブロック更新時のUI点滅を防ぐため、`stable*`状態変数パターンを使用：

```typescript
const [stableValue, setStableValue] = useState<number | null>(null);

useEffect(() => {
  if (newValue !== null && typeof newValue === 'number') {
    setStableValue(newValue);
  }
}, [newValue]);
```

### 6. パスエイリアス

- `tsconfig.json`: `"@/*": ["./src/*"]` — `src/`ディレクトリからの解決
- Vite 側は `vite.config.ts` の `resolve.alias` で同じ `@` を解決（`fileURLToPath` で `./src` を指定）
- TypeScript 6.0では`baseUrl`は非推奨（使用しない）

### 7. ブロック報酬スケジュール（Halving Countdown）

`src/components/HalvingCountdown.tsx`の定数はgo-virbicoinのコンセンサス実装を反映している
（出典: `consensus/ethash/consensus.go`, `params/config.go`）：

- 初期報酬 8 VBC。ブロック 4,200,000 を起点に 2,100,000 ブロックごとに 1 VBC ずつ線形減少
  （二分割の半減ではない）。ブロック 16,800,000 以降は最低 1 VBC で固定
- 各削減ブロックにはフォーク名あり: Quiche / Miche / Rusk / Celestia / Mafuyu / Kipfel / Lumina
- 目標ブロックタイムは 12 秒（statsの`avgBlockTime`があれば優先して残り時間を推定）
- go-virbicoin側で報酬スケジュールが変更された場合はこのコンポーネントの定数も更新すること

## コードスタイルガイドライン

### TypeScript

- strict モード有効
- 関数の引数には明示的な型を指定
- オブジェクトの形状には `interface` を優先
- パスエイリアスを使用: `@/*` は `./src/*` にマップ

### Tailwind CSS

- ユーティリティクラスを JSX に直接記述
- 順序: レイアウト → サイズ → 余白 → 視覚 → インタラクティブ
- 関連するクラスはまとめて記述

### コンポーネントのパターン

```tsx
// 明示的な型を持つ関数コンポーネント
export default function ComponentName(): React.ReactNode {
  // 最初にフック
  // イベントハンドラ
  // レンダリング
}
```

### ESLint ルール

主に適用されるルール:

- React Hooks ルール（exhaustive-deps, rules-of-hooks）
- 未使用変数の禁止（アンダースコア例外: `_varName`）
- `@eslint-react` による React ベストプラクティス

## セキュリティ

### 確認済みの対策

1. **環境変数**: `.env*`ファイルは`.gitignore`に含まれ、シークレットはリポジトリに含まれない
2. **WS認証**: APIノード接続時にWS_SECRETで認証チェック
3. **入力検証**: GeoIP APIでIPアドレス形式をバリデーション（IPv4正規表現）
4. **プライベートIP除外**: プライベートIPアドレスはGeoIPルックアップから除外
5. **接続レート制限**: API接続数を制限（C_LIMIT=5/30秒）
6. **BAN機能**: `banned`リストでIPベースのブロック対応
7. **認証チェック**: 全てのAPIイベントハンドラで`spark.auth`を確認

### 既知の事項

1. **CORS**: Express側がワイドオープン（`cors()`）。API は `/geoip` のみと限定的だが、必要に応じてオリジン制限を検討
2. **X-Forwarded-For**: プロキシ経由のIP取得時にスプーフィング可能性あり

## テスト

現在、自動テストは未実装。手動テスト手順：

1. `npm run dev`でサーバー起動
2. ブラウザで`http://localhost:5000`にアクセス
3. ノードが接続され、リアルタイムデータが表示されることを確認

## 重要な注意点

1. **コミット前に必ず `npm run check` を実行** - lint・format・型チェックが通ることを保証する（`git push` 時に pre-push フックでも自動実行される）
2. **`type: "module"`**: package.jsonに`"type": "module"`を指定しているため、ESM構文を使用

## トラブルシューティング

### よくある問題

1. **チャートが表示されない**: `ResponsiveContainer`の親要素に高さが設定されているか確認
2. **WebSocket接続エラー**: ブラウザと同一ポートで動作するため、通常は設定不要
3. **GeoIPデータなし**: `node_modules/geoip-lite/data` が存在するか確認（`npm run updatedb`で更新）
4. **Latencyが0ms**: gethは文字列でlatencyを送信するため型変換を確認
5. **Total Difficultyが表示されない**: gethは`totalDiff`フィールド名で文字列として送信
6. **マップでブロック番号が"0"**: `block !== undefined && block > 0`でフィルタリング
7. **ビルド成果物が古い**: `dist/`を削除して`npm run build`、ブラウザをハードリフレッシュ（Ctrl+Shift+R）

## コミット署名（GPG）

このリポジトリのコミットは GPG 署名が有効です（`commit.gpgsign`）。AI エージェントは
秘密情報であるパスフレーズを代理入力できないため、gpg-agent のキャッシュが切れていると
`git commit` が署名失敗で中断することがあります。

- 署名が切れているときは、ユーザーがターミナルで一度パスフレーズを入力してください
  （`git commit` の再実行、または `echo test | gpg --clearsign` を一度実行）。一度
  入力すれば gpg-agent がしばらくキャッシュします。
- `pinentry-curses`（ターミナル内に入力画面を描画する pinentry）を使う環境では、温める
  前に `export GPG_TTY=$(tty)` を実行してください。これを設定しないと pinentry が正しい
  tty を掴めず、表示が乱れたり中断時に幽霊プロセスが残ることがあります。また温める際は
  `gpg --clearsign` の出力を `>/dev/null` へ捨てないでください（pinentry が tty を奪えず
  幽霊化する原因になります）。
- パスフレーズは秘密情報です。AI エージェントへ渡したりディスクへ保存したりしないで
  ください。
- コミット失敗を未然に防ぎたい場合は、コミット前にキャッシュを温める pre-commit フック
  （署名キャッシュが切れていればパスフレーズ入力を促す）を利用する方法があります。

## 関連リポジトリ

VirBiCoin エコシステムは以下のリポジトリで構成されています:

| リポジトリ                   | 役割                                             | ローカルパス        | URL                                                                                |
| ---------------------------- | ------------------------------------------------ | ------------------- | ---------------------------------------------------------------------------------- |
| **virbicoin.com**            | 公式 Web サイト（メインサイト）                  | `../virbicoin.com`  | [github.com/virbicoin/virbicoin.com](https://github.com/virbicoin/virbicoin.com)   |
| **go-virbicoin**             | メインクライアント（Gvbc, Go 実装）              | `../go-virbicoin`   | [github.com/virbicoin/go-virbicoin](https://github.com/virbicoin/go-virbicoin)     |
| **open-virbicoin**           | Rust クライアント（Ovbc, OpenEthereum フォーク） | `../open-virbicoin` | [github.com/virbicoin/open-virbicoin](https://github.com/virbicoin/open-virbicoin) |
| **vbc-stats** ← 本リポジトリ | ネットワーク統計ダッシュボード                   | `../vbc-stats`      | [github.com/virbicoin/vbc-stats](https://github.com/virbicoin/vbc-stats)           |
| **vbc-explorer**             | ブロックチェーンエクスプローラー                 | `../vbc-explorer`   | [github.com/virbicoin/vbc-explorer](https://github.com/virbicoin/vbc-explorer)     |
| **vbc-pool**                 | マイニングプール                                 | `../vbc-pool`       | [github.com/virbicoin/vbc-pool](https://github.com/virbicoin/vbc-pool)             |
| **vbc-rpc**                  | RPC ノードステータス & JSON-RPC プロキシ         | `../vbc-rpc`        | [github.com/virbicoin/vbc-rpc](https://github.com/virbicoin/vbc-rpc)               |
| **vbc-hash**                 | Ethash アルゴリズム実装（C/Go バインディング）   | `../vbc-hash`       | [github.com/virbicoin/vbc-hash](https://github.com/virbicoin/vbc-hash)             |

### 依存関係

- **open-virbicoin**: go-virbicoin（Gvbc）と同じ VirBiCoin ネットワーク（chainId 329）に接続する代替クライアント（Ovbc, Rust 実装）

- **vbc-stats** → **go-virbicoin**: Gvbc ノードが eth-netstats-client プロトコルでブロック/統計データを送信
- **vbc-explorer** → **go-virbicoin**: JSON-RPC 経由でブロックチェーンデータを取得
- **vbc-pool** → **go-virbicoin**: マイニングプールが Gvbc ノードから作業を取得
- **vbc-rpc** → **go-virbicoin**: RPC プロキシが Gvbc ノードにリクエストを中継

## 関連リソース

- [Vite Documentation](https://vite.dev/)
- [Recharts Documentation](https://recharts.org/)
- [Primus Documentation](https://github.com/primus/primus)
- [Leaflet Documentation](https://leafletjs.com/)
- [eth-netstats-client (geth)](https://github.com/ethereum/go-ethereum/tree/master/cmd/geth)
