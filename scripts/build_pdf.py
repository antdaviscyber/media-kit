"""Build the one-sheet PDF from data/metrics.json. Run from the repo root:
   pip install playwright && playwright install chromium && python scripts/build_pdf.py
Writes Ant_Davis_Media_Kit.pdf in the repo root."""
import json, pathlib
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parents[1]
d = json.loads((root / "data/metrics.json").read_text())
ig, tt, au = d["instagram"], d["tiktok"], d["audience"]
def k(v):
    if v is None: return "n/a"
    if v >= 1_000_000: return f"{v/1e6:.1f}M".replace(".0M","M")
    if v >= 100_000: return f"{round(v/1000)}K"
    if v >= 1000: return f"{v/1000:.1f}K".replace(".0K","K")
    return str(v)
vals = {
 "period": d.get("period",""),
 "ig_avg": k(ig["avg_views_per_post"]), "ig_views": k(ig["reel_views"]), "ig_posts": ig["posts_in_window"],
 "tt_avg": k(tt["avg_views_per_post"]), "tt_views": k(tt["views"]), "tt_posts": tt["posts_in_window"],
 "ig_eng": f'{ig["engagement_rate"]}%', "ig_reach": k(ig["reach"]),
 "tt_eng": f'{tt["engagement_rate"]}%', "tt_uv": k(tt["unique_viewers"]),
 "ig_shares": k(ig["shares"]), "tt_shares": k(tt["shares"]), "ig_saves": k(ig["saves"]),
 "ig_nf": f'{ig["non_follower_views_pct"]}%', "tt_nf": f'{tt["non_follower_views_pct"]}%', "tt_fy": f'{tt["for_you_pct"]}%',
 "ig_fol": f'{ig["followers"]:,}', "tt_fol": f'{tt["followers"]:,}',
 "ig_male": f'{round(au["male_pct"])}%', "ig_age": f'{round(au["age_35_54_pct"])}%',
 "ig_countries": ", ".join(f'{c["name"]} {c["pct"]}%' for c in au["countries"][:3]),
 "tt_male": f'{tt["viewer_male_pct"]}%',
 "tt_countries": ", ".join(f'{c["name"]} {c["pct"]}%' for c in tt["viewer_countries"][:3]),
}
html = (root / "print/onesheet.html").read_text()
for key, v in vals.items(): html = html.replace("{{"+key+"}}", str(v))
out_html = root / "print/_build.html"; out_html.write_text(html)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    pg.goto(out_html.resolve().as_uri()); pg.wait_for_timeout(600)
    pg.pdf(path=str(root / "Ant_Davis_Media_Kit.pdf"), format="A4", print_background=True, margin={"top":"0","right":"0","bottom":"0","left":"0"})
    pg.set_viewport_size({"width":794,"height":1123}); pg.screenshot(path=str(root / "print/_preview.png"), full_page=True)
    b.close()
out_html.unlink()
print("wrote Ant_Davis_Media_Kit.pdf")
