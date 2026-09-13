import Link from 'next/link'

// None of the admin pages link to each other or anywhere in the main app —
// each is only reachable by typing its URL directly. Rather than picking
// one arbitrary place to bolt a link onto, this makes all of them mutually
// discoverable from each other.
const LINKS: { href: string; label: string }[] = [
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/referrals', label: 'Referral Payouts' },
  { href: '/admin/partners', label: 'Partners' },
]

type Props = { active: 'users' | 'referrals' | 'partners' }

export function AdminNav({ active }: Props) {
  return (
    <div style={{ display: 'flex', gap: '20px', marginBottom: '28px', paddingBottom: '14px', borderBottom: '1px solid #222' }}>
      {LINKS.map(l => {
        const isActive = l.href === `/admin/${active}`
        return (
          <Link
            key={l.href}
            href={l.href}
            style={{ fontSize: '12px', fontWeight: 700, textDecoration: 'none', color: isActive ? '#10B981' : '#888' }}
          >
            {l.label}
          </Link>
        )
      })}
    </div>
  )
}
