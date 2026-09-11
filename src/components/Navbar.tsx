import Link from 'next/link'

const Logo = () => (
  <svg width="38" height="38" viewBox="0 0 64 64">
    <rect x="0" y="0" width="64" height="64" rx="14" fill="#062e21"/>
    <rect x="11" y="13" width="42" height="4" rx="2" fill="#5DCAA5"/>
    <rect x="11" y="21" width="42" height="4" rx="2" fill="#5DCAA5" opacity={0.5}/>
    <rect x="11" y="29" width="28" height="4" rx="2" fill="#5DCAA5" opacity={0.22}/>
    <polyline points="11,51 22,39 33,45 51,27" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="11" cy="51" r="2.5" fill="#5DCAA5" opacity={0.7}/>
    <circle cx="22" cy="39" r="2.5" fill="#5DCAA5" opacity={0.7}/>
    <circle cx="33" cy="45" r="2.5" fill="#5DCAA5" opacity={0.7}/>
    <circle cx="51" cy="27" r="3.5" fill="#5DCAA5"/>
  </svg>
)

// Shared marketing-site nav — the landing page, /signup, and /login all
// mount this. It relies on `position: sticky`, which only works if NOTHING
// between the <nav> and the viewport sets overflow-x or overflow-y to
// anything but `visible` (per spec, even clipping just one axis turns the
// element into a scroll container `sticky` can't escape — Chrome has
// historically been lax about enforcing this, which is why the old inline
// nav only visibly broke in Firefox: BUG-LP-008/032/033). Callers MUST mount
// <Navbar /> as a sibling of their own root wrapper, never nested inside
// one — do not wrap it in a div that sets overflow.
export function Navbar() {
  return (
    <>
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: '60px', borderBottom: '1px solid var(--brd)',
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(13,13,17,0.95)', backdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Logo />
          <span style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-.01em' }}>
            Sleek<span style={{ color: '#1D9E75' }}>trade</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }} className="desktop-nav-links">
          {/* Absolute (/#section) rather than bare (#section) so these still
              resolve correctly when this navbar is mounted on /signup or
              /login, not just on the landing page itself. */}
          <Link href="/#features" style={{ fontSize: '13px', color: 'var(--txt2)', textDecoration: 'none' }}>Features</Link>
          <Link href="/#pricing" style={{ fontSize: '13px', color: 'var(--txt2)', textDecoration: 'none' }}>Pricing</Link>
          <Link href="/#who" style={{ fontSize: '13px', color: 'var(--txt2)', textDecoration: 'none' }}>Who it's for</Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Link href="/login" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--txt2)', textDecoration: 'none', padding: '7px 12px', whiteSpace: 'nowrap' }} className="desktop-login">Log in</Link>
          <Link href="/signup" style={{ fontSize: '13px', fontWeight: 700, color: '#000', background: '#10B981', borderRadius: '8px', padding: '8px 16px', textDecoration: 'none', whiteSpace: 'nowrap' }}>Start for free</Link>
        </div>
      </nav>
      {/* Moved in from the landing page's own <style> block so the same
          responsive behavior applies wherever this navbar is mounted. */}
      <style>{`
        @media (max-width: 640px) {
          .desktop-nav-links { display: none !important; }
        }
      `}</style>
    </>
  )
}
