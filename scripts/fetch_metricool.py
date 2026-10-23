"""
Refreshes data/metrics.json from the Metricool API.

Secret needed (GitHub Actions secret, or an environment variable locally):
  METRICOOL_TOKEN   Metricool > Account settings > API

The user and brand IDs are not secret, so they default to the values below.

Everything is calculated from Metricool (window = the 60 days ending yesterday, UK time):
  Instagram: followers, reel views, reels published, average views and reach per
             reel, engagement rate, likes, comments, shares, saves, top five
             reels, audience gender, age and countries.
  TikTok:    followers, views, posts published, average views per post,
             engagement rate, likes, comments, shares, net new followers,
             top five videos.
  Growth:    the Instagram growth chart and the "+36K" headline.

Totals count posts PUBLISHED inside the window, because that is how Metricool
reports them. Instagram's and TikTok's own dashboards count views that happened
inside the window on any post, so they read higher when an older post keeps
getting views.

Engagement is worked out per post: Instagram divides interactions by each reel's
reach, TikTok divides by views. Both read lower than a rate over unique viewers.

Figures Metricool cannot supply (TikTok unique and new viewers, For You share,
TikTok audience, non-follower share, reposts) are removed from metrics.json
rather than left to go stale. The podcast block is a fixed record of a show
that has finished, so it is left as written.

If any call fails the script exits with an error and metrics.json is untouched,
so the page never shows half-updated numbers.
"""
import json
import os
import re
import sys
import datetime as dt
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

TOKEN = os.environ.get("METRICOOL_TOKEN")
USER_ID = os.environ.get("METRICOOL_USER_ID", "5018589")
BLOG_ID = os.environ.get("METRICOOL_BLOG_ID", "6516035")
BASE = "https://app.metricool.com/api/v2/analytics"
TZ_NAME = "Europe/London"
DAYS = 60

PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "metrics.json")

COUNTRIES = {
    "GB": "United Kingdom", "US": "United States", "AU": "Australia", "CA": "Canada",
    "IE": "Ireland", "DE": "Germany", "FR": "France", "IN": "India", "NZ": "New Zealand",
    "NL": "Netherlands", "ES": "Spain", "IT": "Italy", "SE": "Sweden", "NO": "Norway",
    "DK": "Denmark", "FI": "Finland", "BE": "Belgium", "CH": "Switzerland", "PT": "Portugal",
    "ZA": "South Africa", "BR": "Brazil", "SG": "Singapore", "AE": "United Arab Emirates",
    "PL": "Poland", "IL": "Israel", "KE": "Kenya", "NG": "Nigeria", "PK": "Pakistan",
    "PH": "Philippines", "MY": "Malaysia", "JP": "Japan", "MX": "Mexico", "AT": "Austria",
}


def api(path, **params):
    """GET one analytics endpoint and return the decoded JSON."""
    if not TOKEN:
        raise RuntimeError("METRICOOL_TOKEN is not set")
    query = {"userId": USER_ID, "blogId": BLOG_ID, **params}
    url = f"{BASE}/{path}?{urllib.parse.urlencode(query)}"
    req = urllib.request.Request(url, headers={
        "X-Mc-Auth": TOKEN,
        "Accept": "application/json",
        "User-Agent": "media-kit-metrics/1.0",
    })
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def rows(payload):
    """Metricool wraps lists as {"data": [...]}."""
    return payload.get("data", []) if isinstance(payload, dict) else payload


def total(items, key):
    return sum(float(i.get(key) or 0) for i in items)


def latest_and_earliest(timeline):
    """Return (earliest, latest) values from a timelines response, by timestamp."""
    pts = []
    for series in rows(timeline):
        for p in series.get("values", []):
            when = dt.datetime.strptime(p["dateTime"], "%Y-%m-%dT%H:%M:%S%z")
            pts.append((when, float(p["value"])))
    if not pts:
        raise RuntimeError("timeline came back empty")
    pts.sort()
    return pts[0][1], pts[-1][1]


def clean_caption(text):
    text = re.sub(r"[#@]\w+", "", text or "")
    return re.sub(r"\s+", " ", text).strip()


def shorten(text, limit):
    text = text.strip().rstrip(".")
    if len(text) <= limit:
        return text
    return text[:limit].rsplit(" ", 1)[0].rstrip(",;: ") + "..."


def title_and_desc(raw):
    sentences = re.split(r"(?<=[.!?])\s+", clean_caption(raw))
    sentences = [s for s in sentences if s]
    title = shorten(sentences[0], 70) if sentences else "Untitled"
    desc = shorten(sentences[1], 120) if len(sentences) > 1 else ""
    return title, desc


def top_videos(items, date_of, text_of, views_of, n=5):
    best = sorted(items, key=views_of, reverse=True)[:n]
    out = []
    for item in best:
        title, desc = title_and_desc(text_of(item))
        out.append({
            "title": title,
            "desc": desc,
            "views": int(views_of(item)),
            "date": date_of(item),
        })
    return out


def kfmt(v):
    if v < 100000:
        return f"{v / 1000:.1f}".rstrip("0").rstrip(".") + "K"
    return f"{round(v / 1000)}K"


def main(path=PATH):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    now = dt.datetime.now(ZoneInfo(TZ_NAME))
    today = now.date()
    end = today - dt.timedelta(days=1)
    start = end - dt.timedelta(days=DAYS - 1)
    frm, to = f"{start.isoformat()}T00:00:00", f"{end.isoformat()}T23:59:59"
    label = f"{start.day} {start:%B} to {end.day} {end:%B %Y}"
    window = {"start": start.isoformat(), "end": end.isoformat(), "days": DAYS, "label": label}

    # ---- Instagram ----
    reels = rows(api("reels/instagram", **{"from": frm, "to": to}))
    if not reels:
        raise RuntimeError("no Instagram reels returned for the window")
    ig_views = int(total(reels, "views"))
    if ig_views <= 0:
        raise RuntimeError("Instagram views summed to zero, refusing to overwrite")

    ig_now = {"from": f"{(today - dt.timedelta(days=7)).isoformat()}T00:00:00",
              "to": f"{today.isoformat()}T23:59:59"}
    _, ig_followers = latest_and_earliest(api(
        "timelines", metric="followers", network="instagram", subject="account",
        timezone=TZ_NAME, **ig_now))

    def dist(metric):
        got = rows(api("distribution", metric=metric, network="instagram",
                       subject="account", **{"from": frm, "to": to}))
        return {row["key"]: float(row["value"]) for row in got}

    gender, age, country = dist("gender"), dist("age"), dist("country")

    ig_reach = total(reels, "reach")
    ig_interactions = (total(reels, "likes") + total(reels, "comments")
                       + total(reels, "saved") + total(reels, "shares"))

    ig = data["instagram"]
    ig.update({
        "followers": int(ig_followers),
        "reel_views": ig_views,
        "posts_in_window": len(reels),
        "avg_views_per_post": round(ig_views / len(reels)),
        "avg_reach_per_post": round(ig_reach / len(reels)),
        "engagement_rate": round(ig_interactions / ig_reach * 100, 1) if ig_reach else None,
        "engagement_formula": "likes + comments + saves + shares, divided by the reach of each reel",
        "likes": int(total(reels, "likes")),
        "comments": int(total(reels, "comments")),
        "shares": int(total(reels, "shares")),
        "saves": int(total(reels, "saved")),
        "window": window,
        "top_videos": top_videos(
            reels,
            date_of=lambda r: r["publishedAt"]["dateTime"][:10],
            text_of=lambda r: r.get("content", ""),
            views_of=lambda r: float(r.get("views") or 0)),
    })

    aud = data["audience"]
    men, women = gender.get("M", 0), gender.get("F", 0)
    if men + women > 0:
        aud["male_pct"] = round(men / (men + women) * 100, 1)
        aud["female_pct"] = round(100 - aud["male_pct"], 1)
    if age:
        aud["age"] = {k: round(age[k], 1) for k in ("25-34", "35-44", "45-54", "55-64", "65+") if k in age}
        aud["age_35_54_pct"] = round(age.get("35-44", 0) + age.get("45-54", 0), 1)
    if country:
        top3 = sorted(country.items(), key=lambda kv: kv[1], reverse=True)[:3]
        aud["countries"] = [{"name": COUNTRIES.get(k, k), "pct": round(v, 1)} for k, v in top3]
    aud["source"] = f"Instagram follower insights via Metricool, {label}"

    # ---- TikTok ----
    vids = rows(api("posts/tiktok", **{"from": frm, "to": to}))
    if not vids:
        raise RuntimeError("no TikTok posts returned for the window")
    tt_views = int(total(vids, "viewCount"))
    if tt_views <= 0:
        raise RuntimeError("TikTok views summed to zero, refusing to overwrite")

    tt_first, tt_last = latest_and_earliest(api(
        "timelines", metric="followers_count", network="tiktok", subject="account",
        timezone=TZ_NAME, **{"from": frm, "to": f"{today.isoformat()}T23:59:59"}))

    tt_interactions = (total(vids, "likeCount") + total(vids, "commentCount")
                       + total(vids, "shareCount"))

    tt = data["tiktok"]
    tt.update({
        "followers": int(tt_last),
        "views": tt_views,
        "posts_in_window": len(vids),
        "avg_views_per_post": round(tt_views / len(vids)),
        "engagement_rate": round(tt_interactions / tt_views * 100, 1),
        "engagement_formula": "likes + comments + shares, divided by views (TikTok does not report saves)",
        "likes": int(total(vids, "likeCount")),
        "comments": int(total(vids, "commentCount")),
        "shares": int(total(vids, "shareCount")),
        "net_new_followers": int(tt_last - tt_first),
        "window": window,
        "top_videos": top_videos(
            vids,
            date_of=lambda v: v["createTime"][:10],
            text_of=lambda v: v.get("title") or v.get("videoDescription", ""),
            views_of=lambda v: float(v.get("viewCount") or 0)),
    })

    # ---- Growth chart (first point is fixed history from before Metricool) ----
    g = data["growth"]
    pts = g["points"]
    this_label = today.strftime("%b")
    if pts[-1]["label"] == this_label:
        pts[-1]["followers"] = int(ig_followers)
        pts[-1]["date"] = today.isoformat()
    else:
        pts.append({"label": this_label, "date": today.isoformat(), "followers": int(ig_followers)})
    first = pts[0]["followers"]
    start_month = dt.datetime.strptime(g.get("start_month", "2026-07"), "%Y-%m").date()
    months = (today.year - start_month.year) * 12 + today.month - start_month.month
    spoken = {1: "a month", 2: "two months", 3: "three months", 4: "four months",
              5: "five months", 6: "six months", 7: "seven months", 8: "eight months",
              9: "nine months", 10: "ten months", 11: "eleven months",
              12: "a year"}.get(months, f"{months} months")
    g.update({
        "start_month": start_month.strftime("%Y-%m"),
        "gained": int(ig_followers - first),
        "window": f"{start_month:%B} to {today:%B %Y}",
        "summary": (f"followers on Instagram in {spoken}. "
                    f"From {kfmt(first)} in {start_month:%B} to {kfmt(ig_followers)} in {today:%B %Y}."),
    })

    # ---- Dates ----
    data["updated"] = today.isoformat()
    data["updated_pretty"] = f"{today:%B %Y}"
    data["updated_label"] = f"{now.day} {now:%B %Y}, {now:%H:%M} UK time"
    data["updated_iso"] = now.isoformat(timespec="minutes")
    data["period"] = label

    # Drop every figure Metricool cannot supply, so nothing stale or hand-typed is left behind.
    for key in ("reach", "reposts", "non_follower_views_pct", "non_follower_views_note"):
        ig.pop(key, None)
    for key in ("unique_viewers", "new_viewers", "for_you_pct", "saves", "non_follower_views_pct",
                "male_pct", "viewer_male_pct", "follower_male_pct", "viewer_age", "viewer_countries"):
        tt.pop(key, None)
    aud.pop("cities", None)
    for key in ("attention", "ticker", "manual_as_of"):
        data.pop(key, None)

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"metrics.json updated for {label}: IG {ig_followers:,.0f} followers, "
          f"{len(reels)} reels, {ig_views:,} views; TikTok {tt_last:,.0f} followers, "
          f"{len(vids)} posts, {tt_views:,} views")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # fail loudly so the Action turns red and nothing is committed
        print(f"Metricool refresh failed, metrics.json not changed: {exc}", file=sys.stderr)
        sys.exit(1)
