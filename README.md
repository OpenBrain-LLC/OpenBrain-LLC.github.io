# OpenBrain-LLC.github.io
A simple website and introduction of our company!

## Files

```
index.html              home
news.html               news list
help.html               setup and FAQ
info.html               about the company
roadmap.html            current priorities
404.html                not found
script.js               header scroll, mobile menu, scroll reveals
static/
  style.css             layout and components
  light.css             light theme colors
  dark.css              dark theme colors
news/
  introducing-agent-0.html
```

## Theming

Colors live in `static/light.css` and `static/dark.css` as CSS variables.
`static/style.css` has everything else and never defines a color directly.

Light is the default. Dark loads with `media="(prefers-color-scheme: dark)"`,
so it only applies when the system is set to dark. Nothing runs in JS, so
there's no flash on load.

To add a color, add it to both theme files. If you only add it to one, the
other theme will render it as nothing.

## Editing

Pages share the same header and footer markup. If you change one, change it
in all of them.

Paths are relative. Pages at the root use `static/style.css`; the article in
`news/` uses `../static/style.css`.

## Adding a news item

Copy a `<li>` from the list in `news.html` and update the date, title, and
link. If the post has its own page, put it in `news/` and link to it from
`news.html` and `index.html`.

## Deploying

Any static host will do. Netlify, Cloudflare Pages, GitHub Pages, or just
`python3 -m http.server` locally.

Most hosts pick up `404.html` automatically. On GitHub Pages, it works as-is.
```