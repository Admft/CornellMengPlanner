const SITE_URL = 'https://www.cornellmemscheduleplanner.com'

const DEFAULT_TITLE = 'Cornell MEM Schedule Planner | M.Eng. Management Course Planner'
const DEFAULT_DESCRIPTION =
  'Free course planner for Cornell M.Eng. Management (MEM) distance learning students. Build a semester-by-semester degree plan and export Cornell\'s official proposal Excel form.'

export function setPageMeta(options: {
  title?: string
  description?: string
  path?: string
}) {
  const title = options.title ?? DEFAULT_TITLE
  const description = options.description ?? DEFAULT_DESCRIPTION
  const path = options.path ?? '/'
  const url = `${SITE_URL}${path}`

  document.title = title

  let descTag = document.querySelector('meta[name="description"]')
  if (!descTag) {
    descTag = document.createElement('meta')
    descTag.setAttribute('name', 'description')
    document.head.appendChild(descTag)
  }
  descTag.setAttribute('content', description)

  let canonical = document.querySelector('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.setAttribute('rel', 'canonical')
    document.head.appendChild(canonical)
  }
  canonical.setAttribute('href', url)

  for (const prop of ['og:title', 'og:description', 'og:url'] as const) {
    const key = prop.replace('og:', '')
    let tag = document.querySelector(`meta[property="${prop}"]`)
    if (!tag) {
      tag = document.createElement('meta')
      tag.setAttribute('property', prop)
      document.head.appendChild(tag)
    }
    const value =
      key === 'title' ? title : key === 'description' ? description : url
    tag.setAttribute('content', value)
  }
}

export function setDefaultPageMeta() {
  setPageMeta({})
}
