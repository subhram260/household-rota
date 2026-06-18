# Household Rota

This is a Vite + React household rota app with a JSON-backed API route for roster data.

## Vercel deployment

Deploy the repo to Vercel as a standard Vite app. The `api/rota.js` function reads and updates `data/rota.json` through the GitHub Contents API.

Set these environment variables in Vercel if you want roster edits to persist:

- `GITHUB_TOKEN`
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_PATH` optional, defaults to `data/rota.json`

If those variables are missing, the app still runs and uses local fallback data, but changes will not be written back to GitHub.

## Local development

```bash
npm install
npm run dev
```

## Notes

- Garbage rota uses one assignee per day.
- Sundays are excluded from the rota.
