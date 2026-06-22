/* ============================================================
   記事リスト（このファイルだけ編集すれば記事を追加・修正できます）

   ■ 記事を1本足すとき
     下の ARTICLES の中に、新しい { ... } のブロックを1つ足すだけ。
     一番上に足すと、トップページでも一番上（最新）に表示されます。

   ■ 各項目の意味
     date   : 表示する日付（例 "2026.06.22"）
     dow    : 曜日（"MON" / "WED" / "FRI"）
     status : 状態ラベル（公開日を基準に "公開中" / "公開予定" を自動判定）
     live   : 公開日を基準に自動判定（公開中なら緑のラベルになる）
     title  : 記事のタイトル
     url    : 記事ファイルの場所（"articles/ファイル名.html"）
     desc   : 一覧に出る短い説明。「対象・デザイン・主要結果・読みどころ」の順にそろえる
     dowTag : 曜日枠タグの { kind:"weekday", label:表示文字, tag:リンク先タグ }
     tags   : タグの配列。臨床タグは kind:"clinical"、統計テーマタグは kind:"stat"
              （統計テーマは label に "G02 効果の大きさを読む" のように番号を付ける）

   ※ カンマや { } の対応がズレると表示されなくなります。
     既存のブロックをコピーして書き換えるのが安全です。
   ============================================================ */

window.ARTICLES = [
  ...(window.SUNDAY_ARTICLES || []),
  {
    date: "2026.07.06", dow: "MON", status: "公開予定", live: false,
    title: "がん手術の麻酔は予後を変えるか — GA-CARES試験とITT/per-protocolの読み方",
    url: "articles/ga-cares.html",
    desc: "進行がん切除術1,763例を対象にした米国5施設の多施設RCT。プロポフォール維持麻酔は揮発性麻酔より生存を改善せず（ITT HR1.16）、per-protocolの副次結果は脆弱。読みどころはITTとper-protocolの読み分け。",
    dowTag: { kind: "weekday", label: "MON · 新着", tag: "新着論文" },
    tags: [
      { kind: "clinical", label: "麻酔", tag: "麻酔" },
      { kind: "clinical", label: "がん手術麻酔", tag: "がん手術麻酔" },
      { kind: "stat", label: "G01 研究デザインを読む", tag: "研究デザインを読む" }
    ]
  },
  {
    date: "2026.07.03", dow: "FRI", status: "公開予定", live: false,
    title: "腹臥位は重症ARDSの死亡を減らすか — PROSEVA試験とハザード比の読み方",
    url: "articles/proseva.html",
    desc: "重症ARDS 466例を対象にした多施設RCT。早期に16時間以上の腹臥位を行うと28日死亡は16.0% vs 32.8%に低下。読みどころはKaplan-Meier曲線とハザード比。",
    dowTag: { kind: "weekday", label: "FRI · 古典論文", tag: "古典論文" },
    tags: [
      { kind: "clinical", label: "集中治療", tag: "集中治療" },
      { kind: "clinical", label: "ARDS", tag: "ARDS" },
      { kind: "stat", label: "G05 時間経過と予後を読む", tag: "時間経過と予後を読む" }
    ]
  },
  {
    date: "2026.07.01", dow: "WED", status: "公開予定", live: false,
    title: "レミマゾラム麻酔中、高齢者のEEGはどう変わるか — 回帰分析で読む周波数パワーとcoherence",
    url: "articles/remimazolam-eeg-regression.html",
    desc: "レミマゾラムTIVA中の成人69例で、年齢が高いほどα/β/γ帯域パワーが低く、相対δ/θ帯域やcoherenceも変化した研究。PSIだけでは見えにくい脳波の年齢差を単回帰で読む。",
    dowTag: { kind: "weekday", label: "WED · 統計の手法", tag: "統計の手法" },
    tags: [
      { kind: "clinical", label: "麻酔", tag: "麻酔" },
      { kind: "clinical", label: "脳波モニタリング", tag: "脳波モニタリング" },
      { kind: "stat", label: "G02 効果の大きさを読む", tag: "効果の大きさを読む" }
    ]
  },
  {
    date: "2026.06.29", dow: "MON", status: "公開予定", live: false,
    title: "脊麻帝王切開の昇圧薬は何を選ぶか — ネットワークメタ解析で読む",
    url: "articles/cesarean-vasopressor-nma.html",
    desc: "脊麻帝王切開を対象にした55RCT・5487例のネットワークメタ解析。メタラミノールなどが低血圧予防で上位。読みどころはrandom-effectsによる統合とSUCRA順位、胎児アウトカムの確実性。",
    dowTag: { kind: "weekday", label: "MON · 新着", tag: "新着論文" },
    tags: [
      { kind: "clinical", label: "麻酔", tag: "麻酔" },
      { kind: "clinical", label: "産科麻酔", tag: "産科麻酔" },
      { kind: "stat", label: "G06 統合・予測・診断を読む", tag: "統合・予測・診断を読む" }
    ]
  },
  {
    date: "2026.06.26", dow: "FRI", status: "公開予定", live: false,
    title: "周術期アスピリンは心血管イベントを防げるか — POISE-2試験と要因デザインの読み方",
    url: "articles/poise-2.html",
    desc: "心血管リスクのある非心臓手術患者を対象にした2×2要因RCT。アスピリンは30日死亡/心筋梗塞を減らさず、大出血を増やした。読みどころは要因デザインとHR。",
    dowTag: { kind: "weekday", label: "FRI · 古典論文", tag: "古典論文" },
    tags: [
      { kind: "clinical", label: "麻酔", tag: "麻酔" },
      { kind: "clinical", label: "周術期心臓管理", tag: "周術期心臓管理" },
      { kind: "stat", label: "G01 研究デザインを読む", tag: "研究デザインを読む" }
    ]
  },
  {
    date: "2026.06.24", dow: "WED", status: "公開予定", live: false,
    title: "術中NSAIDsはAKIを増やすか — 傾向スコアマッチングで読む観察研究",
    url: "articles/nsaid-aki-psm.html",
    desc: "待機的大非心臓手術11,139例を対象にした単施設後ろ向きコホート。傾向スコアマッチング後のAKIは4.2% vs 4.2%（p>0.999）。読みどころは傾向スコアマッチングの仕組みと残余交絡。",
    dowTag: { kind: "weekday", label: "WED · 統計・手法", tag: "統計・手法" },
    tags: [
      { kind: "clinical", label: "麻酔", tag: "麻酔" },
      { kind: "clinical", label: "周術期鎮痛", tag: "周術期鎮痛" },
      { kind: "stat", label: "G04 バイアスと交絡を読む", tag: "バイアスと交絡を読む" }
    ]
  },
  {
    date: "2026.06.22", dow: "MON", status: "公開予定", live: false,
    title: "上神経幹 vs ESPB — 肩関節鏡手術での鎮痛と横隔神経麻痺",
    url: "articles/shoulder-block-diaphragm.html",
    desc: "肩関節鏡手術60例を対象にした単施設RCT。STBは早期鎮痛に優れ、ESPBは横隔膜運動を保ちやすい。読みどころは複数主要アウトカム。",
    dowTag: { kind: "weekday", label: "MON · 新着", tag: "新着論文" },
    tags: [
      { kind: "clinical", label: "麻酔", tag: "麻酔" },
      { kind: "clinical", label: "区域麻酔", tag: "区域麻酔" },
      { kind: "stat", label: "G01 研究デザインを読む", tag: "研究デザインを読む" }
    ]
  },
  {
    date: "2026.06.19", dow: "FRI", status: "公開予定", live: false,
    title: "肺を守る人工呼吸 — ARDSNet（ARMA）試験と早期中止の読み方",
    url: "articles/ardsnet.html",
    desc: "ARDS/急性肺損傷861例を対象にした多施設RCT。低一回換気量は死亡31.0% vs 39.8%に低下。読みどころは中間解析と早期中止。",
    dowTag: { kind: "weekday", label: "FRI · 古典論文", tag: "古典論文" },
    tags: [
      { kind: "clinical", label: "集中治療", tag: "集中治療" },
      { kind: "clinical", label: "人工呼吸", tag: "人工呼吸" },
      { kind: "stat", label: "G03 不確実性を読む", tag: "不確実性を読む" }
    ]
  },
  {
    date: "2026.06.17", dow: "WED", status: "公開予定", live: false,
    title: "ICUのせん妄を予測できるか — 機械学習モデルとROC・AUCの読み方",
    url: "articles/delirium-prediction.html",
    desc: "COPD・呼吸不全の高齢ICU患者を対象にした機械学習予測モデル研究。せん妄予測AUCは0.932。読みどころはROC・AUCと較正。",
    dowTag: { kind: "weekday", label: "WED · 統計・手法", tag: "統計・手法" },
    tags: [
      { kind: "clinical", label: "集中治療", tag: "集中治療" },
      { kind: "clinical", label: "せん妄", tag: "せん妄" },
      { kind: "stat", label: "G06 統合・予測・診断を読む", tag: "統合・予測・診断を読む" }
    ]
  },
  {
    date: "2026.06.15", dow: "MON", status: "公開予定", live: false,
    title: "オピオイドを使わない全身麻酔は高齢者の合併症を減らすか — OFA vs OBA試験",
    url: "articles/ofa-elderly.html",
    desc: "60歳以上の短時間手術400例を対象にした単施設RCT。OFAは複合合併症25.0% vs 43.5%に低下。読みどころは複合アウトカムとNNT。",
    dowTag: { kind: "weekday", label: "MON · 新着", tag: "新着論文" },
    tags: [
      { kind: "clinical", label: "麻酔", tag: "麻酔" },
      { kind: "clinical", label: "オピオイドフリー麻酔", tag: "オピオイドフリー麻酔" },
      { kind: "stat", label: "G02 効果の大きさを読む", tag: "効果の大きさを読む" }
    ]
  },
  {
    date: "2026.06.12", dow: "FRI", status: "公開中", live: true,
    title: "血糖をどこまで下げるか — NICE-SUGAR試験",
    url: "articles/nice-sugar.html",
    desc: "重症患者6,104例を対象にした大規模RCT。強化血糖管理は90日死亡を27.5% vs 24.9%に増やした。読みどころは絶対リスク差とNNH。",
    dowTag: { kind: "weekday", label: "FRI · 古典論文", tag: "古典論文" },
    tags: [
      { kind: "clinical", label: "集中治療", tag: "集中治療" },
      { kind: "clinical", label: "血糖管理", tag: "血糖管理" },
      { kind: "stat", label: "G02 効果の大きさを読む", tag: "効果の大きさを読む" }
    ]
  }
];

// 公開日は日本時間で判定する。未来の記事は台帳に保持し、公開日まで一覧に出さない。
const todayJst = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date()).replace(/-/g, ".");

window.ARTICLES = window.ARTICLES.map(article => {
  const live = article.date <= todayJst;
  return { ...article, live, status: live ? "公開中" : "公開予定" };
}).sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))
  || String(a.url || "").localeCompare(String(b.url || "")));
window.ALL_ARTICLES = window.ARTICLES;
window.PUBLISHED_ARTICLES = window.ALL_ARTICLES.filter(article => article.live);
window.ARTICLES = window.PUBLISHED_ARTICLES;
