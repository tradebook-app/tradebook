import Link from 'next/link'
import { sanityClient, urlFor } from '@/lib/sanity'
import { PortableText } from '@portabletext/react'

export const revalidate = 60

async function getPost(slug: string) {
  return sanityClient.fetch(`
    *[_type == "post" && slug.current == $slug][0] {
      _id,
      title,
      slug,
      publishedAt,
      excerpt,
      mainImage,
      body,
      categories[]->{ title },
      author->{ name, image }
    }
  `, { slug })
}

async function getAllSlugs() {
  return sanityClient.fetch(`*[_type == "post"]{ "slug": slug.current }`)
}

export async function generateStaticParams() {
  const slugs = await getAllSlugs()
  return slugs.map((s: any) => ({ slug: s.slug }))
}

const ptComponents = {
  block: {
    normal: ({ children }: any) => <p style={{ fontSize: '16px', lineHeight: 1.8, color: 'var(--txt2)', marginBottom: '20px' }}>{children}</p>,
    h2: ({ children }: any) => <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--txt)', margin: '40px 0 16px', letterSpacing: '-.02em' }}>{children}</h2>,
    h3: ({ children }: any) => <h3 style={{ fontSize: '19px', fontWeight: 700, color: 'var(--txt)', margin: '32px 0 12px' }}>{children}</h3>,
    blockquote: ({ children }: any) => (
      <blockquote style={{ borderLeft: '3px solid #10B981', paddingLeft: '20px', margin: '28px 0', color: 'var(--txt2)', fontStyle: 'italic', fontSize: '16px' }}>{children}</blockquote>
    ),
  },
  list: {
    bullet: ({ children }: any) => <ul style={{ paddingLeft: '24px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>{children}</ul>,
    number: ({ children }: any) => <ol style={{ paddingLeft: '24px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>{children}</ol>,
  },
  listItem: {
    bullet: ({ children }: any) => <li style={{ fontSize: '15px', color: 'var(--txt2)', lineHeight: 1.7 }}>{children}</li>,
    number: ({ children }: any) => <li style={{ fontSize: '15px', color: 'var(--txt2)', lineHeight: 1.7 }}>{children}</li>,
  },
  marks: {
    strong: ({ children }: any) => <strong style={{ color: 'var(--txt)', fontWeight: 700 }}>{children}</strong>,
    em: ({ children }: any) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
    code: ({ children }: any) => <code style={{ background: 'var(--bg3)', border: '1px solid var(--brd)', borderRadius: '4px', padding: '2px 6px', fontFamily: 'var(--mono)', fontSize: '13px', color: '#10B981' }}>{children}</code>,
  },
  types: {
    image: ({ value }: any) => (
      <div style={{ margin: '32px 0', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--brd)' }}>
        <img src={urlFor(value).width(800).url()} alt={value.alt || ''} style={{ width: '100%', display: 'block' }} />
        {value.caption && <div style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--txt3)', textAlign: 'center', background: 'var(--bg2)' }}>{value.caption}</div>}
      </div>
    ),
  },
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug)

  if (!post) {
    return (
      <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--sans)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', color: 'var(--txt2)', marginBottom: '16px' }}>Post not found.</div>
          <Link href="/blog" style={{ color: '#10B981', textDecoration: 'none', fontSize: '14px' }}>← Back to blog</Link>
        </div>
      </div>
    )
  }

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
          <Link href="/blog" style={{ fontSize: '13px', color: '#10B981', textDecoration: 'none', fontWeight: 600 }}>← Blog</Link>
          <Link href="/signup" style={{ fontSize: '13px', fontWeight: 700, color: '#000', background: '#10B981', borderRadius: '8px', padding: '8px 16px', textDecoration: 'none' }}>Start for free</Link>
        </div>
      </nav>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '80px 24px' }}>

        {/* Categories */}
        {post.categories?.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {post.categories.map((cat: any) => (
              <span key={cat.title} style={{ fontSize: '11px', fontWeight: 600, color: '#10B981', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', borderRadius: '20px', padding: '3px 12px' }}>
                {cat.title}
              </span>
            ))}
          </div>
        )}

        {/* Title */}
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1.1, marginBottom: '20px' }}>
          {post.title}
        </h1>

        {/* Meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px', paddingBottom: '32px', borderBottom: '1px solid var(--brd)', fontSize: '13px', color: 'var(--txt3)' }}>
          {post.author?.name && <span style={{ fontWeight: 600, color: 'var(--txt2)' }}>{post.author.name}</span>}
          {post.publishedAt && (
            <span>{new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          )}
        </div>

        {/* Cover image */}
        {post.mainImage && (
          <div style={{ marginBottom: '40px', borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--brd)' }}>
            <img
              src={urlFor(post.mainImage).width(720).height(400).url()}
              alt={post.title}
              style={{ width: '100%', display: 'block', objectFit: 'cover' }}
            />
          </div>
        )}

        {/* Body */}
        <div>
          {post.body && <PortableText value={post.body} components={ptComponents} />}
        </div>

        {/* Footer */}
        <div style={{ marginTop: '64px', paddingTop: '32px', borderTop: '1px solid var(--brd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/blog" style={{ fontSize: '13px', color: 'var(--txt3)', textDecoration: 'none' }}>← Back to blog</Link>
          <Link href="/signup" style={{ fontSize: '13px', fontWeight: 700, color: '#000', background: '#10B981', borderRadius: '8px', padding: '9px 20px', textDecoration: 'none' }}>Try Sleektrade free →</Link>
        </div>
      </div>
    </div>
  )
}
