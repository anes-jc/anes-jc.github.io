import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const articlesPath = path.join(repoRoot, "data", "articles.js");
const registryPath = path.join(repoRoot, "data", "sunday-articles.js");
const configPath = path.join(repoRoot, "data", "sunday-article.json");
const siteUrl = (process.env.SITE_URL || "https://anes-jc.github.io").replace(/\/$/, "");

function issueDateJst() {
  const value = process.env.ISSUE_DATE_JST || latestSundayJst();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("ISSUE_DATE_JST must use YYYY-MM-DD format.");
  return value;
}

function currentDateJst(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

function latestSundayJst(date = new Date()) {
  const dateString = currentDateJst(date);
  const day = new Date(`${dateString}T00:00:00Z`).getUTCDay();
  return addDays(dateString, -day);
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function issuePeriod(dateString) {
  const day = new Date(`${dateString}T00:00:00Z`).getUTCDay();
  return { start: addDays(dateString, -((day + 6) % 7)), end: dateString };
}

function loadArticles() {
  const context = { window: {}, Intl, Date };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(articlesPath, "utf8"), context, { filename: articlesPath });
  return context.window.ALL_ARTICLES || context.window.ARTICLES || [];
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function paperLink(paper) {
  if (paper.doi) return `https://doi.org/${encodeURIComponent(paper.doi)}`;
  if (paper.pmid) return `https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`;
  return `https://europepmc.org/article/${paper.source || "MED"}/${paper.id}`;
}

function sourceIdentifier(paper) {
  if (paper.doi) return `DOI: ${paper.doi}`;
  if (paper.pmid) return `PMID: ${paper.pmid}`;
  return `Europe PMC: ${paper.source || "MED"}:${paper.id}`;
}

function normalizedTitle(paper) {
  return String(paper.title || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function includesAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function includesAll(text, terms) {
  return terms.every((term) => text.includes(term));
}

function isPreprint(paper) {
  const source = String(paper.source || "").toUpperCase();
  const doi = String(paper.doi || "").toLowerCase();
  const text = `${paper.title || ""} ${paper.abstractText || ""} ${paper.pubType || ""} ${paper.journalTitle || ""}`.toLowerCase();
  return source === "PPR"
    || text.includes("preprint")
    || text.includes("research square")
    || doi.startsWith("10.21203/rs.")
    || doi.includes("/rs.3.rs-");
}

function scorePaper(paper, config) {
  const title = (paper.title || "").toLowerCase();
  const journal = (paper.journalTitle || "").toLowerCase();
  const type = (paper.pubType || "").toLowerCase();
  const terms = ["randomized", "randomised", "clinical trial", "systematic review", "meta-analysis",
    "guideline", "consensus", "multicenter", "multicentre", "prospective", "cohort"];
  let score = terms.reduce((sum, term) => sum + (title.includes(term) ? 8 : 0), 0);
  score += titleRuleFor(paper) ? 40 : 0;
  score += config.preferredJournals.some((name) => journal.includes(name.toLowerCase())) ? 20 : 0;
  score += type.includes("editorial") || type.includes("letter") || title.includes("protocol") ? -30 : 0;
  return score + Math.min(Number(paper.citedByCount || 0), 10);
}

const DOMAIN_TITLE_TERMS = [
  "anesthesia", "anaesthesia", "anesthetic", "anaesthetic",
  "postoperative pain", "postoperative nausea", "postoperative vomiting", "postoperative delirium",
  "intraoperative hypotension",
  "critical care", "intensive care", "critically ill", "icu",
  "sepsis", "septic shock", "mechanical ventilation", "ventilator", "ards",
  "airway", "intubation", "laryngoscopy", "tracheostomy", "speaking valve", "sedation", "delirium",
  "analgesia", "opioid", "regional block", "nerve block", "epidural",
  "hemodynamic", "haemodynamic", "hypotension", "vasopressor", "cardiac arrest", "resuscitation", "ecmo",
];

const DENTAL_CONTEXT_TERMS = [
  "root canal", "endodontic", "mandibular molar", "dental pulp", "tooth", "teeth",
];

const ONCOLOGY_TREATMENT_TERMS = [
  "chemotherapy", "immunotherapy", "checkpoint inhibitor", "neoadjuvant", "adjuvant therapy",
  "tislelizumab", "pembrolizumab", "nivolumab", "durvalumab",
];

const STRONG_CLINICAL_DOMAIN_TERMS = [
  "general anesthesia", "general anaesthesia", "sedation", "analgesia", "postoperative pain",
  "postoperative nausea", "postoperative vomiting", "airway", "intubation", "critical care",
  "intensive care", "critically ill", "icu", "hypotension", "vasopressor", "delirium",
];

function includesDomainTitleTerm(title) {
  return DOMAIN_TITLE_TERMS.some((term) => {
    if (/^[a-z0-9]+$/.test(term) && term.length <= 4) {
      return new RegExp(`\\b${term}\\b`, "i").test(title);
    }
    return title.includes(term);
  });
}

function isDomainRelevant(paper) {
  if (titleRuleFor(paper)) return true;
  const title = normalizedTitle(paper);
  if (includesAny(title, DENTAL_CONTEXT_TERMS)
      && !includesAny(title, ["general anesthesia", "general anaesthesia", "sedation", "airway", "intubation"])) {
    return false;
  }
  if (includesAny(title, ONCOLOGY_TREATMENT_TERMS)
      && !includesAny(title, STRONG_CLINICAL_DOMAIN_TERMS)) {
    return false;
  }
  return includesDomainTitleTerm(title);
}

function classifyStudyDesign(paper) {
  const explicitDesign = titleRuleFor(paper)?.design;
  if (explicitDesign) return explicitDesign;
  const text = `${paper.title || ""} ${paper.pubType || ""}`.toLowerCase();
  if (text.includes("protocol")) return "研究プロトコル";
  if (text.includes("non-randomized") || text.includes("non-randomised")) return "非無作為化研究";
  if (text.includes("network meta-analysis") || text.includes("network meta analysis")) {
    return "システマティックレビュー・ネットワークメタ解析";
  }
  if (text.includes("bayesian meta-analysis") || text.includes("bayesian meta analysis")) {
    return "ベイズ階層メタ解析";
  }
  const designs = [
    ["システマティックレビュー・メタ解析", ["systematic review", "meta-analysis", "meta analysis"]],
    ["無作為化比較試験", ["randomized", "randomised", "randomized controlled trial"]],
    ["ガイドライン・コンセンサス", ["guideline", "consensus", "recommendation"]],
    ["前向き研究", ["prospective"]],
    ["コホート研究", ["cohort"]],
    ["観察研究", ["observational", "cross-sectional", "case-control"]],
  ];
  return designs.find(([, terms]) => terms.some((term) => text.includes(term)))?.[0] || "原著・レビュー";
}

function deriveTheme(paper) {
  const explicitTheme = titleRuleFor(paper)?.theme;
  if (explicitTheme) return explicitTheme;
  return deriveTitleTheme(paper);
}

function derivePaperHeading(paper) {
  return titleRuleFor(paper)?.heading || `${deriveTitleTheme(paper)}に関する最新論文：${classifyStudyDesign(paper)}`;
}

function summarizeAbstractJa(paper) {
  return titleRuleFor(paper)?.summary
    || "英語タイトルと書誌情報から自動選定した論文です。誤った具体化を避けるため、対象・介入・主要評価項目・数値結果は自動要約していません。下記の原題と一次情報で確認してください。";
}

function curatedPaperRules() {
  return [
    {
      doi: "10.1007/s00423-026-04152-w",
      terms: ["spinal anesthesia", "laparoscopic colorectal surgery", "systematic review"],
      theme: "腹腔鏡下大腸手術の脊髄くも膜下麻酔",
      heading: "腹腔鏡下大腸手術で脊髄くも膜下麻酔を併用すると、鎮痛と腸管回復はどうなるか",
      design: "前向きコホート＋システマティックレビュー・メタ解析",
      summary: "前向きコホート242例と無作為化試験5件・338例のメタ解析です。全身麻酔への脊髄くも膜下麻酔の追加は、早期疼痛と術後24時間のオピオイド使用を減らしましたが、排ガス・排便・経口摂取までの時間、遷延性術後イレウス、在院日数は改善しませんでした。鎮痛補助としては有望でも、腸管回復を早める手段とはいえない結果です。",
    },
    {
      doi: "10.1007/s10877-026-01463-7",
      terms: ["closed-loop vasopressor systems", "systematic review and meta-analysis"],
      theme: "閉ループ制御による周術期循環管理",
      heading: "閉ループ昇圧薬システムは目標MAP内の時間を増やすか",
      design: "システマティックレビュー・メタ解析",
      summary: "無作為化試験6件・215例を対象とし、うち周術期の5試験をメタ解析しています。手動調整と比べて、閉ループ制御は平均動脈圧（MAP）が目標範囲内にある時間を33.94パーセントポイント増やし、低血圧の時間を18.24パーセントポイント減らしました。一方で高血圧、ノルアドレナリン総量、有害事象には明確な差がなく、研究間の異質性と小規模標本、患者中心アウトカムが未確立な点に注意が必要です。",
    },
    {
      doi: "10.1016/j.bjorl.2026.101853",
      terms: ["speaking valves", "early mobilization", "following tracheostomy"],
      theme: "気管切開後のICU早期離床",
      heading: "気管切開後のスピーキングバルブはICUでの早期離床を促すか",
      design: "前向き無作為化比較試験",
      summary: "気管切開後のICU患者90例を、標準リハビリテーションにスピーキングバルブを追加する群47例と対照群43例に割り付けた試験です。21日目のCPAx（ICUでの身体機能評価）は中央値28対22で追加群が高く、嚥下機能と生活の質も改善しました。単施設・小規模試験であり、在院日数などへの効果は今後の検証が必要です。",
    },
    {
      doi: "10.1097/eja.0000000000002459",
      terms: ["age-related patterns", "postoperative pain", "paediatric pain out registry"],
      theme: "小児の術後痛",
      heading: "小児の術後痛は年齢・性別でどう異なるか",
      design: "前向きコホート研究",
      summary: "PAIN OUTレジストリに前向き登録された4〜18歳の術後患者2,005例を解析した研究です。79%が中等度〜重度の痛みを経験し、痛みは年齢とともに強くなって12歳前後でピークとなり、特に女児で目立ちました。手術の種類やオピオイド使用量などを調整した解析でも女児では年齢に伴う増加が示され、年齢・性別を考慮した小児術後鎮痛の必要性を示しています。",
    },
    {
      doi: "10.1080/08941939.2026.2698141",
      terms: ["oliceridine", "postoperative nausea and vomiting", "apfel score", "general anesthesia"],
      theme: "全身麻酔後のPONV",
      heading: "PONV高リスク患者でオリセリジンはフェンタニルより悪心・嘔吐を減らすか",
      design: "二重盲検無作為化比較試験",
      summary: "全身麻酔とTAPブロックを受けるPONV高リスク患者280例を、オリセリジン群とフェンタニル群に無作為化した試験です。解析対象279例で、オリセリジン群はフェンタニル群に比べ悪心が12.9%対26.4%、嘔吐が6.5%対24.3%と少なく、救済制吐薬の使用も7.2%対17.1%でした。単一試験の結果であり、他の手術・患者集団への一般化には追加検証が必要です。",
    },
    {
      doi: "10.1016/j.medine.2026.502565",
      terms: ["frailty", "hospital and intensive care unit readmission", "critically ill patients", "systematic review"],
      theme: "重症患者のフレイルと再入院",
      heading: "重症患者のフレイルは退院後の病院・ICU再入院と関連するか",
      design: "システマティックレビュー・メタ解析",
      summary: "観察研究11件・計1,051,568例を統合したメタ解析です。フレイルは病院再入院リスクの上昇と関連しました（統合RR 1.66、95%信頼区間1.16〜2.37）が、ICU再入室との関連は統計学的に明確ではありませんでした（統合RR 1.55、95%信頼区間0.93〜2.58）。研究間の異質性が大きく、フレイル評価法や対象集団の違いを踏まえた解釈が必要です。",
    },
    {
      doi: "10.17085/apm.26544",
      terms: ["duloxetine", "pregabalin", "postoperative pain", "mega-liposuction"],
      heading: "デュロキセチンとプレガバリンの周術期併用は術後疼痛を改善するか",
      summary: "全身麻酔下の大量脂肪吸引術で、デュロキセチンとプレガバリンの周術期併用による術後疼痛改善を二重盲検無作為化比較試験で評価した論文です。",
    },
    {
      doi: "10.1186/s12871-026-04085-3",
      terms: ["inhalational", "intravenous anesthesia", "moyamoya disease"],
      heading: "もやもや病血行再建術で吸入麻酔と静脈麻酔の転帰を比較",
      summary: "もやもや病の血行再建術を対象に、吸入麻酔と静脈麻酔が周術期の神経学的転帰と長期予後に与える影響をシステマティックレビュー・メタ解析で比較した論文です。",
    },
    {
      doi: "10.1186/s12941-026-00873-4",
      terms: ["cefazolin", "staphylococcus aureus pneumonia", "critically ill patients"],
      heading: "ICUのMSSA肺炎でセファゾリンと抗ブドウ球菌薬を比較",
      summary: "集中治療室に入室した重症MSSA肺炎患者を対象に、セファゾリンと抗ブドウ球菌βラクタム薬の有効性を多施設コホートで比較した論文です。",
    },
    {
      doi: "10.1016/j.bja.2026.04.072",
      terms: ["single-dose intraoperative methadone", "qtc interval"],
      heading: "術中メサドン単回投与はQTc間隔を延長するか",
      summary: "全身麻酔導入時の静注メサドン単回投与とQTcFの変化を前向き観察コホートで評価した論文です。新規QTcF>500 msはメサドン群で少なく、単回投与では臨床的に意味のあるQTc延長は示されませんでした。",
    },
    {
      doi: "10.1016/j.iccn.2026.104494",
      terms: ["turnover intention", "intensive care nurses"],
      heading: "ICU看護師の離職意向はどの程度多く、何が関連するか",
      summary: "ICU看護師の「ICUを離れたい」「看護職を離れたい」という離職意向の割合と関連因子を統合したシステマティックレビュー・メタ解析です。離職意向は約3割にみられ、バーンアウト、業務負荷、人員配置、組織的支援が主要な論点です。",
    },
    {
      doi: "10.1002/jpen.70115",
      terms: ["blood phosphorus level", "clinical outcomes", "critically ill patients"],
      heading: "重症患者の血中リン値は死亡や人工呼吸期間とどう関連するか",
      summary: "成人ICU患者の血中リン値と死亡、ICU滞在、人工呼吸期間の関連を整理したシステマティックレビュー・メタ解析です。低リン血症はICU滞在・人工呼吸期間の延長と、高リン血症は死亡リスクやICU滞在・人工呼吸期間の延長と関連していましたが、エビデンスの質と異質性には注意が必要です。",
    },
    {
      doi: "10.1136/rapm-2026-107773",
      terms: ["locoregional anesthesia", "cardiac surgery"],
      heading: "心臓手術で局所・区域麻酔テクニックは鎮痛を改善するか",
      summary: "心臓手術における局所・区域麻酔テクニックの鎮痛効果を、無作為化試験のシステマティックレビュー・ネットワークメタ解析で比較しています。",
    },
    {
      doi: "10.1186/s13019-026-04486-y",
      terms: ["postoperative hepatic dysfunction", "stanford type a aortic dissection"],
      heading: "Stanford A型大動脈解離修復術後の肝機能障害のリスク因子と予後",
      summary: "Stanford A型大動脈解離修復術後の肝機能障害について、リスク因子と予後をシステマティックレビュー・メタ解析で整理した論文です。",
    },
    {
      doi: "10.1016/j.jcrc.2026.155665",
      terms: ["balanced crystalloids versus saline", "mortality", "hospitalized patients"],
      heading: "入院患者で平衡晶質液と生理食塩水の死亡への影響を比較",
      summary: "入院患者における平衡晶質液と生理食塩水を、死亡をアウトカムとしてベイズ階層メタ解析で比較した論文です。",
    },
    {
      doi: "10.1007/s00266-026-05951-8",
      terms: ["oliceridine", "alfentanil", "blepharoplasty"],
      heading: "上眼瞼再手術の局所麻酔にオリセリジンとアルフェンタニルを併用する鎮痛戦略",
      summary: "上眼瞼形成の再手術で、局所麻酔にオリセリジンとアルフェンタニルを組み合わせる鎮痛法を多施設無作為化試験で評価した論文です。",
    },
    {
      doi: "10.1038/s41598-026-57085-1",
      terms: ["methylprednisolone", "heart surgery", "pediatric"],
      heading: "小児心臓手術でメチルプレドニゾロンは転帰を改善するか",
      summary: "小児心臓手術におけるメチルプレドニゾロンを、無作為化試験のメタ解析で評価した論文です。",
    },
    {
      doi: "10.1136/rapm-2026-107741",
      terms: ["regional anesthesia", "distal radius fracture"],
      heading: "橈骨遠位端骨折手術で区域麻酔は周術期転帰と術後医療利用にどう影響するか",
      summary: "橈骨遠位端骨折修復術における区域麻酔と、周術期転帰・術後医療利用の関係を多施設後ろ向きコホートで評価した論文です。",
    },
    {
      doi: "10.1177/21501351261449205",
      terms: ["cyanotic congenital heart surgery", "normoxia", "hyperoxia"],
      heading: "チアノーゼ性先天性心疾患手術で正常酸素と高酸素を比較",
      summary: "チアノーゼ性先天性心疾患手術の周術期酸素管理について、正常酸素と高酸素を無作為化試験のメタ解析で比較した論文です。",
    },
    {
      doi: "10.1186/s12871-026-03989-4",
      terms: ["transnasal humidified rapid insufflation", "non-intubated anesthesia", "atelectasis"],
      heading: "非挿管麻酔の長時間手術でTHRIVEが術後無気肺を減らすか",
      summary: "長時間の非挿管麻酔を受ける患者で、THRIVEの使用が術後早期無気肺に与える影響を無作為化試験で検証した論文です。",
    },
    {
      doi: "10.1213/ane.0000000000008158",
      terms: ["depth of anesthesia", "motor evoked potentials", "spinal surgery"],
      heading: "若年者の脊椎手術で麻酔深度が運動誘発電位に与える影響",
      summary: "若年者の脊椎手術で、麻酔深度が運動誘発電位モニタリングに与える影響を前向きに調べた論文です。",
    },
  ];
}

function titleRuleFor(paper) {
  const doi = String(paper.doi || "").trim().toLowerCase();
  if (!doi) return undefined;
  const rule = curatedPaperRules().find((candidate) => candidate.doi === doi);
  if (!rule) return undefined;
  const title = normalizedTitle(paper);
  if (!includesAll(title, rule.terms)) {
    throw new Error(`Curated Sunday rule ${doi} does not match the source title: ${paper.title || ""}`);
  }
  return rule;
}

function deriveTitleTheme(paper) {
  const text = normalizedTitle(paper);
  const themes = [
    ["気道・呼吸管理", ["airway", "intubation", "laryngoscopy", "tracheostomy", "speaking valve", "mechanical ventilation", "ventilator", "ards"]],
    ["循環管理", ["hemodynamic", "haemodynamic", "hypotension", "blood pressure", "vasopressor", "resuscitation", "ecmo"]],
    ["周術期鎮痛・区域麻酔", ["analgesia", "postoperative pain", "opioid", "regional anesthesia", "regional anaesthesia", "nerve block", "epidural"]],
    ["敗血症管理", ["sepsis", "septic shock"]],
    ["集中治療", ["critical care", "intensive care", "critically ill", "icu", "sedation", "delirium"]],
    ["麻酔管理", ["anesthesia", "anaesthesia", "anesthetic", "anaesthetic"]],
  ];
  return themes.find(([, terms]) => includesAny(text, terms))?.[0] || "麻酔・集中治療領域";
}

function journalName(paper) {
  const name = String(
    paper.journalTitle
      || paper.journalInfo?.journal?.title
      || paper.journalInfo?.journal?.medlineAbbreviation
      || "",
  ).trim();
  const known = [
    [/^british journal of anaesthesia$/i, "British Journal of Anaesthesia"],
    [/^intensive\s*&\s*critical care nursing$/i, "Intensive and Critical Care Nursing"],
    [/^jpen\.\s*journal of parenteral and enteral nutrition$/i, "JPEN: Journal of Parenteral and Enteral Nutrition"],
  ];
  return known.find(([pattern]) => pattern.test(name))?.[1] || name;
}

function paperCardData(paper) {
  const curated = Boolean(titleRuleFor(paper));
  return {
    curated,
    heading: derivePaperHeading(paper),
    design: classifyStudyDesign(paper),
    summary: summarizeAbstractJa(paper),
    summaryLabel: curated ? "日本語メモ（論文ID照合済み）" : "安全モード（具体的要約なし）",
    title: String(paper.title || "").trim(),
    journal: journalName(paper),
    date: paper.firstPublicationDate || "",
    link: paperLink(paper),
    sourceId: sourceIdentifier(paper),
  };
}

function validatePaperCards(cards, papers) {
  if (cards.length !== papers.length) {
    throw new Error(`Rendered ${cards.length} paper cards for ${papers.length} source papers.`);
  }
  const links = new Set();
  const guardedClaims = [
    ["ICU患者", ["icu", "intensive care"]],
    ["小児心臓手術", ["pediatric", "paediatric", "heart surgery"]],
    ["上眼瞼", ["blepharoplasty"]],
    ["橈骨遠位端骨折", ["distal radius fracture"]],
    ["チアノーゼ性先天性心疾患", ["cyanotic congenital heart"]],
    ["A型大動脈解離", ["type a aortic dissection"]],
    ["平衡晶質液", ["balanced crystalloids"]],
    ["腹腔鏡下大腸手術", ["laparoscopic colorectal surgery"]],
    ["脊髄くも膜下麻酔", ["spinal anesthesia"]],
    ["閉ループ昇圧薬", ["closed-loop vasopressor"]],
    ["スピーキングバルブ", ["speaking valve"]],
    ["気管切開", ["tracheostomy"]],
  ];
  cards.forEach((card, index) => {
    const paper = papers[index];
    const title = String(paper.title || "").trim();
    const titleText = normalizedTitle(paper);
    const sourceText = `${titleText} ${String(paper.abstractText || "").toLowerCase()}`;
    if (!card.title || card.title !== title) {
      throw new Error(`Paper card ${index + 1} title does not match the source paper.`);
    }
    if (card.link !== paperLink(paper)) {
      throw new Error(`Paper card ${index + 1} link does not match the source paper.`);
    }
    if (!card.sourceId) {
      throw new Error(`Paper card ${index + 1} is missing a source identifier.`);
    }
    if (!isDomainRelevant(paper)) {
      throw new Error(`Paper card ${index + 1} is outside the anesthesia and critical care scope: ${title}`);
    }
    if (!card.heading.trim() || !card.summary.trim()) {
      throw new Error(`Paper card ${index + 1} is missing a heading or summary: ${title}`);
    }
    if (!card.curated
        && (!card.heading.includes("に関する最新論文") || !card.summary.includes("自動要約していません"))) {
      throw new Error(`Paper card ${index + 1} bypassed the safe fallback: ${title}`);
    }
    if (links.has(card.link)) {
      throw new Error(`Duplicate paper link generated: ${card.link}`);
    }
    links.add(card.link);
    for (const [claim, requiredTerms] of guardedClaims) {
      if ((card.heading.includes(claim) || card.summary.includes(claim)) && !includesAny(sourceText, requiredTerms)) {
        throw new Error(`Paper card ${index + 1} claims "${claim}" but the source metadata does not support it.`);
      }
    }
  });
}

async function fetchWithRetry(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": "anes-jc-sunday-article/1.0" } });
      if (response.ok) return response;
      lastError = new Error(`Request returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
  }
  throw lastError;
}

async function fetchLatestPapers(period, config) {
  if (process.env.SKIP_LATEST_PAPERS === "true") return [];
  const query = `FIRST_PDATE:[${period.start} TO ${period.end}] AND ${config.europePmcQuery}`;
  const params = new URLSearchParams({ query, format: "json", resultType: "core", pageSize: "100" });
  const response = await fetchWithRetry(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?${params}`);
  const body = await response.json();
  const ranked = (body.resultList?.result || []).filter((paper) => {
    const text = `${paper.title || ""} ${paper.pubType || ""}`.toLowerCase();
    return paper.title && paper.abstractText
      && !isPreprint(paper)
      && !text.includes("protocol")
      && !text.includes("editorial")
      && !text.includes("letter")
      && isDomainRelevant(paper);
  })
    .map((paper) => ({ ...paper, selectionScore: scorePaper(paper, config) }))
    .sort((a, b) => b.selectionScore - a.selectionScore
      || String(b.firstPublicationDate || "").localeCompare(String(a.firstPublicationDate || "")));
  const selected = [];
  const usedThemes = new Set();
  for (const paper of ranked) {
    const theme = deriveTheme(paper);
    if (usedThemes.has(theme)) continue;
    selected.push(paper);
    usedThemes.add(theme);
    if (selected.length === config.latestPaperCount) return selected;
  }
  for (const paper of ranked) {
    if (!selected.includes(paper)) selected.push(paper);
    if (selected.length === config.latestPaperCount) break;
  }
  return selected;
}

function runGeneratorRegressionChecks() {
  const rules = curatedPaperRules();
  const ruleDois = new Set();
  rules.forEach((rule) => {
    const doi = String(rule.doi || "").trim().toLowerCase();
    if (!doi || ruleDois.has(doi) || !rule.terms?.length || !rule.heading?.trim() || !rule.summary?.trim()) {
      throw new Error(`Sunday generator regression: invalid or duplicate curated rule for ${doi || "missing DOI"}.`);
    }
    ruleDois.add(doi);
  });

  const outOfScope = {
    id: "fixture-out-of-scope",
    source: "MED",
    title: "A systematic review and meta-analysis on survival and safety of durvalumab in early-stage non-small cell lung cancer.",
    abstractText: "Patients may require critical care during treatment.",
    journalTitle: "Oncology Review",
    pubType: "Systematic Review",
  };
  if (isDomainRelevant(outOfScope)) {
    throw new Error("Sunday generator regression: abstract-only domain wording passed the relevance filter.");
  }

  const shortTermFalsePositive = {
    ...outOfScope,
    id: "fixture-short-term-false-positive",
    title: "A particular approach to oncology treatment.",
    abstractText: "The report mentions ICU care only in its background.",
  };
  if (isDomainRelevant(shortTermFalsePositive)) {
    throw new Error("Sunday generator regression: a partial ICU text match passed the relevance filter.");
  }

  const journalOnlyFalsePositive = {
    ...outOfScope,
    id: "fixture-journal-only-false-positive",
    title: "A biomarker study of chronic musculoskeletal symptoms.",
    journalTitle: "Pain",
  };
  if (isDomainRelevant(journalOnlyFalsePositive)) {
    throw new Error("Sunday generator regression: a specialty journal name bypassed title relevance checks.");
  }

  const dentalRootCanal = {
    id: "fixture-dental-root-canal",
    source: "MED",
    doi: "10.1111/aej.70107",
    title: "Pain and Supplemental Anaesthesia in Mandibular Molar Root Canal Therapy: A Randomized Clinical Trial.",
    abstractText: "A dental study of supplemental local anaesthesia during root canal treatment.",
    journalTitle: "Australian Endodontic Journal",
    pubType: "Randomized Controlled Trial",
  };
  if (isDomainRelevant(dentalRootCanal)) {
    throw new Error("Sunday generator regression: an endodontic local anaesthesia paper passed the relevance filter.");
  }

  const oncologyTreatment = {
    id: "fixture-oncology-treatment",
    source: "MED",
    doi: "10.1016/j.ccell.2026.06.015",
    title: "Perioperative tislelizumab plus chemotherapy for resectable gastric cancer: a randomized trial.",
    abstractText: "A trial of perioperative systemic oncology treatment.",
    journalTitle: "Cancer Cell",
    pubType: "Randomized Controlled Trial",
  };
  if (isDomainRelevant(oncologyTreatment)) {
    throw new Error("Sunday generator regression: perioperative oncology treatment passed the relevance filter.");
  }

  const supportedFallback = {
    id: "fixture-supported-fallback",
    source: "MED",
    title: "Randomized trial of airway management during emergency intubation.",
    abstractText: "A randomized trial comparing two airway management strategies.",
    journalTitle: "Critical Care",
    pubType: "Randomized Controlled Trial",
  };
  if (!isDomainRelevant(supportedFallback)) {
    throw new Error("Sunday generator regression: a relevant title was rejected.");
  }
  const supportedFallbackCard = paperCardData(supportedFallback);
  if (supportedFallbackCard.curated || supportedFallbackCard.summaryLabel !== "安全モード（具体的要約なし）") {
    throw new Error("Sunday generator regression: an unknown paper bypassed safe mode.");
  }
  validatePaperCards([supportedFallbackCard], [supportedFallback]);

  const ponvFallback = {
    id: "fixture-ponv-fallback",
    source: "MED",
    title: "Influence of Oliceridine on the Incidence of Postoperative Nausea and Vomiting in High-Risk Patients Stratified Using Apfel Score After General Anesthesia: A Prospective, Randomized Controlled Clinical Study.",
    abstractText: "A prospective randomized trial in patients undergoing general anesthesia.",
    journalTitle: "Journal of Clinical Medicine",
    pubType: "Randomized Controlled Trial",
  };
  if (!isDomainRelevant(ponvFallback)) {
    throw new Error("Sunday generator regression: a PONV paper with explicit anesthesia context was rejected.");
  }
  validatePaperCards([paperCardData(ponvFallback)], [ponvFallback]);

  const colorectalAnalgesia = {
    id: "fixture-colorectal-spinal-analgesia",
    source: "MED",
    doi: "10.1007/s00423-026-04152-w",
    title: "Spinal anesthesia in laparoscopic colorectal surgery: analgesia and recovery outcomes - a cohort study and systematic review of randomized controlled studies.",
    abstractText: "A prospective cohort and meta-analysis evaluated pain, opioid use, and bowel recovery.",
    journalTitle: "Langenbeck's Archives of Surgery",
    pubType: "Journal Article",
  };
  const colorectalCard = paperCardData(colorectalAnalgesia);
  if (colorectalCard.heading.includes("形成外科")
      || colorectalCard.design !== "前向きコホート＋システマティックレビュー・メタ解析") {
    throw new Error("Sunday generator regression: colorectal spinal analgesia was misclassified.");
  }
  validatePaperCards([colorectalCard], [colorectalAnalgesia]);

  const unknownColorectalPaper = {
    ...colorectalAnalgesia,
    id: "fixture-unknown-colorectal-paper",
    doi: "10.0000/not-the-curated-paper",
  };
  const unknownColorectalCard = paperCardData(unknownColorectalPaper);
  if (unknownColorectalCard.curated
      || unknownColorectalCard.heading === colorectalCard.heading
      || unknownColorectalCard.heading.includes("形成外科")) {
    throw new Error("Sunday generator regression: a fuzzy title match reused a paper-specific summary.");
  }
  validatePaperCards([unknownColorectalCard], [unknownColorectalPaper]);

  let rejectedMismatchedTitle = false;
  try {
    titleRuleFor({
      ...colorectalAnalgesia,
      title: "An unrelated paper with a mistakenly reused DOI.",
    });
  } catch {
    rejectedMismatchedTitle = true;
  }
  if (!rejectedMismatchedTitle) {
    throw new Error("Sunday generator regression: a curated DOI was accepted without matching title evidence.");
  }
}

function renderPage({ config, issueDate, modifiedDate, period, siteArticles, papers }) {
  const pageTitle = "先週のまとめ｜最新論文3選";
  const pageDescription = `${period.start}から${period.end}の公開記事と最新論文3選をまとめる週次記事。選定論文と読みどころを短く確認できます。`;
  const pageUrl = `${siteUrl}/articles/latest-papers-${issueDate}.html`;
  const imageUrl = `${siteUrl}/assets/og/latest-papers-${issueDate}.png?v=${issueDate}`;
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": pageUrl,
    },
    headline: pageTitle,
    description: pageDescription,
    image: [imageUrl],
    datePublished: `${issueDate}T00:00:00+09:00`,
    dateModified: `${modifiedDate}T00:00:00+09:00`,
    author: {
      "@type": "Organization",
      name: "anes-jc",
    },
    publisher: {
      "@type": "Organization",
      name: "anes-jc",
    },
    inLanguage: "ja",
  }, null, 2);
  const siteArticlesHtml = siteArticles.length ? siteArticles.map((article) => `
    <li><a href="../${escapeHtml(article.url)}">${escapeHtml(article.title)}</a><span>${escapeHtml(article.date)}</span></li>`).join("")
    : "<li>今週公開されたサイト記事はありません。</li>";
  const paperCards = papers.map(paperCardData);
  validatePaperCards(paperCards, papers);
  const papersHtml = paperCards.length ? paperCards.map((card) => {
    return `<article class="paper-card">
      <h2>${escapeHtml(card.heading)}</h2>
      <p class="design">${escapeHtml(card.design)}</p>
      <p class="summary"><span>${escapeHtml(card.summaryLabel)}</span>${escapeHtml(card.summary)}</p>
      <h3>${escapeHtml(card.title)}</h3>
      <p class="meta">${escapeHtml(card.journal)}${card.date ? ` / ${escapeHtml(card.date)}` : ""}</p>
      <p class="source-id">${escapeHtml(card.sourceId)}</p>
      <a class="source" href="${card.link}">抄録・原文を見る →</a>
    </article>`;
  }).join("") : "<p>最新論文情報を取得できませんでした。</p>";
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${escapeHtml(pageDescription)}">
<link rel="canonical" href="${pageUrl}">
<meta property="og:type" content="article"><meta property="og:site_name" content="anes-jc">
<meta property="og:title" content="${pageTitle} | anes-jc">
<meta property="og:description" content="${escapeHtml(pageDescription)}">
<meta property="og:url" content="${pageUrl}">
<meta property="og:image" content="${imageUrl}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${pageTitle} | anes-jc">
<meta name="twitter:description" content="${escapeHtml(pageDescription)}">
<meta name="twitter:image" content="${imageUrl}">
<script type="application/ld+json">${structuredData}</script>
<title>${pageTitle} | anes-jc</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="alternate" type="application/rss+xml" title="anes-jc RSS" href="https://anes-jc.github.io/feed.xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Noto+Sans+JP:wght@400;500;700&family=Noto+Serif+JP:wght@500;600;700&display=swap" rel="stylesheet">
<style>:root{--paper:#f4f6f4;--paper-2:#fbfcfb;--ink:#15302d;--ink-soft:#2c4541;--teal:#0f766e;--teal-deep:#0b4f4a;--muted:#5c6b68;--line:#d9e0dc;--line-strong:#bcc8c3}*{box-sizing:border-box;margin:0;padding:0}html{scroll-behavior:smooth}body{background:var(--paper);color:var(--ink);font-family:"Noto Sans JP",sans-serif;line-height:1.9;-webkit-font-smoothing:antialiased}.wrap{max-width:760px;margin:0 auto;padding:0 24px}a{color:var(--teal-deep)}header.bar{border-bottom:1px solid var(--line);background:rgba(244,246,244,.86);backdrop-filter:blur(8px);position:sticky;top:0;z-index:50}.bar-in{max-width:760px;margin:0 auto;padding:0 24px;display:flex;align-items:center;justify-content:space-between;height:56px}.brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:15px;color:var(--ink);text-decoration:none}.brand .dot{width:8px;height:8px;border-radius:50%;background:var(--teal);box-shadow:0 0 0 4px rgba(15,118,110,.15)}.bar-actions{display:flex;align-items:center;gap:14px}.back{font-size:13px;color:var(--muted);text-decoration:none}.foot-x{font-family:"JetBrains Mono",monospace;font-size:12px;color:var(--teal-deep);text-decoration:none;border:1px solid var(--line-strong);background:var(--paper-2);border-radius:2px;padding:5px 10px;white-space:nowrap}.foot-x:hover{background:var(--teal);color:#fff;border-color:var(--teal)}.ahead{padding:48px 0 30px;border-bottom:1px solid var(--line)}.kicker{font-family:"JetBrains Mono",monospace;letter-spacing:.06em;color:var(--teal-deep);display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;align-items:center}.pill{font-size:12px;font-weight:500;border:1px solid var(--line-strong);border-radius:3px;padding:5px 12px;text-decoration:none;color:var(--teal-deep)}.pill.cls{background:var(--ink);color:#fff;border-color:var(--ink)}h1{font-family:"Noto Serif JP",serif;font-weight:700;font-size:clamp(28px,5vw,40px);line-height:1.35;letter-spacing:.01em}.title-tail{white-space:nowrap}.cite{margin-top:22px;font-size:13px;color:var(--muted);font-family:"JetBrains Mono",monospace;line-height:1.7;border-left:2px solid var(--teal);padding-left:14px}.sec{padding:38px 0;border-bottom:1px solid var(--line)}.sechd{margin-bottom:18px}.sechd h2{font-family:"Noto Serif JP",serif;font-size:22px;font-weight:600;line-height:1.4}.site-list{padding:0;list-style:none}.site-list li{padding:12px 0;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:12px}.site-list span,.meta,.source-id{color:var(--muted);font-family:"JetBrains Mono",monospace;font-size:12px}.site-list span,.meta{white-space:nowrap}.source-id{overflow-wrap:anywhere;margin-top:2px}.paper-card{padding:26px 28px;border:1px solid var(--line);border-radius:4px;margin:18px 0;background:var(--paper-2)}.paper-card h2{font-family:"Noto Serif JP",serif;font-size:22px;line-height:1.4;margin:0 0 8px;color:var(--ink)}.paper-card h3{font-size:15px;line-height:1.7;margin:14px 0 5px;font-weight:500;color:var(--ink-soft)}.design{display:inline-block;font-family:"JetBrains Mono",monospace;font-size:11px;border:1px solid var(--line-strong);border-radius:3px;padding:3px 9px;margin:4px 0 12px;color:var(--teal-deep)}.summary{font-size:14px;line-height:1.8;color:var(--ink-soft);background:#fff;border-left:2px solid var(--teal);padding:12px 14px;margin:4px 0 16px}.summary span{display:block;font-size:11px;font-family:"JetBrains Mono",monospace;font-weight:700;color:var(--teal-deep);margin-bottom:4px}.source{display:inline-block;margin-top:10px;font-family:"JetBrains Mono",monospace;font-size:12px;font-weight:700;text-decoration:none;border:1px solid var(--line-strong);padding:6px 12px;border-radius:2px}.source:hover{background:var(--teal);color:#fff;border-color:var(--teal)}footer{border-top:1px solid var(--line);padding:36px 0 60px;margin-top:24px}.disc{font-size:12px;color:var(--muted);line-height:1.9}.foot-x{display:inline-block;margin-top:14px;padding:7px 12px}@media(max-width:560px){.bar-in{height:54px;padding:0 18px;gap:12px}.brand{min-width:0;gap:8px;font-size:12px;line-height:1.2;white-space:nowrap}.back{font-size:12px;white-space:nowrap}.wrap{padding:0 18px}h1 .title-part{display:block}.title-sep{display:none}.paper-card{padding:20px}.meta{white-space:normal;overflow-wrap:anywhere}.site-list li{display:block}.site-list span{display:block;margin-top:4px}}</style>
<link rel="stylesheet" href="../assets/weekly-c-theme.css">
<script src="../assets/analytics-config.js"></script>
<script src="../assets/analytics.js" defer></script>
</head><body><header class="bar"><div class="bar-in"><a class="brand" href="../index.html"><span class="dot"></span>麻酔・集中治療 / 論文ジャーナルクラブ</a><div class="bar-actions"><a class="back" href="../articles.html">← 記事一覧</a></div></div></header><div class="wrap">
<div class="ahead"><div class="kicker"><a class="pill cls" href="../tags.html?tag=先週のまとめ">SUN · 先週のまとめ</a><a class="pill" href="../tags.html?tag=最新論文">最新論文</a></div>
<h1><span class="title-part">先週のまとめ</span><span class="title-sep">｜</span><span class="title-part title-tail">最新論文3選</span></h1><div class="cite">${issueDate} 公開${modifiedDate !== issueDate ? `<br>${modifiedDate} 内容修正` : ""}<br>対象期間: ${period.start} - ${period.end}</div></div>
<section class="sec"><div class="sechd"><h2>先週の記事一覧</h2></div><ul class="site-list">${siteArticlesHtml}</ul></section>
<section class="sec"><div class="sechd"><h2>最新論文3選</h2></div>${papersHtml}</section>
<section class="sec"><div class="sechd"><h2>このページについて</h2></div><p>このページは、週次の定点観測として毎週日曜に自動生成・自動公開しています。</p></section>
</div><footer><div class="wrap"><p class="disc">${escapeHtml(config.disclaimer)}</p><a class="foot-x" href="../feed.xml">RSSで更新を受け取る</a>
    <a class="foot-x" href="https://x.com/anes_icu_jc" target="_blank" rel="noopener">Xで更新を見る</a></div></footer>
</body></html>
`;
}

function writeRegistry(issueDate, slug) {
  const existing = fs.existsSync(registryPath) ? fs.readFileSync(registryPath, "utf8") : "window.SUNDAY_ARTICLES = [];\n";
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(existing, context);
  const articles = context.window.SUNDAY_ARTICLES || [];
  const url = `articles/${slug}.html`;
  const next = [{
    date: issueDate.replaceAll("-", "."), dow: "SUN", status: "公開中", live: true,
    title: "先週のまとめ｜最新論文3選",
    url,
    desc: "対象期間の公開記事と最新論文3選をまとめる週次記事。選定論文と読みどころを短く確認できます。",
    dowTag: { kind: "weekday", label: "SUN · 先週のまとめ", tag: "先週のまとめ" },
    tags: [{ kind: "clinical", label: "最新論文", tag: "最新論文" }],
  }, ...articles.filter((article) => article.url !== url)];
  fs.writeFileSync(registryPath, `window.SUNDAY_ARTICLES = ${JSON.stringify(next, null, 2)};\n`, "utf8");
}

const issueDate = issueDateJst();
const modifiedDate = currentDateJst();
const period = issuePeriod(issueDate);
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
runGeneratorRegressionChecks();
if (process.env.SUNDAY_SELF_TEST === "true") {
  console.log("Sunday generator safeguards passed.");
  process.exit(0);
}
const siteArticles = loadArticles().filter((article) => {
  const date = article.date.replaceAll(".", "-");
  return article.dow !== "SUN" && date >= period.start && date <= period.end && date <= issueDate;
}).sort((a, b) => b.date.localeCompare(a.date));
let papers = [];
try {
  papers = await fetchLatestPapers(period, config);
} catch (error) {
  throw new Error(`Latest paper lookup failed after retries: ${error.message}`);
}
if (papers.length < config.latestPaperCount) {
  throw new Error(`Expected ${config.latestPaperCount} latest papers, but found ${papers.length}.`);
}
const slug = `latest-papers-${issueDate}`;
const renderedPage = renderPage({ config, issueDate, modifiedDate, period, siteArticles, papers });
if (process.env.SUNDAY_DRY_RUN === "true") {
  console.log(`Validated Sunday article ${slug}: ${siteArticles.length} site article(s), ${papers.length} paper(s).`);
  papers.forEach((paper, index) => {
    const card = paperCardData(paper);
    console.log(`${index + 1}. ${paper.title} [score=${paper.selectionScore}; ${card.sourceId}; mode=${card.curated ? "curated" : "safe"}]`);
  });
} else {
  fs.writeFileSync(path.join(repoRoot, "articles", `${slug}.html`), renderedPage, "utf8");
  writeRegistry(issueDate, slug);
  console.log(`Generated Sunday article ${slug}: ${siteArticles.length} site article(s), ${papers.length} paper(s).`);
}

