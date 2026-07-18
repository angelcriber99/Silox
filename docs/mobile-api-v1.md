# Silox Mobile API v1

Base path: `/api/mobile/v1`. Every endpoint is dynamic, private and responds with
`Cache-Control: private, no-store` and `X-Request-Id`.

`GET /portfolio` is the exception to `no-store`: it returns
`Cache-Control: private, no-cache`, a weak private `ETag`, and
`X-Silox-Refresh-After` in seconds (`5` while the market is open, `30` otherwise).
Clients should send the last ETag in `If-None-Match`; unchanged financial data
returns `304` with the same three cache/refresh headers and no response body.
The volatile `asOf` timestamp is excluded from the weak semantic validator.

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
JSON numbers. New clients must send `quantity`, `unitPrice`, `commission`,
`sourceWithholding`, and `destinationWithholding` as canonical non-negative
decimal strings (for example, `"0"`, `"12.5"`, `"0.00000001"`). Leading zeroes,
trailing fractional zeroes, signs, commas, and exponent notation are rejected.
Finite non-negative JSON numbers remain accepted for one compatibility version.

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
`sourceWithholding`, `destinationWithholding`, `status`, `date`, `notes`, and
`updateCash`. Supported operations are `Compra`, `Venta`, `Dividendo`,
`Traspaso Salida`, `Traspaso Entrada`, and `Retirada`.

When `updateCash` is `true`, the server derives the linked movement in the
asset currency without converting the decimal inputs through a binary floating
point number:

- `Compra`: cash withdrawal = `quantity × unitPrice + commission`.
- `Venta`: cash deposit = `quantity × unitPrice - commission - sourceWithholding - destinationWithholding`.
- `Dividendo`: cash deposit = `unitPrice - commission - sourceWithholding - destinationWithholding`;
  `unitPrice` is the gross dividend amount and is not multiplied by quantity.

An explicit legacy `cashImpact: { operation, amount }` is still accepted and
takes precedence over `updateCash` for one compatibility version. Omitting both
keeps creation compatible with the old no-cash behavior. On a patch, omitting
both preserves an existing linked cash movement; `updateCash: false` removes it.

## Transaction listing

Legacy clients can continue using `GET /transactions?page=1&pageSize=50`. The
response contains `items`, `page`, `pageSize`, and `total`; both values are
positive integers and `pageSize` is capped at 100.

New clients use `GET /transactions?limit=50&cursor=…`. Omit `cursor` for the
first page. The response contains `items`, `limit`, `hasMore`, and an opaque
nullable `nextCursor`. Cursor and offset parameters cannot be mixed. Ordering is
stable by date, creation timestamp, and id, all descending.

Both modes accept these server-side filters:

- `query`: ticker, asset name, operation or notes; 1–100 letters, numbers,
  spaces, `.`, `_`, or `-`.
- `year`: calendar year from 1900 through 2200.
- `operation`: one of the supported transaction operations.
- `assetId`: owned asset UUID.

## Revolut and MyInvestor import

Native clients upload CSV or XLSX statements up to 10 MB to
`POST /api/import/revolut` as `multipart/form-data` with a `file` field. The
route accepts the same Bearer authentication as this API in addition to the web
cookie session. It deliberately reuses the existing parser, FIFO, reward,
dividend, withholding, fee, cash reconciliation and duplicate rules so mobile
and web cannot drift.

Transfers use `{ "source": <transaction>, "destination": <transaction> }`,
with the corresponding transfer operation fixed for each leg.

Alerts use `ticker`, `targetPrice`, `condition`; patches may also set
`triggered`. Events use `assetId`, `title`, `dayOfMonth`, `type`. Settings use
`pushNotifications`, `emailNotifications`, `priceAlerts`, `weeklyReport`, and
`dividendAlerts`.

## Idempotency

`POST /transactions`, `PATCH|DELETE /transactions/{id}`, and
`POST /transactions/transfers` require an
`Idempotency-Key` header (1–128 characters). The key is isolated by user, method
and path. A completed request
replays its original response. Reuse with another payload returns
`409 idempotency_conflict`; a concurrent request returns
`409 operation_in_progress`.

The migration `20260717120000_mobile_api_idempotency.sql` must be applied before
enabling financial mutations in staging or production.
