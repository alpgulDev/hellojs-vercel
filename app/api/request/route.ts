import request from '@unreleased/hellojs'

export const runtime = 'nodejs'
export const maxDuration = 60

type RequestBody = {
  url?: string
  profile?: string
  h3?: boolean
}

const blockedHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1'])

function validateTarget(value: unknown) {
  if (typeof value !== 'string' || value.length > 2048) return null
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol)) return null
  if (blockedHosts.has(url.hostname) || url.hostname.endsWith('.local')) return null
  return url.toString()
}

async function platformFetch(target: string, startedAt: number) {
  const fallback = await fetch(target, { redirect: 'follow', signal: AbortSignal.timeout(60_000) })
  const text = await fallback.text()
  let parsedBody: unknown = text
  try { parsedBody = JSON.parse(text) } catch {}
  return Response.json({
    ok: fallback.ok,
    status: fallback.status,
    statusText: fallback.ok ? 'Request completed (runtime fallback)' : 'Request returned an error status',
    headers: Object.fromEntries(fallback.headers.entries()),
    body: parsedBody,
    durationMs: Math.round(performance.now() - startedAt),
    protocol: 'Platform fetch fallback',
  })
}

export async function POST(input: Request) {
  let body: RequestBody
  try {
    body = (await input.json()) as RequestBody
  } catch {
    return Response.json({ ok: false, error: 'Request body must be valid JSON.' }, { status: 400 })
  }

  const target = validateTarget(body.url)
  if (!target) {
    return Response.json({ ok: false, error: 'Enter a valid public http:// or https:// URL.' }, { status: 400 })
  }

  const startedAt = performance.now()
  const [major, minor] = process.versions.node.split('.').map(Number)
  if (major < 24 || (major === 24 && minor < 7)) {
    try {
      return await platformFetch(target, startedAt)
    } catch (error) {
      return Response.json({
        ok: false,
        error: error instanceof Error ? error.message : 'Request failed.',
        durationMs: Math.round(performance.now() - startedAt),
      }, { status: 502 })
    }
  }

  try {
    const selectedProfile = request.profiles.get(body.profile || 'chrome147-mac') as { tls?: Record<string, unknown> } | undefined
    const runtimeProfileName = `runtime-tls12-${body.profile || 'chrome147-mac'}`
    if (selectedProfile) {
      request.profiles.register(runtimeProfileName, {
        ...selectedProfile,
        tls: {
          ...selectedProfile.tls,
          // The Vercel Node runtime may not expose ML-KEM Web Crypto yet.
          // Keep the selected browser headers while negotiating TLS 1.2 safely.
          supportedVersions: [0x0303],
          supportedGroups: Array.isArray(selectedProfile.tls?.supportedGroups)
            ? selectedProfile.tls.supportedGroups.filter((group) => group !== 4588)
            : selectedProfile.tls?.supportedGroups,
          keyShareGroups: Array.isArray(selectedProfile.tls?.keyShareGroups)
            ? selectedProfile.tls.keyShareGroups.filter((group) => group !== 4588)
            : selectedProfile.tls?.keyShareGroups,
          extensionOrder: Array.isArray(selectedProfile.tls?.extensionOrder)
            ? selectedProfile.tls.extensionOrder.filter((extension) => extension?.id !== 51)
            : selectedProfile.tls?.extensionOrder,
        },
      })
    }

    const response = await request({
      url: target,
      profile: selectedProfile ? runtimeProfileName : body.profile || 'chrome147-mac',
      h3: body.h3 === true,
      timeout: 60_000,
      simple: false,
      resolveWithFullResponse: true,
    })

    const rawBody = response.body
    let parsedBody: unknown = rawBody
    if (Buffer.isBuffer(rawBody)) {
      const text = rawBody.toString('utf8')
      try { parsedBody = JSON.parse(text) } catch { parsedBody = text }
    }

    return Response.json({
      ok: response.status >= 200 && response.status < 400,
      status: response.status,
      statusText: response.status >= 200 && response.status < 400 ? 'Request completed' : 'Request returned an error status',
      headers: response.headers,
      body: parsedBody,
      durationMs: Math.round(performance.now() - startedAt),
      protocol: body.h3 ? 'HTTP/3 preferred' : 'HTTP/2 / HTTP/1.1',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed.'

    // Older Node runtimes cannot expose hellojs's ML-KEM Web Crypto primitive.
    // Preserve the request UI's functionality with the platform fetch transport
    // while still using hellojs whenever its selected transport is available.
    if (message.includes('ML-KEM')) {
      try {
        const fallback = await fetch(target, { redirect: 'follow', signal: AbortSignal.timeout(60_000) })
        const text = await fallback.text()
        let parsedBody: unknown = text
        try { parsedBody = JSON.parse(text) } catch {}
        return Response.json({
          ok: fallback.ok,
          status: fallback.status,
          statusText: fallback.ok ? 'Request completed (runtime fallback)' : 'Request returned an error status',
          headers: Object.fromEntries(fallback.headers.entries()),
          body: parsedBody,
          durationMs: Math.round(performance.now() - startedAt),
          protocol: 'Platform fetch fallback',
        })
      } catch (fallbackError) {
        return Response.json({
          ok: false,
          error: fallbackError instanceof Error ? fallbackError.message : message,
          durationMs: Math.round(performance.now() - startedAt),
        }, { status: 502 })
      }
    }

    return Response.json({
      ok: false,
      error: message,
      durationMs: Math.round(performance.now() - startedAt),
    }, { status: 502 })
  }
}
