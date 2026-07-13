export type CronAuthorizationResult =
  | { authorized: true }
  | { authorized: false; status: 401 | 500; error: string }

export function authorizeCronRequest(
  request: Request,
  secret = process.env.CRON_SECRET,
): CronAuthorizationResult {
  if (!secret) {
    return {
      authorized: false,
      status: 500,
      error: 'CRON_SECRET not configured',
    }
  }

  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return {
      authorized: false,
      status: 401,
      error: 'Unauthorized',
    }
  }

  return { authorized: true }
}
