# Silox Mobile API v1

Base path: `/api/mobile/v1`. Every endpoint is dynamic, private and responds with
`Cache-Control: private, no-store` and `X-Request-Id`.

## Authentication and envelopes

The native app sends `Authorization: Bearer <Supabase access token>`. Browser
clients may use the existing Supabase cookie session. Bearer credentials take
precedence; an invalid bearer token never falls back to cookies.

Successful JSON responses use:

```json
{ "data": {} }
```

Errors use:

```json
{
  "error": { "code": "validation_error", "message": "…", "details": {} },
  "requestId": "uuid-or-client-request-id"
}
```

Dates are ISO-8601 (calendar dates use `YYYY-MM-DD`; timestamps are UTC).
Amounts and quantities in responses are decimal strings. Percentage values are
JSON numbers. Request amounts are finite JSON numbers.

## Resources

| Method | Path | Description |
| --- | --- | --- |
| GET | `/me` | Verified user identity and authentication method |
| GET | `/portfolio` | Server-calculated positions, live prices and totals |
| GET | `/portfolio/history?from=&to=` | Daily portfolio snapshots |
| GET, POST | `/assets` | List or create owned assets |
| GET, PATCH, DELETE | `/assets/{id}` | Read or mutate one owned asset |
| GET, POST | `/transactions` | Paginated list or atomic transaction creation |
| PATCH, DELETE | `/transactions/{id}` | Atomic update or deletion |
| POST | `/transactions/transfers` | Atomic two-leg fund transfer |
| GET, POST | `/alerts` | List or create price alerts |
| PATCH, DELETE | `/alerts/{id}` | Update/trigger or delete an alert |
| GET, POST | `/events` | List or create recurring investment events |
| PATCH, DELETE | `/events/{id}` | Update or delete a recurring event |
| GET, PATCH | `/settings` | Notification preferences |
| GET | `/search?q=` | Yahoo Finance instrument search |
| GET | `/news?ticker=` | Instrument news |
| POST | `/market/events` | Dividend calendar for up to 100 tickers |

All database reads and mutations are scoped with the verified `user_id` in
addition to Supabase RLS. Identifiers are UUIDs.

## Mutation shapes

Assets use camelCase fields: `ticker`, `isin`, `name`, `type`, `strategy`,
`currency`, `sector`, `geography`, `notes`.

Transactions use `assetId`, `operation`, `quantity`, `unitPrice`, `commission`,
`sourceWithholding`, `destinationWithholding`, `status`, `date`, `notes`, and an
optional `cashImpact: { operation, amount }`. Supported operations are `Compra`,
`Venta`, `Dividendo`, `Traspaso Salida`, `Traspaso Entrada`, and `Retirada`.

Transfers use `{ "source": <transaction>, "destination": <transaction> }`,
with the corresponding transfer operation fixed for each leg.

Alerts use `ticker`, `targetPrice`, `condition`; patches may also set
`triggered`. Events use `assetId`, `title`, `dayOfMonth`, `type`. Settings use
`pushNotifications`, `emailNotifications`, `priceAlerts`, `weeklyReport`, and
`dividendAlerts`.

## Idempotency

`POST /transactions`, `PATCH|DELETE /transactions/{id}`, and
`POST /transactions/transfers` require an `Idempotency-Key` header (1–128
characters). The key is isolated by user, method and path. A completed request
replays its original response. Reuse with another payload returns
`409 idempotency_conflict`; a concurrent request returns
`409 operation_in_progress`.

The migration `20260717120000_mobile_api_idempotency.sql` must be applied before
enabling financial mutations in staging or production.
