import Link from 'next/link'
import { sanityClient, urlFor } from '@/lib/sanity'

export const revalidate = 60

async function getPosts() {
  return sanityClient.fetch(`
    *[_type == "post"] | order(publishedAt desc) {
      _id,
      title,
      slug,
      publishedAt,
      excerpt,
      mainImage,
      categories[]->{ title },
      author->{ name }
    }
  `)
}

export default async function BlogPage() {
  const posts = await getPosts()

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--txt)', fontFamily: 'var(--sans)', minHeight: '100vh' }}>

      {/* NAV */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: '60px', borderBottom: '1px solid var(--brd)', background: 'rgba(13,13,17,0.95)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <svg width="28" height="28" viewBox="0 0 64 64">
            <rect x="0" y="0" width="64" height="64" rx="14" fill="#062e21"/>
            <polyline points="11,51 22,39 33,45 51,27" fill="none" stroke="#5DCAA5" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-.01em', color: 'var(--txt)' }}>
            Sleek<span style={{ color: '#1D9E75' }}>trade</span>
          </span>
        </Link>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <Link href="/#features" style={{ fontSize: '13px', color: 'var(--txt2)', textDecoration: 'none' }}>Features</Link>
          <Link href="/#pricing" style={{ fontSize: '13px', color: 'var(--txt2)', textDecoration: 'none' }}>Pricing</Link>
          <Link href="/blog" style={{ fontSize: '13px', color: 'var(--ac)', textDecoration: 'none', fontWeight: 600 }}>Blog</Link>
          <Link href="/signup" style={{ fontSize: '13px', fontWeight: 700, color: '#000', background: '#10B981', borderRadius: '8px', padding: '8px 16px', textDecoration: 'none' }}>Start for free</Link>
        </div>
      </nav>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '80px 24px' }}>
        {/* Header */}
        <div style={{ marginBottom: '64px' }}>
          <div style={{ display: 'inline-block', fontSize: '11px', fontWeight: 700, color: '#10B981', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', borderRadius: '20px', padding: '4px 14px', marginBottom: '20px', letterSpacing: '.05em', textTransform: 'uppercase' }}>
            Blog
          </div>
          <h1 style={{ fontSize: '44px', fontWeight: 800, letterSpacing: '-.03em', marginBottom: '14px', lineHeight: 1.1 }}>
            Trading insights &amp; tips
          </h1>
          <p style={{ fontSize: '16px', color: 'var(--txt2)', lineHeight: 1.7 }}>
            Real trading knowledge from an active day &amp; swing trader. No fluff, no theory — just what actually works.
          </p>
        </div>

        {/* Posts */}
        {posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--txt3)' }}>
            <div style={{ fontSize: '32px', marginBottom: '16px' }}>✍️</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--txt2)', marginBottom: '8px' }}>No posts yet</div>
            <div style={{ fontSize: '14px' }}>Check back soon — content is coming.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '24px' }}>
            {posts.map((post: any) => (
              <Link key={post._id} href={`/blog/${post.slug.current}`} style={{ textDecoration: 'none' }}>
                <article style={{
                  background: 'var(--bg2)', border: '1px solid var(--brd)',
                  borderRadius: '14px', overflow: 'hidden',
                  transition: '.15s', cursor: 'pointer',
                }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brd2)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--brd)')}
                >
                  {/* Cover image */}
                  {post.mainImage && (
                    <div style={{ height: '200px', overflow: 'hidden', background: 'var(--bg3)' }}>
                      <img
                        src={urlFor(post.mainImage).width(600).height(200).url()}
                        alt={post.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  )}
                  {!post.mainImage && (
                    <div style={{ height: '120px', background: 'linear-gradient(135deg, rgba(16,185,129,.08), rgba(16,185,129,.03))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(16,185,129,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 3v18h18"/><polyline points="7 16 11 10 15 14 19 7"/>
                      </svg>
                    </div>
                  )}

                  <div style={{ padding: '20px' }}>
                    {/* Categories */}
                    {post.categories?.length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
                        {post.categories.map((cat: any) => (
                          <span key={cat.title} style={{ fontSize: '10px', fontWeight: 600, color: '#10B981', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', borderRadius: '20px', padding: '2px 10px' }}>
                            {cat.title}
                          </span>
                        ))}
                      </div>
                    )}

                    <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--txt)', marginBottom: '8px', lineHeight: 1.3 }}>
                      {post.title}
                    </h2>

                    {post.excerpt && (
                      <p style={{ fontSize: '13px', color: 'var(--txt2)', lineHeight: 1.65, marginBottom: '16px' }}>
                        {post.excerpt}
                      </p>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: '11px', color: 'var(--txt3)' }}>
                        {post.author?.name && <span>{post.author.name} · </span>}
                        {post.publishedAt && new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <span style={{ fontSize: '12px', color: '#10B981', fontWeight: 600 }}>Read →</span>
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}

        <div style={{ marginTop: '64px', paddingTop: '32px', borderTop: '1px solid var(--brd)', fontSize: '12px' }}>
          <Link href="/" style={{ color: 'var(--txt3)', textDecoration: 'none' }}>← Back to home</Link>
        </div>
      </div>
    </div>
  )
}
