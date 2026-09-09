"""Build the one-sheet PDF from data/metrics.json. Run from the repo root:
   pip install playwright && playwright install chromium && python scripts/build_pdf.py
Writes Ant_Davis_Media_Kit.pdf in the repo root. Missing fields render as n/a rather than failing."""
import json, pathlib, sys
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parents[1]
d = json.loads((root / "data/metrics.json").read_text())
ig, tt, au = d.get("instagram", {}), d.get("tiktok", {}), d.get("audience", {})
def k(v):
    if v is None: return "n/a"
    if v >= 1_000_000: return f"{v/1e6:.1f}M".replace(".0M","M")
    if v >= 100_000: return f"{round(v/1000)}K"
    if v >= 1000: return f"{v/1000:.1f}K".replace(".0K","K")
    return str(v)
def pc(v): return "n/a" if v is None else f"{v}%"
def num(v): return "n/a" if v is None else f"{v:,}"
def countries(lst): return ", ".join(f'{c["name"]} {c["pct"]}%' for c in (lst or [])[:3]) or "n/a"
vals = {
 "period": d.get("period",""),
 "ig_avg": k(ig.get("avg_views_per_post")), "ig_views": k(ig.get("reel_views")), "ig_posts": ig.get("posts_in_window","n/a"),
 "tt_avg": k(tt.get("avg_views_per_post")), "tt_views": k(tt.get("views")), "tt_posts": tt.get("posts_in_window","n/a"),
 "ig_eng": pc(ig.get("engagement_rate")), "ig_reach": k(ig.get("reach")),
 "tt_eng": pc(tt.get("engagement_rate")), "tt_uv": k(tt.get("unique_viewers")),
 "ig_shares": k(ig.get("shares")), "tt_shares": k(tt.get("shares")), "ig_saves": k(ig.get("saves")),
 "ig_nf": pc(ig.get("non_follower_views_pct")), "tt_nf": pc(tt.get("non_follower_views_pct")), "tt_fy": pc(tt.get("for_you_pct")),
 "ig_fol": num(ig.get("followers")), "tt_fol": num(tt.get("followers")),
 "ig_male": pc(round(au["male_pct"]) if au.get("male_pct") is not None else None),
 "ig_age": pc(round(au["age_35_54_pct"]) if au.get("age_35_54_pct") is not None else None),
 "ig_countries": countries(au.get("countries")),
 "tt_male": pc(tt.get("viewer_male_pct")),
 "tt_countries": countries(tt.get("viewer_countries")),
}
fonts = root / "print/fonts"
if not fonts.exists() or not any(fonts.iterdir()):
    print("warning: print/fonts is missing, falling back to system fonts", file=sys.stderr)
html = (root / "print/onesheet.html").read_text()
for key, v in vals.items(): html = html.replace("{{"+key+"}}", str(v))
out_html = root / "print/_build.html"; out_html.write_text(html)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page()
        pg.goto(out_html.resolve().as_uri()); pg.wait_for_timeout(800)
        pg.pdf(path=str(root / "Ant_Davis_Media_Kit.pdf"), format="A4", print_background=True,
               margin={"top":"0","right":"0","bottom":"0","left":"0"})
        b.close()
finally:
    out_html.unlink(missing_ok=True)
print("wrote Ant_Davis_Media_Kit.pdf")
