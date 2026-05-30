# Hero image

Save the hero photo here as **`hero.jpg`** (`.jpeg`, `.png` or `.webp` also work):

```
assets/images/hero.jpg
```

The template auto-resizes and converts it to optimized WebP at build time, so
you can drop in a large, high-quality source — no need to pre-process it.

If no file is present, the hero shows a music-note placeholder.

> Note: images referenced from `data/*.yaml` (song covers, timeline, fan wall)
> still go in `static/images/...` and are referenced by their `/images/...` URL.
> Only the **hero** uses this `assets/` pipeline folder.
