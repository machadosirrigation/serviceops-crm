"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { createSupabaseBrowser } from "@/lib/supabase/browser"

type TimeEntry = {
  id: string
  clock_in_at: string
  clock_out_at: string | null
  note: string | null
}

function fmtHrs(ms: number) {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

export default function TimeClockCard() {
  const supabase = useMemo(() => createSupabaseBrowser(), [])
  const [msg, setMsg] = useState<string | null>(null)
  const [running, setRunning] = useState<TimeEntry | null>(null)
  const [note, setNote] = useState("")
  const [tick, setTick] = useState(0) // re-render for live timer

  const load = async () => {
    setMsg(null)
    const { data, error } = await supabase
      .from("time_entries")
      .select("id,clock_in_at,clock_out_at,note")
      .is("clock_out_at", null)
      .order("clock_in_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) setMsg(error.message)
    setRunning((data as any) ?? null)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setTick((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [running])

  const clockIn = async () => {
    setMsg(null)

    // company-mode: your DB likely sets company_id/user_id via trigger or you insert them.
    // If your table requires company_id/user_id explicitly, tell me and I’ll match your exact schema.
    const { error } = await supabase.from("time_entries").insert([
      {
        clock_in_at: new Date().toISOString(),
        note: note || null,
      },
    ])

    if (error) {
      setMsg(error.message)
      return
    }
    setNote("")
    await load()
  }

  const clockOut = async () => {
    if (!running) return
    setMsg(null)

    const { error } = await supabase
      .from("time_entries")
      .update({ clock_out_at: new Date().toISOString() })
      .eq("id", running.id)

    if (error) {
      setMsg(error.message)
      return
    }
    await load()
  }

  const elapsedMs = running ? Date.now() - new Date(running.clock_in_at).getTime() : 0

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">Clock</div>
          <div className="text-sm text-white/60">Track work hours (clock in/out).</div>
        </div>
        <span
          className={
            "text-xs px-2 py-1 rounded-full border " +
            (running
              ? "bg-emerald-500/10 border-emerald-400/20 text-emerald-200"
              : "bg-white/5 border-white/10 text-white/70")
          }
        >
          {running ? "Clocked In" : "Clocked Out"}
        </span>
      </div>

      {running && (
        <div className="mt-4 text-3xl font-bold tracking-tight">{fmtHrs(elapsedMs)}</div>
      )}

      {!running && (
        <input
          className="mt-4 w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 outline-none focus:border-white/20"
          placeholder="Optional note (job, location, etc.)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      )}

      {msg && (
        <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {msg}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          className={"rounded-xl px-4 py-3 font-medium transition " + (running ? "bg-white/5 text-white/40 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-500")}
          onClick={clockIn}
          disabled={!!running}
          type="button"
        >
          Clock In
        </button>

        <button
          className={"rounded-xl px-4 py-3 font-medium transition " + (!running ? "bg-white/5 text-white/40 cursor-not-allowed" : "bg-amber-600 hover:bg-amber-500")}
          onClick={clockOut}
          disabled={!running}
          type="button"
        >
          Clock Out
        </button>
      </div>

      <div className="mt-3">
        <Link className="text-sm text-white/70 underline hover:text-white" href="/timesheet">
          View timesheet →
        </Link>
      </div>
    </div>
  )
}