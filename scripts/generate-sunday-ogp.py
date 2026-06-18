from __future__ import annotations

import html
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


REPO_ROOT = Path(__file__).resolve().parents[1]
ARTICLE_DIR = REPO_ROOT / "articles"
OG_DIR = REPO_ROOT / "assets" / "og"

W, H = 1200, 630
PAPER = "#F4F6F4"
PAPER_2 = "#FBFCFB"
INK = "#15302D"
TEAL = "#0F766E"
TEAL_DEEP = "#0B4F4A"
MUTED = "#5C6B68"
LINE = "#D9E0DC"
LINE_STRONG = "#BCC8C3"


def strip_tags(value: str) -> str:
  return html.unescape(re.sub(r"<[^>]+>", "", value)).strip()


def first_match(pattern: str, text: str, fallback: str = "") -> str:
  match = re.search(pattern, text, re.S)
  return strip_tags(match.group(1)) if match else fallback


def font_path(candidates: list[str]) -> str:
  for candidate in candidates:
    if Path(candidate).exists():
      return candidate
  raise FileNotFoundError(f"No usable font found from: {', '.join(candidates)}")


def load_fonts() -> dict[str, ImageFont.FreeTypeFont]:
  sans_bold = font_path([
    r"C:\Windows\Fonts\meiryob.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
  ])
  sans_regular = font_path([
    r"C:\Windows\Fonts\meiryo.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    sans_bold,
  ])
  serif_bold = font_path([
    r"C:\Windows\Fonts\yumindb.ttf",
    "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc",
    "/usr/share/fonts/truetype/noto/NotoSerifCJK-Bold.ttc",
    sans_bold,
  ])
  return {
    "site": ImageFont.truetype(sans_bold, 25),
    "pill": ImageFont.truetype(sans_regular, 19),
    "title": ImageFont.truetype(serif_bold, 54),
    "label": ImageFont.truetype(sans_regular, 20),
    "num": ImageFont.truetype(sans_regular, 22),
    "theme": ImageFont.truetype(serif_bold, 32),
    "theme_small": ImageFont.truetype(serif_bold, 28),
    "date": ImageFont.truetype(sans_regular, 22),
  }


def wrap_by_px(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
  lines: list[str] = []
  current = ""
  for char in text:
    trial = current + char
    if draw.textlength(trial, font=font) <= max_width:
      current = trial
    else:
      if current:
        lines.append(current)
      current = char
  if current:
    lines.append(current)
  return lines


def draw_theme(
  draw: ImageDraw.ImageDraw,
  x: int,
  y: int,
  width: int,
  theme: str,
  fonts: dict[str, ImageFont.FreeTypeFont],
) -> None:
  max_width = width - 132
  font = fonts["theme"]
  lines = wrap_by_px(draw, theme, font, max_width)
  if len(lines) > 2:
    font = fonts["theme_small"]
    lines = wrap_by_px(draw, theme, font, max_width)
  lines = lines[:2]
  line_height = font.size + 9
  text_y = y + (12 if len(lines) == 2 else 21)
  for line in lines:
    draw.text((x + 94, text_y), line, font=font, fill=INK)
    text_y += line_height


def render_article_og(article_path: Path) -> Path:
  text = article_path.read_text(encoding="utf-8-sig")
  issue_date = article_path.stem.replace("latest-papers-", "")
  display_date = issue_date.replace("-", ".")
  brand = first_match(r'<a class="brand"[^>]*>(.*?)</a>', text, "anes-jc")
  title = first_match(r"<h1>(.*?)</h1>", text, "先週のまとめ｜最新論文3選")
  themes = [
    strip_tags(match)
    for match in re.findall(r'<article class="paper-card">\s*<h2>(.*?)</h2>', text, re.S)[:3]
  ]
  if len(themes) != 3:
    raise ValueError(f"{article_path} must contain exactly 3 paper-card headings.")

  fonts = load_fonts()
  image = Image.new("RGB", (W, H), PAPER)
  draw = ImageDraw.Draw(image)

  draw.rectangle([0, H - 96, W, H], fill=PAPER_2)
  draw.line([72, H - 98, W - 72, H - 98], fill=TEAL, width=4)

  draw.ellipse([72, 72, 100, 100], fill=TEAL)
  draw.ellipse([64, 64, 108, 108], outline="#D4E6E2", width=9)
  draw.text((122, 68), brand, font=fonts["site"], fill=MUTED)

  pill_text = "SUNDAY WEEKLY REVIEW"
  padding_x, padding_y = 18, 8
  box = draw.textbbox((0, 0), pill_text, font=fonts["pill"])
  pill_w = box[2] - box[0] + padding_x * 2
  pill_h = box[3] - box[1] + padding_y * 2
  pill_x, pill_y = W - 72 - pill_w, 67
  draw.rounded_rectangle(
    [pill_x, pill_y, pill_x + pill_w, pill_y + pill_h],
    radius=4,
    fill=PAPER_2,
    outline=LINE_STRONG,
    width=1,
  )
  draw.text((pill_x + padding_x, pill_y + padding_y - 1), pill_text, font=fonts["pill"], fill=TEAL_DEEP)

  draw.text((72, 128), title, font=fonts["title"], fill=INK)
  draw.text((76, 214), "FEATURED THEMES", font=fonts["label"], fill=TEAL_DEEP)

  card_x, card_width = 72, W - 144
  card_y, card_h, gap = 258, 82, 18
  for index, theme in enumerate(themes, 1):
    y = card_y + (index - 1) * (card_h + gap)
    draw.rounded_rectangle([card_x, y, card_x + card_width, y + card_h], radius=8, fill=PAPER_2, outline=LINE, width=1)
    draw.rectangle([card_x, y, card_x + 8, y + card_h], fill=TEAL)
    draw.text((card_x + 28, y + 25), f"{index:02d}", font=fonts["num"], fill=TEAL_DEEP)
    draw_theme(draw, card_x, y, card_width, theme, fonts)

  draw.text((72, H - 66), "anes-jc", font=fonts["date"], fill=TEAL_DEEP)
  draw.text((W - 245, H - 66), display_date, font=fonts["date"], fill=MUTED)

  OG_DIR.mkdir(parents=True, exist_ok=True)
  output_path = OG_DIR / f"{article_path.stem}.png"
  image.save(output_path, "PNG")
  return output_path


def main() -> None:
  paths = [Path(arg) for arg in sys.argv[1:]]
  if not paths:
    paths = sorted(ARTICLE_DIR.glob("latest-papers-*.html"))
  if not paths:
    raise SystemExit("No Sunday article HTML files found.")
  for path in paths:
    output_path = render_article_og(path.resolve())
    print(f"Generated {output_path.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
  main()
