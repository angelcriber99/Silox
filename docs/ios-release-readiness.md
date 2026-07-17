# iPhone release readiness

## Implemented in `codex/native-ios`

- SwiftUI application, iPhone-only, portrait, iOS 18+.
- Google OAuth with native `ASWebAuthenticationSession` + PKCE and email/password
  against the same Supabase project as the web, with Keychain session storage and
  refresh-token renewal.
- Portfolio, position summary, Radar news/events, transaction history, add asset,
  buy/sell/dividend/withdrawal, portfolio history, price-alert list and settings.
- Offline read cache with stale-data indication; financial writes remain online-only.
- Real Face ID foreground lock and financial-cache cleanup at sign-out.
- Native WidgetKit extension with an opaque, revocable, read-only credential stored
  in shared Keychain.
- Versioned bearer-token API at `/api/mobile/v1`, tenant filters, RLS and durable
  idempotency for financial mutations.
- Reproducible Xcode project via XcodeGen, privacy manifests and shared test scheme.
- The portfolio uses the same market service/provider pipeline as the web and
  refreshes every five seconds while the app is active. Provider timestamps and
  stale-price state are preserved in the native model.
- Native iOS 26 Liquid Glass navigation and controls, with a classic SwiftUI
  fallback for iOS 18 and Reduce Motion support.

## Validated locally

- Debug unit/UI tests: iPhone 16e on iOS 18.4 and iPhone 17 Pro on iOS 26.5.
- UI matrix: compact and Pro Max layouts.
- Unsigned Release simulator and arm64 physical-device builds, including embedded
  widget validation.
- Next.js production build.
- Mobile/security/market contract tests and scoped ESLint.
- Supabase Google authorization smoke test: the configured native callback is
  accepted and redirects to Google. Completing the account consent requires an
  interactive user session.

## Required before TestFlight

1. Deploy this branch's Next.js backend.
2. Apply migrations `20260717120000`, `20260717143000` and `20260717150000`.
3. Run authenticated staging smoke tests for login, transaction with cash impact,
   idempotent retry, logout/cache isolation, widget issue/rotate/revoke and cron auth.
4. Select the Apple Developer Team owning the bundle IDs, App Group and Keychain
   group; archive and upload with its distribution certificate/profile.
5. Validate on the connected physical iPhone, including Face ID, backgrounding,
   poor connectivity and WidgetKit refresh.
6. Complete App Store metadata, privacy answers, screenshots and TestFlight review.

## Subsequent product parity

The first native release intentionally does not claim full web parity. Apple Sign
In is not enabled in the current Supabase project or exposed by the web. Transaction
editing/transfers, alert creation, broker import, advanced asset detail/charts,
analysis/projections, fiscal PDF, push/APNs and in-app account deletion remain
separate product slices and must not be exposed as working controls until their
native flows and backend contracts are validated.

Market polling is equivalent to the web, but source freshness is provider-bound:
metals may remain unchanged across several five-second polls because their provider
is cached and publishes less frequently than equities or crypto.
