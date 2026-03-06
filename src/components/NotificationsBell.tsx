"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { createSupabaseBrowser } from "@/lib/supabase/browser"

type NotificationRow = {
  id: string
  title: string
  body: string | null
  href: string | null
  is_read: boolean
  created_at: string
  type: string
}

function timeAgo(iso: string) {
  const d = new Date(iso).getTime()
  const s = Math.max(1, Math.floor((Date.now() - d) / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const days = Math.floor(h / 24)
  return `${days}d`
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
      <path d="M9 17a3 3 0 0 0 6 0" />
    </svg>
  )
}

export default function NotificationsBell() {
  const supabase = useMemo(() => createSupabaseBrowser(), [])
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationRow[]>([])
  const unread = items.filter((n) => !n.is_read).length

  const load = async () => {
    const { data, error } = await supabase
      .from("notifications")
      .select("id,title,body,href,is_read,created_at,type")
      .order("created_at", { ascending: false })
      .limit(15)

    if (!error) setItems((data ?? []) as any)
  }

  useEffect(() => {
    load()
    // lightweight polling (simple + reliable)
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const markAllRead = async () => {
    const ids = items.filter((n) => !n.is_read).map((n) => n.id)
    if (ids.length === 0) return
    await supabase.from("notifications").update({ is_read: true }).in("id", ids)
    await load()
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 transition"
        aria-label="Notifications"
      >
        <BellIcon />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 text-[10px] leading-none rounded-full bg-red-500 px-1.5 py-1">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[360px] max-w-[90vw] rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="font-semibold">Notifications</div>
            <div className="flex gap-2">
              <button
                type="button"
                className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10"
                onClick={markAllRead}
              >
                Mark all read
              </button>
              <button
                type="button"
                className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
          </div>

          <div className="max-h-[420px] overflow-auto">
            {items.length === 0 && (
              <div className="px-4 py-6 text-sm text-white/60">No notifications yet.</div>
            )}

            {items.map((n) => {
              const row = (
                <div
                  key={n.id}
                  className={
                    "px-4 py-3 border-b border-white/5 hover:bg-white/5 transition " +
                    (n.is_read ? "opacity-70" : "")
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{n.title}</div>
                      {n.body && <div className="text-sm text-white/60 mt-1">{n.body}</div>}
                      <div className="text-xs text-white/50 mt-2">{timeAgo(n.created_at)} ago</div>
                    </div>

                    {!n.is_read && <div className="h-2 w-2 rounded-full bg-blue-500 mt-2" />}
                  </div>
                </div>
              )

              return n.href ? (
                <Link
                  key={n.id}
                  href={n.href}
                  onClick={async () => {
                    setOpen(false)
                    await supabase.from("notifications").update({ is_read: true }).eq("id", n.id)
                  }}
                >
                  {row}
                </Link>
              ) : (
                <button
                  key={n.id}
                  type="button"
                  className="text-left w-full"
                  onClick={async () => {
                    await supabase.from("notifications").update({ is_read: true }).eq("id", n.id)
                    await load()
                  }}
                >
                  {row}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}