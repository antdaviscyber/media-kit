# Ant Davis media kit

Single page, no build step. Push to GitHub, turn on Pages, done.

## Files

- `index.html` – the whole page. Copy, layout, print styles, and the script that reads the numbers.
- `data/metrics.json` – every number on the page. Edit this by hand or let the action refresh it.
- `images/` – drop your photos in here using the filenames below.
- `scripts/fetch_metricool.py` – pulls Instagram and TikTok numbers from Metricool into `metrics.json`.
- `.github/workflows/metrics.yml` – runs that script every Monday and commits the result.
- `Ant_Davis_Media_Kit.pdf` – export this from the page (Print, Save as PDF) and drop it in the root so the download button works. 

## Images to drop in

| File | What |
|---|---|
| `images/cover.jpg` | Smiling portrait, brick wall. Square crop works best. |
| `images/positioning.jpg` | Same or similar portrait. |
| `images/about-1.jpg` to `about-4.jpg` | Javvad selfie, on stage, panel, Exchange stage. |
| `images/reach.jpg` | Yellow background thinking shot. |
| `images/podcast.jpg` | The Awareness Angle artwork, square. |
| `images/sans-card.png` | SANS media partner card. |
| `images/sans-1.jpg` to `sans-3.jpg` | Interview stills from last year. |
| `images/comment-1.png` to `comment-6.png` | Comment screenshots, including the Janice thread and the Cloudflare like. |
| `images/pricing.jpg` | Mid-video shot with the mic. |
| `images/cred-1.jpg` to `cred-8.jpg` | Awards, stage, webinar thumbnails, podcast interview. |
| `images/contact.jpg` | Smiling portrait. |

Any image that's missing shows a dashed placeholder with its filename, so you can see what's still to add.

## Updating numbers

Edit `data/metrics.json` and push. The page reads it on load. Numbers, top video lists, the ticker headlines, the retention curves and the country bars all come from that file.

## Metricool

The API needs an Advanced or Custom plan. Get the token from Account settings > API, then add three repo secrets: `METRICOOL_USER_TOKEN`, `METRICOOL_USER_ID`, `METRICOOL_BLOG_ID`. Then open `scripts/fetch_metricool.py` and paste the two analytics endpoint paths (Metricool's help centre explains how to copy them from the browser Network panel). Run the action manually once from the Actions tab to test.

Without API access, skip all of that and edit the JSON by hand. Everything else works the same.

## Fonts

The page uses Anton as a stand-in for Barber Chop. If you have the Barber Chop web font file, put it in `fonts/` and uncomment the `@font-face` block at the top of `index.html`.

## Printing

Print from the page (or use the Print button). Sections break onto separate landscape A4 pages, background goes white, animations are stripped. Save as PDF and drop the file in the root as `Ant_Davis_Media_Kit.pdf`.

## Hiding it

`index.html` already has `noindex, nofollow`. If you want it further out of the way, put the repo at a path like `antdavis.com/kit` or `antdavis.com/partners` and only share the link.
