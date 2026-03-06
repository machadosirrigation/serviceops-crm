"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { createBrowserClient } from "@supabase/ssr"

type TimeEntry = {
  id: string
  clock_in_at: string
  clock_out_at: string | null
  note: string | null
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function startOfWeek(d: Date) {
  // Monday start
  const x = new Date(d)
  const day = x.getDay() // 0 Sun..6 Sat
  const diff = (day === 0 ? -6 : 1) - day
  x.setDate(x.getDate() + diff)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function hoursBetween(aISO: string, bISO: string) {
  const a = new Date(aISO).getTime()
  const b = new Date(bISO).getTime()
  const diff = Math.max(0, b - a)
  return diff / 1000 / 60 / 60
}

export default function TimesheetPage() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  )

  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()))
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [openEntry, setOpenEntry] = useState<TimeEntry | null>(null)

  const [note, setNote] = useState("")

  // --- helpers -------------------------------------------------------------

  const getUserAndCompany = async () => {
    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (authErr) throw new Error(authErr.message)
    const user = authData.user
    if (!user) throw new Error("Not logged in.")

    // IMPORTANT: do NOT use maybeSingle() here.
    // If duplicates exist, maybeSingle throws.
    const { data: rows, error: mErr } = await supabase
      .from("company_members")
      .select("company_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }) // pick newest membership
      .limit(1)

    if (mErr) throw new Error(mErr.message)

    const companyId = (rows?.[0] as any)?.company_id ?? null
    if (!companyId) throw new Error("No company found for this user (company_members missing).")

    return { userId: user.id, companyId }
  }

  const loadOpenEntry = async (companyId: string, userId: string) => {
    // Active entry = latest row where clock_out_at IS NULL (no week filter)
    const { data, error } = await supabase
      .from("time_entries")
      .select("id,clock_in_at,clock_out_at,note")
      .eq("company_id", companyId)
      .eq("user_id", userId)
      .is("clock_out_at", null)
      .order("clock_in_at", { ascending: false })
      .limit(1)

    if (error) throw new Error(error.message)
    setOpenEntry(((data?.[0] as any) ?? null) as any)
  }

  // --- main load -----------------------------------------------------------

  const load = async () => {
    setMsg(null)
    setLoading(true)

    try {
      const { userId, companyId } = await getUserAndCompany()

      const start = new Date(weekStart)
      const end = addDays(start, 7)

      // Load week entries
      const { data, error } = await supabase
        .from("time_entries")
        .select("id,clock_in_at,clock_out_at,note")
        .eq("company_id", companyId)
        .eq("user_id", userId)
        .gte("clock_in_at", start.toISOString())
        .lt("clock_in_at", end.toISOString())
        .order("clock_in_at", { ascending: true })

      if (error) throw new Error(error.message)

      setEntries((data ?? []) as TimeEntry[])

      // Load active entry separately (so clock works even if open shift started outside the week)
      await loadOpenEntry(companyId, userId)
    } catch (e: any) {
      setMsg(e?.message ?? "Something went wrong.")
      setEntries([])
      setOpenEntry(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart])

  // --- actions -------------------------------------------------------------

  const clockIn = async () => {
    setMsg(null)
    setLoading(true)

    try {
      const { userId, companyId } = await getUserAndCompany()

      // Refresh open entry before inserting (avoid double-open)
      await loadOpenEntry(companyId, userId)
      if (openEntry) {
        throw new Error("You are already clocked in.")
      }

      const { error } = await supabase.from("time_entries").insert([
        {
          company_id: companyId,
          user_id: userId,
          clock_in_at: new Date().toISOString(),
          clock_out_at: null,
          note: note || null,
        },
      ])

      if (error) throw new Error(error.message)

      setNote("")
      await load()
    } catch (e: any) {
      setMsg(e?.message ?? "Clock in failed.")
    } finally {
      setLoading(false)
    }
  }

  const clockOut = async () => {
    if (!openEntry) return
    setMsg(null)
    setLoading(true)

    try {
      const { error } = await supabase
        .from("time_entries")
        .update({ clock_out_at: new Date().toISOString() })
        .eq("id", openEntry.id)

      if (error) throw new Error(error.message)

      await load()
    } catch (e: any) {
      setMsg(e?.message ?? "Clock out failed.")
    } finally {
      setLoading(false)
    }
  }

  // --- render helpers ------------------------------------------------------

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const byDay = (dayISO: string) =>
    entries.filter((e) => isoDate(new Date(e.clock_in_at)) === dayISO)

  // Week total (include open entry time ONLY if it started this week)
  const weekTotal = entries.reduce((sum, e) => {
    const out = e.clock_out_at ?? new Date().toISOString()
    return sum + hoursBetween(e.clock_in_at, out)
  }, 0)

  // --- UI ------------------------------------------------------------------

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Timesheet</h1>
          <p className="text-white/60 text-sm">Your weekly hours (clock in/out).</p>
        </div>
        <Link
          className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition"
          href="/dashboard"
        >
          Back
        </Link>
      </div>

      {msg && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {msg}
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="text-sm text-white/70">Week of {isoDate(weekStart)}</div>
        <div className="flex gap-2">
          <button
            className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition"
            onClick={() => setWeekStart(startOfWeek(addDays(weekStart, -7)))}
            type="button"
          >
            ← Prev
          </button>
          <button
            className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition"
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            type="button"
          >
            This Week
          </button>
          <button
            className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition"
            onClick={() => setWeekStart(startOfWeek(addDays(weekStart, 7)))}
            type="button"
          >
            Next →
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-5">
          <div className="text-sm text-white/60">Week Total</div>
          <div className="text-3xl font-bold mt-1">{weekTotal.toFixed(2)} hrs</div>
        </div>

        <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Clock</div>
            <span
              className={
                "text-xs px-2 py-1 rounded-full border " +
                (openEntry
                  ? "bg-emerald-500/10 border-emerald-400/20 text-emerald-200"
                  : "bg-white/5 border-white/10 text-white/70")
              }
            >
              {openEntry ? "Clocked In" : "Clocked Out"}
            </span>
          </div>

          <input
            className="w-full p-3 rounded-xl bg-zinc-900 border border-white/10 outline-none focus:border-white/20"
            placeholder="Optional note (job, location, etc.)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={!!openEntry}
          />

          <div className="flex gap-2">
            <button
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 transition"
              onClick={clockIn}
              disabled={loading || !!openEntry}
              type="button"
            >
              {openEntry ? "Clocked In" : "Clock In"}
            </button>

            <button
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-60 transition"
              onClick={clockOut}
              disabled={loading || !openEntry}
              type="button"
            >
              Clock Out
            </button>
          </div>

          {openEntry && (
            <div className="text-sm text-white/60">
              Current shift started:{" "}
              <span className="text-white">
                {new Date(openEntry.clock_in_at).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-4 space-y-3">
        {weekDays.map((d) => {
          const dayISO = isoDate(d)
          const dayEntries = byDay(dayISO)

          const dayTotal = dayEntries.reduce((sum, e) => {
            const out = e.clock_out_at ?? new Date().toISOString()
            return sum + hoursBetween(e.clock_in_at, out)
          }, 0)

          return (
            <div key={dayISO} className="rounded-xl bg-white/5 border border-white/10 p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{dayISO}</div>
                <div className="text-sm text-white/60">{dayTotal.toFixed(2)} hrs</div>
              </div>

              <div className="mt-3 space-y-2">
                {dayEntries.map((e) => (
                  <div key={e.id} className="rounded-lg bg-black/20 border border-white/10 p-3">
                    <div className="text-sm text-white/80">
                      In: {new Date(e.clock_in_at).toLocaleTimeString()}{" "}
                      {e.clock_out_at
                        ? `• Out: ${new Date(e.clock_out_at).toLocaleTimeString()}`
                        : "• (Open)"}
                    </div>
                    {e.note && <div className="text-sm text-white/60 mt-1">{e.note}</div>}
                  </div>
                ))}

                {dayEntries.length === 0 && (
                  <div className="text-sm text-white/50">No entries.</div>
                )}
              </div>
            </div>
          )
        })}

        {loading && <div className="text-sm text-white/60 p-2">Loading…</div>}
      </div>
    </div>
  )
}