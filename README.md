# M&M Fan Room 💜

An independent, **fan-made** Hugo site for everyone who loves **Marcus & Martinus** —
music, memories, concerts, timelines and fan moments.

> ⚠️ **Unofficial.** This site is not affiliated with Marcus & Martinus, their
> management, label or any official channel. For official news, tickets and merch,
> always use the official channels.

## Tech

- [Hugo](https://gohugo.io/) (extended) — no external theme; the theme lives in `layouts/` + `assets/`.
- Plain CSS design system in `assets/css/main.css` (dark theme, neon accents).
- Stage Rush uses an HTML5 Canvas renderer and a testable vanilla JavaScript game core.
- The Fan Quiz uses a testable vanilla JavaScript engine and data from `data/quiz.yaml`.
- Content is **data-driven**: most page content lives in `data/*.yaml`, so you can
  edit songs, timeline entries, fan posts etc. without touching templates.

## Run locally

```bash
hugo server
# open http://localhost:1313/
```

Build the static site:

```bash
hugo --gc --minify
# output in ./public
```

Run the JavaScript and content-data tests:

```bash
node --test tests/*.test.js
```

## Editing content

| What | File |
|------|------|
| Home "Why fans love them" cards | `data/whylove.yaml` |
| Home starter songs | `data/starter.yaml` |
| Music page songs | `data/songs.yaml` + categories in `data/musiccats.yaml` |
| "Listen on" platforms | `data/platforms.yaml` |
| Timeline entries | `data/timeline.yaml` |
| Concert guide cards | `data/concertguide.yaml` |
| Fan wall posts | `data/fanwall.yaml` + filters in `data/fanwallcats.yaml` |
| Footer official links | `data/official.yaml` |
| Fan Quiz questions | `data/quiz.yaml` |
| Site title, tagline, disclaimer, official URL | `hugo.toml` → `[params]` |
| Navigation | `hugo.toml` → `[[menu.main]]` |

### Images

Drop images in `static/images/` (see `static/images/.gitkeep` for the expected
paths) and reference them from the matching data file's `image:` field.

## Pages

`Home · Music · Timeline · Concerts · Fan Wall · Game · Quiz · Gallery`
(Gallery is a placeholder — content coming soon.)

## Deploy (GitHub Pages)

`.github/workflows/hugo.yml` builds and deploys on every push to `main`.
In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

The site uses the custom domain `mmfanroom.com`, configured by `static/CNAME`
and `baseURL` in `hugo.toml`.
