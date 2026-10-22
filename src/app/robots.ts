import { MetadataRoute } from 'next'
import { getAppOrigin } from '@/lib/app-origin'

/**
 * Crawl directives for the public marketing site.
 *
 * Every private tree is listed in both bare and trailing-slash form: a
 * `Disallow: /scan/` rule does NOT cover `/scan` itself, so the bare paths
 * were crawlable before this list was normalised.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getAppOrigin()

  const privateTrees = ['/dashboard', '/scan', '/settings', '/history', '/monitoring', '/admin']

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        ...privateTrees.flatMap((root) => [root, `${root}/`]),
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
