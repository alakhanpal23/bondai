# Kara Labs website

This repository contains the Kara Labs website for engineered single-crystal diamond materials. It presents the company's substrates, engineered layers, membranes, and thermal materials, with contact and source pages.

The site is primarily static HTML, CSS, and JavaScript. `index.html` is the main page; `contact.html`, `questions.html`, and `sources.html` provide supporting content. Static assets are in `assets/`.

## Preview locally

From the repository root, serve the files with any static web server, for example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`. This previews the static pages; any serverless or hosted integrations need their own configuration.

## Deployment notes

`vercel.json` contains the deployment configuration. Check all public claims, links, and contact details against the live Kara Labs site before publishing a change.
