export interface FeatureRequestPayload {
  name: string
  replyTo: string
  category: string
  message: string
  files: File[]
}

export async function submitFeatureRequest(payload: FeatureRequestPayload) {
  const body = new FormData()
  body.append('name', payload.name)
  body.append('replyTo', payload.replyTo)
  body.append('category', payload.category)
  body.append('message', payload.message)
  for (const file of payload.files) {
    body.append('files', file)
  }

  const response = await fetch('/api/feature-request', {
    method: 'POST',
    body,
  })

  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean
    error?: string
  }

  if (!response.ok || !data.ok) {
    throw new Error(data.error || 'Could not send your request.')
  }
}
