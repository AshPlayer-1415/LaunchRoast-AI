# LaunchRoast AI

LaunchRoast AI is a free AI-powered website launch readiness checker built with Next.js. Paste a live public URL or draft copy to get a structured roast, launch-readiness report, trust-signal review, and a passive website status check for live URLs.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Local usage tracking with `localStorage`
- OpenRouter-ready API route with mock fallback
- Passive website status checker for public URLs

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create your local environment file:

```bash
cp .env.example .env.local
```

3. Add your optional OpenRouter settings:

```bash
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=openrouter/free
```

`OPENROUTER_MODEL` is optional and defaults to `openrouter/free`.

If `OPENROUTER_API_KEY` is empty, the app falls back to a local mock audit response.

4. Start the dev server:

```bash
npm run dev
```

5. Open the app at `http://localhost:3000`.

## Scripts

- `npm run dev` starts the app locally
- `npm run lint` runs ESLint
- `npm run build` creates a production build
- `npm run check` runs lint and build together

## API routes

### `POST /api/audit`

Request body:

```json
{
  "inputType": "url",
  "content": "https://example.com"
}
```

Successful responses return:

```json
{
  "audit": {
    "clarityScore": 82,
    "mainProblem": "The hero is too vague.",
    "headlineRewrite": "Clearer headline here",
    "ctaRewrite": "Sharper CTA here",
    "pricingFeedback": "Offer feedback here",
    "trustSuggestions": "Trust suggestion one\nTrust suggestion two",
    "finalLandingCopy": "Improved copy here",
    "trustSafetyReview": {
      "trustScore": 78,
      "httpsFeedback": "HTTPS trust signal feedback here",
      "privacyTermsFeedback": "Privacy and terms feedback here",
      "contactTransparencyFeedback": "Contact transparency feedback here",
      "dataHandlingFeedback": "Data handling feedback here",
      "securityClaimsFeedback": "Security claims feedback here",
      "recommendedFixes": ["Fix one", "Fix two"]
    },
    "websiteStatus": {
      "checked": true,
      "inputUrl": "https://example.com",
      "finalUrl": "https://www.example.com",
      "isOnline": true,
      "statusCode": 200,
      "statusText": "OK",
      "responseTimeMs": 412,
      "redirected": true,
      "redirectCount": 1,
      "usesHttps": true
    }
  },
  "source": "openrouter",
  "model": "openrouter/free"
}
```

### `GET /api/health`

Returns:

```json
{
  "status": "ok",
  "app": "LaunchRoast AI",
  "timestamp": "2026-05-21T00:00:00.000Z"
}
```

## Website status checker

For `inputType: "url"`, the backend runs a passive status check before or during the audit.

It checks:

- whether the public URL is reachable
- the final HTTP status
- total response time
- whether HTTPS is used
- whether redirects happened
- the final resolved URL when redirected

It does not:

- scan ports
- test vulnerabilities
- probe admin paths
- attempt SQL injection or XSS payloads
- interact with login forms

Localhost, private IPs, and internal network destinations are blocked for safety.

## Environment variables

- `OPENROUTER_API_KEY`
  Optional. Enables live AI roasts through OpenRouter. Without it, the app runs in mock fallback mode.
- `OPENROUTER_MODEL`
  Optional. Defaults to `openrouter/free` when unset.

Recommended local file:

```bash
cp .env.example .env.local
```

## Vercel deployment

1. Push the project to GitHub.
2. Import the repo into Vercel.
3. Add `OPENROUTER_API_KEY` if you want live AI roasts.
4. Optionally add `OPENROUTER_MODEL` if you want a different OpenRouter model.
5. Deploy with the default Next.js build settings.

This app is already structured for Vercel:

- App Router is used throughout
- no database setup is required
- no authentication setup is required
- no API keys are exposed client-side
- analytics placeholders stay silent in production
- `robots.txt`, `sitemap.xml`, `/api/health`, and `/api/audit` are included

## Deployment notes

- Set `OPENROUTER_API_KEY` if you want live AI audits in production.
- Leave `OPENROUTER_MODEL` unset to use `openrouter/free`, or provide a different OpenRouter model name.
- The audit route falls back cleanly when the AI key is missing or the live AI call fails.
- The route blocks localhost and private-network URL fetching for safer deployment defaults.
- Placeholder analytics are wired through a small local abstraction and do not connect to any paid service yet.
- Metadata is configured for deployment under `https://launchroast.ai`.
- If you deploy to a different domain, update `metadataBase`, sitemap, and robots host values.
- Add a real support contact before launch.

## Production checklist

- Replace placeholder legal copy in `/privacy` and `/terms`
- Add a public support contact before launch
- Swap the analytics placeholder in `lib/analytics.ts`
- Set the production site URL if you deploy on a domain other than `launchroast.ai`
