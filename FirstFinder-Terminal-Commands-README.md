# FirstFinder — Important Terminal Commands

A quick-reference guide for working with the local **FirstFinder** Next.js app.

## Project Location

```bash
cd ~/FirstFinder
```

Run this first whenever you open a new Terminal window.

---

## Start the Local App

```bash
cd ~/FirstFinder
npm run dev
```

Then open or refresh:

```text
http://localhost:3000
```

---

## Stop the Local App

Click inside the Terminal window and press:

```text
Control + C
```

Use the **Control** key, not the Command key.

---

## Restart the Local App

First stop the current server:

```text
Control + C
```

Then run:

```bash
cd ~/FirstFinder
npm run dev
```

Refresh:

```text
http://localhost:3000
```

---

## Check Which Files Changed

```bash
cd ~/FirstFinder
git status
```

---

## Review Your Code Changes

```bash
cd ~/FirstFinder
git diff
```

---

## Check Your Current Git Branch

```bash
cd ~/FirstFinder
git branch --show-current
```

---

## Save and Push a Finished Change

Only use this after reviewing and testing the change locally.

```bash
cd ~/FirstFinder
git status
git diff
git add .
git commit -m "Describe what changed"
git push
```

Replace `Describe what changed` with a short description, for example:

```bash
git commit -m "Improve inventory search"
```

After pushing, check Vercel to confirm that the deployment succeeds.

---

## Pull the Latest Version from GitHub

```bash
cd ~/FirstFinder
git pull
```

Run `git status` first. Pulling while you have unfinished local changes can create conflicts.

---

## Undo Uncommitted Changes to One File

Example for the main app component:

```bash
cd ~/FirstFinder
git restore app/InventoryApp.jsx
```

**Warning:** This permanently removes uncommitted changes in that file.

Other important FirstFinder files include:

```text
app/page.js
src/lib/supabaseClient.js
```

---

## Create a Backup Before Editing a File

Example:

```bash
cd ~/FirstFinder
cp app/InventoryApp.jsx app/InventoryApp.jsx.before-change.bak
```

Use a more descriptive backup name when possible:

```bash
cp app/InventoryApp.jsx app/InventoryApp.jsx.before-search-update.bak
```

---

## Restore a Backup

```bash
cd ~/FirstFinder
cp app/InventoryApp.jsx.before-search-update.bak app/InventoryApp.jsx
```

Then restart the development server:

```bash
npm run dev
```

---

## Useful Everyday Workflow

```bash
cd ~/FirstFinder
git status
npm run dev
```

After testing a completed change:

```bash
git status
git diff
git add .
git commit -m "Describe what changed"
git push
```

---

## Important Notes

- FirstFinder is a **Next.js** app, not Vite.
- The main app component is `app/InventoryApp.jsx`.
- The homepage entry file is `app/page.js`.
- The Supabase client is `src/lib/supabaseClient.js`.
- Browser-safe Supabase variables use the `NEXT_PUBLIC_` prefix.
- Never place a Supabase service-role or secret key in frontend code.
