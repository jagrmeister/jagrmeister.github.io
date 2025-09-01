# ABI Consulting — GitHub Pages site

This folder contains a simple one-page static site (`index.html`).

## How to publish with GitHub Pages (web UI, no Git required)

1. Create a new repository in your GitHub account (e.g., `abi-consulting-site`), set **Public**.
2. Open the repo and click **Add file → Upload files**. Drag the **contents of this folder** (not the folder itself) so that `index.html` sits in the repo root.
3. Commit the upload.
4. Go to **Settings → Pages**. Under **Source**, choose **Deploy from a branch**. Select branch **main** and folder **/(root)**. Click **Save**.
5. Wait ~1–2 minutes. Your site will be live at `https://<your-username>.github.io/abi-consulting-site/`.
6. Optional: if you create a repo named `<your-username>.github.io`, the site will be at the root: `https://<your-username>.github.io/`.

## Custom domain (optional)
In **Settings → Pages**, set a custom domain (e.g., `www.abiconsulting.com`) and create a DNS **CNAME** pointing to `<your-username>.github.io`. Enforce HTTPS.

