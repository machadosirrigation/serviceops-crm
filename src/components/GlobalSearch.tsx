"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"

type ClientHit = { id: string; name: string; phone?: string | null; email?: string | null }
type JobHit = { id: string; title: string; status?: string | null; scheduled_for?: string | null; client?: { name: string } | null }

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-white/60" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  )
}

export default function GlobalSearch() {
  const [q, setQ] = useState("")
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [clients, setClients] = useState<ClientHit[]>([])
  const [jobs, setJobs] = useState<JobHit[]>([])
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener("mousedown", onDown)
    return () => window.removeEventListener("mousedown", onDown)
  }, [])

  useEffect(() => {
    const t = setTimeout(async () => {
      const term = q.trim()
      if (!term) {
        setClients([])
        setJobs([])
        setLoading(false)
        return
      }

      setLoading(true)
      setOpen(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`)
        const json = await res.json()
        setClients(json.clients ?? [])
        setJobs(json.jobs ?? [])
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => clearTimeout(t)
  }, [q])

  return (
    <div ref={wrapRef} className="relative w-full max-w-[520px]">
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
        <SearchIcon />
        <input
          className="w-full bg-transparent outline-none text-sm placeholder:text-white/40"
          placeholder="Search clients, jobs…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => q.trim() && setOpen(true)}
        />
      </div>

      {open && (q.trim() || loading) && (
        <div className="absolute left-0 right-0 mt-2 rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-2 text-xs text-white/60 border-b border-white/10">
            {loading ? "Searching…" : "Results"}
          </div>

          {!loading && clients.length === 0 && jobs.length === 0 && (
            <div className="px-4 py-6 text-sm text-white/60">No matches.</div>
          )}

          {clients.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-1 text-xs text-white/50">Clients</div>
              {clients.map((c) => (
                <Link
                  key={c.id}
                  href={`/clients?focus=${c.id}`}
                  className="block px-4 py-2 hover:bg-white/5"
                  onClick={() => setOpen(false)}
                >
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-white/60">
                    {c.phone ?? ""}{c.phone && c.email ? " • " : ""}{c.email ?? ""}
                  </div>
                </Link>
              ))}
            </div>
          )}

          {jobs.length > 0 && (
            <div className="py-2 border-t border-white/10">
              <div className="px-4 py-1 text-xs text-white/50">Jobs</div>
              {jobs.map((j) => (
                <Link
                  key={j.id}
                  href={`/jobs?focus=${j.id}`}
                  className="block px-4 py-2 hover:bg-white/5"
                  onClick={() => setOpen(false)}
                >
                  <div className="font-medium">{j.title}</div>
                  <div className="text-xs text-white/60">
                    {j.client?.name ? `${j.client.name} • ` : ""}{j.status ?? ""}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}