"""
Pulls Instagram and TikTok numbers from Metricool and updates data/metrics.json.

Needs three secrets (set as GitHub Actions secrets, or env vars locally):
  METRICOOL_USER_TOKEN   from Metricool > Account settings > API (Advanced/Custom plans only)
  METRICOOL_USER_ID      your Metricool user id
  METRICOOL_BLOG_ID      the brand id for @antdaviscyber

Metricool doesn't publish a stable public reference for the analytics routes.
The reliable way to get them is the one in their help centre: open the Analytics
tab for Instagram, open the browser dev tools Network panel, change the date
range, and copy the request URLs that appear. Paste them into the ENDPOINTS
dict below. Auth is the same for every call: X-Mc-Auth header, plus userId and
blogId as query params.

Anything this script can't fetch is left as it was in metrics.json, so a partial
config still works.
"""
import json, os, sys, datetime as dt
import urllib.request, urllib.parse

TOKEN = os.environ.get("METRICOOL_USER_TOKEN")
USER  = os.environ.get("METRICOOL_USER_ID")
BLOG  = os.environ.get("METRICOOL_BLOG_ID")
BASE  = "https://app.metricool.com/api"

# Paste the paths you copied from the Network panel. Leave as None to skip.
ENDPOINTS = {
    "instagram_reels": None,   # e.g. "/stats/instagram/reels"
    "tiktok_videos":   None,   # e.g. "/stats/tiktok/videos"
}

DAYS = 60
PATH = os.path.join(os.path.dirname(__file__), "..", "data", "metrics.json")


def call(path, **params):
    if not (TOKEN and USER and BLOG and path):
        return None
    q = {"userId": USER, "blogId": BLOG, **params}
    url = f"{BASE}{path}?{urllib.parse.urlencode(q)}"
    req = urllib.request.Request(url, headers={"X-Mc-Auth": TOKEN, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def num(x, *keys, default=0):
    for k in keys:
        if isinstance(x, dict) and x.get(k) is not None:
            return x[k]
    return default


def main():
    with open(PATH) as f:
        data = json.load(f)

    end = dt.date.today()
    start = end - dt.timedelta(days=DAYS)
    rng = {"start": start.isoformat(), "end": end.isoformat()}

    reels = call(ENDPOINTS["instagram_reels"], **rng)
    if isinstance(reels, list) and reels:
        views  = sum(num(r, "views", "plays") for r in reels)
        shares = sum(num(r, "shares") for r in reels)
        saves  = sum(num(r, "saved", "saves") for r in reels)
        reach  = sum(num(r, "reach") for r in reels)
        inter  = sum(num(r, "interactions") for r in reels)
        data["instagram"].update({
            "reel_views": views,
            "shares": shares,
            "saves": saves,
            "engagement_rate": round(inter / reach * 100, 1) if reach else data["instagram"]["engagement_rate"],
        })
        top = sorted(reels, key=lambda r: num(r, "views", "plays"), reverse=True)[:5]
        data["instagram"]["top_videos"] = [
            {"title": (r.get("caption") or r.get("text") or "")[:60], "views": num(r, "views", "plays")} for r in top
        ]
        data["ticker"] = [(r.get("caption") or "")[:90] for r in reels[:8] if r.get("caption")] or data["ticker"]

    vids = call(ENDPOINTS["tiktok_videos"], **rng)
    if isinstance(vids, list) and vids:
        data["tiktok"]["views"]  = sum(num(v, "views", "plays") for v in vids)
        data["tiktok"]["shares"] = sum(num(v, "shares") for v in vids)
        top = sorted(vids, key=lambda v: num(v, "views", "plays"), reverse=True)[:5]
        data["tiktok"]["top_videos"] = [
            {"title": (v.get("caption") or v.get("text") or "")[:60], "views": num(v, "views", "plays")} for v in top
        ]

    data["updated"] = end.isoformat()
    data["period"] = f"{start.strftime('%B')} to {end.strftime('%B %Y')}"

    with open(PATH, "w") as f:
        json.dump(data, f, indent=2)
    print("metrics.json updated", data["updated"])


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("fetch failed, metrics.json left unchanged:", e, file=sys.stderr)
        sys.exit(0)
