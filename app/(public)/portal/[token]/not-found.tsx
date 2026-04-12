/**
 * Portal not-found — §13.4
 *
 * Styled 404 shown when the portal token is invalid or expired.
 * NOT the default Next.js 404.
 */

export default function PortalNotFound() {
  return (
    <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-beige-100 flex items-center justify-center mx-auto mb-5">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="text-ink-soft">
            <path
              d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Message */}
        <h1 className="font-serif text-[26px] font-medium text-ink tracking-[-0.5px] mb-3">
          Link not valid
        </h1>
        <p className="text-[14px] text-ink-soft font-light leading-relaxed">
          This portal link is not valid or may have expired.
          Please contact your accountant for a new link.
        </p>
      </div>
    </div>
  )
}
