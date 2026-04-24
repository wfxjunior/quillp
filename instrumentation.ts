/**
 * instrumentation.ts
 *
 * Next.js instrumentation hook — runs once on server startup before any
 * requests are handled. This is the recommended way to initialize Sentry
 * in Next.js App Router (see https://docs.sentry.io/platforms/javascript/guides/nextjs/).
 *
 * NEXT_RUNTIME === 'nodejs'  → full Node.js server
 * NEXT_RUNTIME === 'edge'    → Edge Runtime (middleware, edge routes)
 *
 * The client-side SDK is still initialized via sentry.client.config.ts,
 * which is injected into the browser bundle by withSentryConfig in next.config.mjs.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}
