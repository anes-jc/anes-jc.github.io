/* ============================================================
   記事リスト（このファイルだけ編集すれば記事を追加・修正できます）

   ■ 記事を1本足すとき
     下の ARTICLES の中に、新しい { ... } のブロックを1つ足すだけ。
     一番上に足すと、トップページでも一番上（最新）に表示されます。

   ■ 各項目の意味
     date   : 表示する日付（例 "2026.06.22"）
     dow    : 曜日（"MON" / "WED" / "FRI"）
     status : 状態ラベル（"公開中" など）
     live   : 公開中なら true（緑のラベルになる）
     title  : 記事のタイトル
     url    : 記事ファイルの場所（"articles/ファイル名.html"）
     desc   : 一覧に出る短い説明
     dowTag : 曜日タグの { label:表示文字, tag:リンク先タグ } 
     tags   : タグの配列。各 { label:表示文字, tag:リンク先タグ }
              （統計テーマは label に "G02 効果の大きさを読む" のように番号を付ける）

   ※ カンマや { } の対応がズレると表示されなくなります。
     既存のブロックをコピーして書き換えるのが安全です。
   ============================================================ */

window.ARTICLES = [
  {
    date: "2026.06.20", dow: "FRI", status: "公開中", live: true,
    title: "肺を守る人工呼吸 — ARDSNet 試験と早期中止の読み方",
    url: "articles/ardsnet.html",
    desc: "ARDSで一回換気量を 6 vs 12 mL/kg で比較した古典RCT。死亡 31.0% vs 39.8%（NNT 11）。統計の山場は「試験の早期中止」をどう読むか。",
    dowTag: { label: "FRI · 古典", tag: "古典論文" },
    tags: [
      { label: "集中治療", tag: "集中治療" },
      { label: "人工呼吸", tag: "人工呼吸" },
      { label: "G03 不確実性を読む", tag: "不確実性を読む" }
    ]
  },
  {
    date: "2026.06.18", dow: "WED", status: "公開中", live: true,
    title: "ICUの譫妄を予測できるか — 機械学習モデルと ROC・AUC の読み方",
    url: "articles/delirium-prediction.html",
    desc: "COPD・呼吸不全の高齢ICU患者で譫妄を予測する機械学習モデル（AUC 0.932）。統計の山場は「ROC・AUC」と、識別と較正は別物という視点。",
    dowTag: { label: "WED · 統計・手法", tag: "統計・手法" },
    tags: [
      { label: "集中治療", tag: "集中治療" },
      { label: "譫妄", tag: "譫妄" },
      { label: "G06 統合・予測・診断を読む", tag: "統合・予測・診断を読む" }
    ]
  },
  {
    date: "2026.06.16", dow: "MON", status: "公開中", live: true,
    title: "オピオイドを使わない全身麻酔は高齢者の合併症を減らすか",
    url: "articles/ofa-elderly.html",
    desc: "高齢者の短時間手術で OFA と従来麻酔を比較した新着RCT。複合アウトカム 25.0% vs 43.5%（NNT 5）。統計の山場は「複合アウトカムの読み方」。",
    dowTag: { label: "MON · 新着RCT", tag: "新着RCT" },
    tags: [
      { label: "麻酔", tag: "麻酔" },
      { label: "オピオイドフリー麻酔", tag: "オピオイドフリー麻酔" },
      { label: "G02 効果の大きさを読む", tag: "効果の大きさを読む" }
    ]
  },
  {
    date: "2026.06.13", dow: "FRI", status: "公開中", live: true,
    title: "血糖をどこまで下げるか — NICE-SUGAR 試験",
    url: "articles/nice-sugar.html",
    desc: "重症患者の強化インスリン療法は本当に有益か。90日死亡をアウトカムにした大規模RCT。統計の山場は「絶対リスク差とNNH」。英語読解枠つき。",
    dowTag: { label: "FRI · 古典", tag: "古典論文" },
    tags: [
      { label: "集中治療", tag: "集中治療" },
      { label: "血糖管理", tag: "血糖管理" },
      { label: "G02 効果の大きさを読む", tag: "効果の大きさを読む" }
    ]
  }
];
