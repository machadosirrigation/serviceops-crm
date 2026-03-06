"use client"

import { useEffect, useMemo, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"

type TimeEntry = {
  id: string
  clock_in_at: string
  clock_out_at: string | null
  note: string | null
}

function hoursSince(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(0, ms / 1000 / 60 / 60)
}

export default function TimeClockCard() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  )

  const [active, setActive] = useState<TimeEntry | null>(null)
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const loadActive = async () => {
    setMsg(null)
    const { data: auth } = await supabase.auth.getUser()
    const userId = auth.user?.id
    if (!userId) return

    const { data, error } = await supabase
      .from("time_entries")
      .select("id,clock_in_at,clock_out_at,note")
      .eq("user_id", userId)
      .is("clock_out_at", null)
      .order("clock_in_at", { ascending: false })
      .limit(1)

    if (error) setMsg(error.message)
    setActive((data?.[0] as any) ?? null)
  }

  useEffect(() => {
    loadActive()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const clockIn = async () => {
    setLoading(true)
    setMsg(null)

    const { data: auth } = await supabase.auth.getUser()
    const userId = auth.user?.id
    if (!userId) {
      setMsg("Not logged in.")
      setLoading(false)
      return
    }

    // prevent double clock-in
    if (active) {
      setMsg("You are already clocked in.")
      setLoading(false)
      return
    }

    const { error } = await supabase.from("time_entries").insert([
      {
        user_id: userId,
        note: note.trim() || null,
      },
    ])

    if (error) setMsg(error.message)
    setNote("")
    await loadActive()
    setLoading(false)
  }

  const clockOut = async () => {
    if (!active) return
    setLoading(true)
    setMsg(null)

    const { error } = await supabase
      .from("time_entries")
      .update({ clock_out_at: new Date().toISOString() })
      .eq("id", active.id)

    if (error) setMsg(error.message)
    await loadActive()
    setLoading(false)
  }

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-white/60">Time Clock</div>
          <div className="text-xl font-bold mt-1">
            {active ? "Clocked In" : "Clocked Out"}
          </div>
          {active ? (
            <div className="text-sm text-white/60 mt-1">
              Started {new Date(active.clock_in_at).toLocaleTimeString()} • {hoursSince(active.clock_in_at).toFixed(2)} hrs
            </div>
          ) : (
            <div className="text-sm text-white/60 mt-1">Clock in to start tracking time.</div>
          )}
        </div>
      </div>

      {!active && (
        <input
          className="mt-4 w-full p-3 rounded-xl bg-zinc-900 border border-white/10"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note (route, job, etc.)"
        />
      )}

      {msg && <div className="text-sm text-red-200 mt-3">{msg}</div>}

      <div className="mt-4 flex gap-2">
        {!active ? (
          <button
            disabled={loading}
            onClick={clockIn}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60"
            type="button"
          >
            {loading ? "Saving…" : "Clock In"}
          </button>
        ) : (
          <button
            disabled={loading}
            onClick={clockOut}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-60"
            type="button"
          >
            {loading ? "Saving…" : "Clock Out"}
          </button>
        )}
      </div>
    </div>
  )
}