import type { Partner } from '@/app/admin/partners/types'

const usd = (n: number) => `$${Number(n).toFixed(2)}`

type Props = { partners: Partner[] }

export function PartnerStatCards({ partners }: Props) {
  const totalSignups = partners.reduce((s, p) => s + p.signups, 0)
  const totalOwed = partners.reduce((s, p) => s + p.owed, 0)
  const totalPaid = partners.reduce((s, p) => s + p.paid, 0)

  const card = (label: string, value: string) => (
    <div style={{ background: '#15151a', border: '1px solid #222', borderRadius: '10px', padding: '16px', flex: 1, minWidth: '160px' }}>
      <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff' }}>{value}</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
      {card('Active partners', String(partners.length))}
      {card('Total referred signups', String(totalSignups))}
      {card('Total owed now', usd(totalOwed))}
      {card('Total paid out', usd(totalPaid))}
    </div>
  )
}
