'use client'

import { FormEvent, useState } from 'react'
import { Check, ChevronDown, Clock3, Globe2, Loader2, Network, Send, ShieldCheck, Terminal, X } from 'lucide-react'

type RequestResult = {
  ok: boolean
  status?: number
  statusText?: string
  headers?: Record<string, string | string[]>
  body?: unknown
  durationMs?: number
  protocol?: string
  error?: string
}

const initialResult: RequestResult = {
  ok: true,
  status: 200,
  statusText: 'Ready to send',
  durationMs: 0,
  protocol: 'HTTP/2',
  body: { message: 'Configure a request and press Send request.' },
}

export function RequestConsole() {
  const [url, setUrl] = useState('https://httpbingo.org/get')
  const [profile, setProfile] = useState('chrome147-mac')
  const [http3, setHttp3] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RequestResult>(initialResult)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    const startedAt = performance.now()

    try {
      const response = await fetch('/api/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url, profile, h3: http3 }),
      })
      const payload = await response.json()
      setResult({ ...payload, durationMs: payload.durationMs ?? Math.round(performance.now() - startedAt) })
    } catch (error) {
      setResult({ ok: false, error: error instanceof Error ? error.message : 'Request failed', durationMs: Math.round(performance.now() - startedAt) })
    } finally {
      setLoading(false)
    }
  }

  const statusTone = result.ok ? 'success' : 'error'

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#111827]">
      <header className="border-b border-[#e5e7eb] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#101828] text-white"><Network size={18} /></div>
            <div><p className="text-[15px] font-semibold tracking-[-0.02em]">Request Lab</p><p className="text-[11px] text-[#667085]">hellojs transport console</p></div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-[#d1fadf] bg-[#ecfdf3] px-3 py-1.5 text-xs font-medium text-[#027a48] sm:flex"><span className="size-1.5 rounded-full bg-[#12b76a]" /> Node.js runtime online</div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1180px] gap-6 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8 lg:py-12">
        <section>
          <div className="mb-8 max-w-2xl"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#667085]">HTTP request workspace</p><h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#101828] sm:text-[42px] sm:leading-[1.08]">Inspect a request.<br /><span className="text-[#667085]">See what comes back.</span></h1><p className="mt-4 max-w-xl text-[15px] leading-7 text-[#667085]">Send a request through the hellojs transport library and inspect status, protocol, headers, and response body in one place.</p></div>

          <form onSubmit={submit} className="rounded-2xl border border-[#e4e7ec] bg-white p-5 shadow-[0_12px_30px_rgba(16,24,40,0.04)] sm:p-6">
            <div className="mb-6 flex items-center justify-between"><div><h2 className="text-sm font-semibold text-[#101828]">Request configuration</h2><p className="mt-1 text-xs text-[#667085]">Choose how the server should make the request.</p></div><div className="rounded-lg bg-[#f2f4f7] px-2.5 py-1 text-[11px] font-medium text-[#475467]">POST /api/request</div></div>
            <label className="mb-2 block text-xs font-semibold text-[#344054]" htmlFor="url">Target URL</label>
            <div className="relative mb-5"><Globe2 className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#98a2b3]" size={17} /><input id="url" required type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com" className="h-12 w-full rounded-xl border border-[#d0d5dd] bg-white pl-11 pr-4 text-sm text-[#101828] outline-none transition placeholder:text-[#98a2b3] focus:border-[#667085] focus:ring-4 focus:ring-[#101828]/5" /></div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div><label className="mb-2 block text-xs font-semibold text-[#344054]" htmlFor="profile">Browser profile</label><div className="relative"><select id="profile" value={profile} onChange={(event) => setProfile(event.target.value)} className="h-12 w-full appearance-none rounded-xl border border-[#d0d5dd] bg-white px-4 pr-10 text-sm text-[#101828] outline-none focus:border-[#667085] focus:ring-4 focus:ring-[#101828]/5"><option value="chrome147-mac">Chrome 147 · macOS</option><option value="firefox147">Firefox 147 · macOS</option></select><ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#667085]" size={16} /></div></div>
              <div><span className="mb-2 block text-xs font-semibold text-[#344054]">Transport</span><button type="button" onClick={() => setHttp3((current) => !current)} aria-pressed={http3} className={`flex h-12 w-full items-center justify-between rounded-xl border px-4 text-left transition ${http3 ? 'border-[#344054] bg-[#f9fafb]' : 'border-[#d0d5dd] bg-white'}`}><span className="flex items-center gap-2.5 text-sm font-medium text-[#344054]"><span className={`flex size-5 items-center justify-center rounded-md border ${http3 ? 'border-[#101828] bg-[#101828] text-white' : 'border-[#d0d5dd] bg-white'}`}>{http3 && <Check size={13} strokeWidth={3} />}</span>Use HTTP/3</span><span className="text-[11px] font-medium text-[#667085]">{http3 ? 'QUIC enabled' : 'HTTP/2 default'}</span></button></div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-[#f2f4f7] pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-[#667085]">Requests run server-side through hellojs.</p><button disabled={loading} type="submit" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#101828] px-5 text-sm font-semibold text-white transition hover:bg-[#1d2939] disabled:cursor-wait disabled:opacity-70">{loading ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}{loading ? 'Sending request…' : 'Send request'}</button></div>
          </form>

          <div className="mt-6 grid gap-3 sm:grid-cols-3"><InfoCard icon={<ShieldCheck size={16} />} label="TLS validation" value="Enabled by default" /><InfoCard icon={<Clock3 size={16} />} label="Response timeout" value="60 seconds" /><InfoCard icon={<Terminal size={16} />} label="Response mode" value="Full response" /></div>
        </section>

        <aside className="lg:pt-[108px]"><div className="overflow-hidden rounded-2xl border border-[#e4e7ec] bg-white shadow-[0_12px_30px_rgba(16,24,40,0.04)]"><div className="flex items-center justify-between border-b border-[#f2f4f7] px-5 py-4"><div><h2 className="text-sm font-semibold text-[#101828]">Response</h2><p className="mt-1 text-xs text-[#667085]">Latest request result</p></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusTone === 'success' ? 'bg-[#ecfdf3] text-[#027a48]' : 'bg-[#fef3f2] text-[#b42318]'}`}>{result.ok ? 'Success' : 'Failed'}</span></div><div className="p-5">{result.status !== undefined && <div className="mb-5 flex items-end justify-between"><div><p className="text-3xl font-semibold tracking-[-0.04em] text-[#101828]">{result.status}</p><p className="mt-1 text-xs text-[#667085]">{result.statusText || 'HTTP response'}</p></div><div className="text-right text-xs text-[#667085]"><p>{result.protocol || '—'}</p><p className="mt-1">{result.durationMs ?? 0} ms</p></div></div>}{result.error ? <div className="rounded-xl bg-[#fef3f2] p-3 text-xs leading-5 text-[#b42318]">{result.error}</div> : <pre className="max-h-[360px] overflow-auto rounded-xl bg-[#101828] p-4 text-[11px] leading-5 text-[#d0d5dd]"><code>{JSON.stringify(result.body, null, 2)}</code></pre>}</div></div><div className="mt-4 rounded-xl border border-dashed border-[#d0d5dd] px-4 py-3 text-xs leading-5 text-[#667085]">HTTP/3 is opportunistic. If QUIC is unavailable, hellojs falls back to TCP + TLS.</div></aside>
      </div>
    </main>
  )
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="flex items-center gap-3 rounded-xl border border-[#eaecf0] bg-white px-4 py-3"><span className="text-[#667085]">{icon}</span><div><p className="text-[11px] text-[#98a2b3]">{label}</p><p className="mt-0.5 text-xs font-medium text-[#344054]">{value}</p></div></div> }
