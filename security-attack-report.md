# Silox Security Attack Report

Scan date: 2026-07-10  
Commit tested: `86b52bae4a5ce039f33fe1a4a9eb728f94ec5424`  
Scope: local repository after `git pull --ff-only` from `origin/main` (`https://github.com/angelcriber99/Silox.git`).

## Execution Notes

- The repository was updated successfully from `3196b32` to `86b52ba`.
- I could not run the app locally: `npm` and `node` are not on `PATH`, no `node_modules` directory is present, and `node_modules/next/dist/docs/` is absent. Therefore the attacks below are code-evidenced and include reproducible payloads, but were not executed against a running local Next.js server.
- Threat model used for this report: Silox is a personal finance dashboard backed by Supabase Auth/RLS. Primary sensitive assets are user portfolios, transactions, alerts, portfolio history, Supabase service-role operations, Gemini API usage, and Telegram alert side effects.

## Findings

### 1. Committed financial transaction data exposes portfolio history

Severity: Medium (P2)  
Category: Sensitive data exposure  
Affected files:

- `transacciones_backup.json` lines 1-698
- `prueba excel.csv` lines 1-32
- `pruebapdf.pdf`

Attack path:

1. An attacker with repository access pulls the GitHub repository or reads the files through the GitHub UI.
2. The attacker opens `transacciones_backup.json` and obtains transaction IDs, asset IDs, `user_id`, quantities, prices, dates, retention fields, and status values.
3. The attacker opens `prueba excel.csv` and obtains detailed cash top-ups, withdrawals, tickers, operation types, quantities, prices, FX rates, and dates.
4. If the repository is public or broadly shared, these files disclose real or realistic financial behavior outside the app's authenticated Supabase boundary.

Evidence:

- `transacciones_backup.json` contains 698 lines of transaction records, including repeated `user_id` values and per-transaction UUIDs.
- `prueba excel.csv` contains cash movements and market orders such as `CASH TOP-UP`, `CASH WITHDRAWAL`, `BUY - MARKET`, and `SELL - MARKET`.
- `.gitignore` excludes `.env*` but does not exclude local exports, CSV/PDF test imports, or backup JSON files.

Reproduction:

```bash
git clone https://github.com/angelcriber99/Silox.git
cd Silox
head -40 transacciones_backup.json
head -20 "prueba excel.csv"
```

Attack Path Facts:

- In scope: yes, repository contents for the production app.
- Exposure: GitHub remote is configured; actual public/private visibility was not verified.
- Vector: remote repository read if the repository is public or accessible to the attacker.
- Auth scope: repository access, not app authentication.
- Cross-boundary behavior: yes, financial data leaves Supabase/RLS and becomes static source-controlled data.
- Preconditions: attacker can read the repository.
- Impact surface: data/privacy.
- Counterevidence: the repo may be private, and the data may be test data. This reduces likelihood/confidence but does not eliminate the risk because the files look like realistic portfolio exports.
- Confidence: high for data presence, medium for external exposure.

Recommended fix:

- Remove the files from the current tree.
- Rewrite or purge Git history if the data is real or sensitive.
- Add ignore patterns such as `*.csv`, `*.pdf`, `*_backup.json`, `transacciones*.json`, or a narrower `local-data/` convention.
- Add a pre-commit secret/data scanner rule for financial exports.

### 2. CSRF-prone destructive `GET` endpoint deletes portfolio history

Severity: Low (P3)  
Category: CSRF / unsafe state-changing GET  
Affected file: `app/api/nuke-history/route.ts` lines 4-22

Attack path:

1. A victim is authenticated in Silox.
2. An attacker causes a top-level navigation to `/api/nuke-history` from another site, email, chat, or malicious page.
3. The browser sends the victim's Supabase session cookies on the navigation.
4. The route authenticates the victim with `supabase.auth.getUser()`.
5. The route deletes all `portfolio_history` rows for `user.id`.

Evidence:

- The route exports `GET()` for a destructive action.
- It only checks that a user exists.
- It executes `.from('portfolio_history').delete().eq('user_id', user.id)`.
- There is no CSRF token, origin check, re-authentication, confirmation nonce, or POST-only enforcement.

Reproduction payload:

```html
<!doctype html>
<meta http-equiv="refresh" content="0;url=https://silox-chi.vercel.app/api/nuke-history">
```

Or:

```bash
curl -i \
  -H 'Cookie: <victim_supabase_auth_cookies>' \
  https://silox-chi.vercel.app/api/nuke-history
```

Attack Path Facts:

- In scope: yes, authenticated app API.
- Exposure: the route is under the deployed app; middleware protects it with authentication but does not block cross-site navigations.
- Vector: remote web CSRF against an authenticated user.
- Auth scope: victim user session required.
- Cross-boundary behavior: yes, an external site can trigger an authenticated state change.
- Preconditions: victim must be logged in and interact with a link/navigation.
- Impact surface: data integrity/availability for the victim's portfolio history.
- Counterevidence: deletion is scoped to the victim's own `user_id`; there is no cross-user or service-role impact. SameSite cookie defaults may reduce some embedded request variants, but top-level GET navigation remains the relevant risk.
- Confidence: high.

Recommended fix:

- Change the route to `POST` or `DELETE`.
- Require an explicit CSRF token or same-origin/origin validation for cookie-authenticated mutation routes.
- Add a UI confirmation flow and preferably soft-delete or backup recovery for history deletion.
- Consider removing the endpoint if it is a temporary debugging tool.

### 3. Cron service-role endpoint accepts secrets in query strings

Severity: Medium (P2)  
Category: Secret exposure / privileged background operation hardening  
Affected file: `app/api/cron/check-alerts/route.ts` lines 21-35, 103-145

Attack path:

1. The cron route accepts either `Authorization: Bearer <CRON_SECRET>` or `?secret=<CRON_SECRET>`.
2. Query-string secrets are commonly captured in logs, browser history, analytics, monitoring, proxy traces, copied URLs, and incident screenshots.
3. If the query secret leaks, an attacker can call `/api/cron/check-alerts?secret=<leaked>` remotely.
4. The route creates a Supabase client with `SUPABASE_SERVICE_ROLE_KEY`, reads all untriggered alerts, fetches market data, deletes triggered alerts, and may send Telegram messages.

Evidence:

- `secretParam = url.searchParams.get('secret')`.
- The authorization check accepts `secretParam !== process.env.CRON_SECRET` as an alternative to the bearer token.
- The route uses `SUPABASE_SERVICE_ROLE_KEY`, so RLS does not constrain its database operations.
- `vercel.json` only schedules `/api/cron/snapshot`; this route appears callable as an API route rather than only through Vercel cron configuration.

Reproduction:

```bash
curl -i 'https://silox-chi.vercel.app/api/cron/check-alerts?secret=<CRON_SECRET>'
```

Expected result with a valid leaked secret: the route processes all active alerts using service-role privileges.

Attack Path Facts:

- In scope: yes, production background API and service-role workflow.
- Exposure: public API path protected by a shared secret.
- Vector: remote if the secret leaks.
- Auth scope: shared cron secret, not user auth.
- Cross-boundary behavior: yes, leaked URL secret crosses from operational tooling/logs into attacker-controlled requests.
- Preconditions: attacker must obtain `CRON_SECRET`.
- Impact surface: data integrity for alerts and notification side effects; service-role blast radius if route logic expands later.
- Counterevidence: without the secret, the route returns 401. The finding is about raising the leakage probability of that secret, not an unauthenticated bypass.
- Confidence: medium.

Recommended fix:

- Remove query-string authentication; accept only `Authorization: Bearer <CRON_SECRET>`.
- Add this route to `vercel.json` if it is meant to be a real cron job.
- Rotate `CRON_SECRET` if it has ever been used in query strings.
- Minimize service-role operations and log only non-sensitive request metadata.

### 4. Authenticated Revolut import has no file size/type enforcement before full memory read

Severity: Low (P3)  
Category: Resource exhaustion / unsafe file ingestion  
Affected files:

- `app/api/import/revolut/route.ts` lines 12-23
- `components/transactions/revolut-sync.tsx` lines 72-76

Attack path:

1. An authenticated low-privilege user posts a large multipart file to `/api/import/revolut`.
2. The route calls `request.formData()`, then `file.arrayBuffer()`, then `Buffer.from(arrayBuffer)`.
3. The server loads the entire file into memory before any size, MIME type, or row-count limit.
4. Repeated uploads can consume memory/CPU and degrade the serverless function or app availability.

Evidence:

- The client accepts `.pdf,.csv`, but client-side accept filters are bypassable.
- The server does not validate `file.size`, `file.type`, extension, or maximum row count before reading.
- The parser splits the complete file into lines in memory.

Reproduction:

```bash
python3 - <<'PY'
with open('/tmp/large-revolut.csv', 'w') as f:
    f.write('Date,Ticker,Type,Quantity,Price per share,Total Amount,Currency,FX Rate\n')
    for i in range(2_000_000):
        f.write(f'2026-01-01T00:00:00Z,AAAA,BUY - MARKET,1,USD 1,USD 1,USD,1\\n')
PY

curl -i \
  -H 'Cookie: <authenticated_supabase_cookies>' \
  -F 'file=@/tmp/large-revolut.csv;type=text/csv' \
  https://silox-chi.vercel.app/api/import/revolut
```

Attack Path Facts:

- In scope: yes, authenticated app API.
- Exposure: authenticated route.
- Vector: remote authenticated.
- Auth scope: any logged-in user.
- Cross-boundary behavior: limited; primarily affects shared server resources.
- Preconditions: attacker needs a valid account/session.
- Impact surface: availability.
- Counterevidence: serverless platforms often enforce request/function limits, and the impact may be transient. That keeps severity low.
- Confidence: medium-high.

Recommended fix:

- Reject files above a small explicit limit before reading, for example 1-5 MB.
- Validate MIME type and extension server-side.
- Stream parse CSV instead of buffering the full file.
- Add row-count and per-user rate limits.

## Candidates Reviewed And Suppressed

- Cross-user IDOR in server actions: suppressed. Mutating actions generally check `user_id`, and Supabase RLS policies in `supabase/auth_setup.sql` and related scripts enforce `auth.uid() = user_id`.
- `posiciones` view data leakage: suppressed for current codebase. `supabase/fix_rls_posiciones.sql` recreates the view with `security_invoker = true`, and `supabase/security_patch.sql` documents the same fix.
- Open redirect in `app/auth/callback/route.ts`: suppressed. `${origin}${next}` keeps redirects on the same origin for ordinary `next` values; no external redirect was established from repository evidence.
- Basic reflected XSS in ticker/news/search routes: suppressed. Inputs are passed to Yahoo/Gemini APIs and returned as JSON or rendered through React, not directly through `dangerouslySetInnerHTML`.

## Verification Gaps

- Local dynamic testing was blocked because the project dependencies/runtime are not installed in this workspace (`npm` and `node` are unavailable on `PATH`; only a bundled standalone `node` exists).
- I did not test against the live production URL with real credentials or secrets.
- I did not verify whether the GitHub repository is public or private; the data-exposure finding assumes an attacker with repository read access.
