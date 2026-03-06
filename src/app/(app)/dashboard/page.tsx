"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { createBrowserClient } from "@supabase/ssr"

type JobStatus = "Scheduled" | "In Progress" | "Done" | "Canceled"

type Job = {
  id: string
  title: string
  status: JobStatus
  scheduled_for: string | null
  price: number | null
  client_id: string
  client?: { name: string } | null
}

type InvoiceTotalRow = {
  invoice_id: string
  paid_total: number | null
  balance_due: number | null
}

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
  const x = new Date(d)
  const day = x.getDay()
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

function money(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n || 0)
}

function hoursBetween(aISO: string, bISO: string) {
  const a = new Date(aISO).getTime()
  const b = new Date(bISO).getTime()
  const diff = Math.max(0, b - a)
  return diff / (1000 * 60 * 60)
}

export default function DashboardPage() {
  const supabase = useMemo(() => {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }, [])

  const [email, setEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const [todayJobs, setTodayJobs] = useState<Job[]>([])
  const [upcomingJobs, setUpcomingJobs] = useState<Job[]>([])
  const [openJobsCount, setOpenJobsCount] = useState<number>(0)

  const [revenueToday, setRevenueToday] = useState<number>(0)

  const [unpaidCount, setUnpaidCount] = useState<number>(0)
  const [unpaidBalance, setUnpaidBalance] = useState<number>(0)

  const [newLeadsCount, setNewLeadsCount] = useState<number>(0)

  const [clockNote, setClockNote] = useState("")
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null)

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()))
  const [weekTotalHours, setWeekTotalHours] = useState<number>(0)
  const [weekByDay, setWeekByDay] = useState<Record<string, number>>({})

  const todayISO = isoDate(new Date())
  const weekEnd = addDays(weekStart, 7)

  const loadCompanyAndUser = async () => {
    const { data: auth } = await supabase.auth.getUser()
    const u = auth.user

    if (!u) {
      setMsg("Not logged in.")
      return { user_id: null as string | null, company_id: null as string | null }
    }

    setEmail(u.email ?? null)
    setUserId(u.id)

    const { data: cm, error: cmErr } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", u.id)
      .limit(1)
      .maybeSingle()

    if (cmErr) {
      setMsg(cmErr.message)
      return { user_id: u.id, company_id: null }
    }

    const cid = (cm as any)?.company_id ?? null
    setCompanyId(cid)
    return { user_id: u.id, company_id: cid }
  }

  const loadClockState = async (cid: string, uid: string) => {
    const { data, error } = await supabase
      .from("time_entries")
      .select("id,clock_in_at,clock_out_at,note")
      .eq("company_id", cid)
      .eq("user_id", uid)
      .is("clock_out_at", null)
      .order("clock_in_at", { ascending: false })
      .limit(1)

    if (error) {
      setMsg(error.message)
      setActiveEntry(null)
      return
    }

    setActiveEntry((data?.[0] as any) ?? null)
  }

  const loadDashboard = async () => {
    setLoading(true)
    setMsg(null)

    const ids = await loadCompanyAndUser()
    if (!ids.user_id || !ids.company_id) {
      setLoading(false)
      return
    }

    const cid = ids.company_id
    const uid = ids.user_id

    const jobsTodayQ = supabase
      .from("jobs")
      .select("id,title,status,scheduled_for,price,client_id,client:clients(name)")
      .eq("company_id", cid)
      .eq("scheduled_for", todayISO)
      .order("created_at", { ascending: false })

    const openJobsCountQ = supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("company_id", cid)
      .neq("status", "Done")
      .neq("status", "Canceled")

    const upcomingQ = supabase
      .from("jobs")
      .select("id,title,status,scheduled_for,price,client_id,client:clients(name)")
      .eq("company_id", cid)
      .gte("scheduled_for", todayISO)
      .lte("scheduled_for", isoDate(addDays(new Date(), 6)))
      .order("scheduled_for", { ascending: true })

    const invoiceTotalsQ = supabase
      .from("invoice_totals")
      .select("invoice_id,paid_total,balance_due")
      .eq("company_id", cid)

    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString()

    const leadsQ = supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("org_id", cid)
      .gte("created_at", sevenDaysAgo)

    const weekStartISO = weekStart.toISOString()
    const weekEndISO = weekEnd.toISOString()

    const timeQ = supabase
      .from("time_entries")
      .select("id,clock_in_at,clock_out_at,note")
      .eq("company_id", cid)
      .eq("user_id", uid)
      .gte("clock_in_at", weekStartISO)
      .lt("clock_in_at", weekEndISO)
      .order("clock_in_at", { ascending: true })

    const [
      jobsTodayRes,
      openJobsRes,
      upcomingRes,
      totalsRes,
      leadsRes,
      timeRes,
    ] = await Promise.all([
      jobsTodayQ,
      openJobsCountQ,
      upcomingQ,
      invoiceTotalsQ,
      leadsQ,
      timeQ,
    ])

    if (jobsTodayRes.error) setMsg(jobsTodayRes.error.message)
    if (openJobsRes.error) setMsg(openJobsRes.error.message)
    if (upcomingRes.error) setMsg(upcomingRes.error.message)
    if (totalsRes.error) setMsg(totalsRes.error.message)
    if (timeRes.error) setMsg(timeRes.error.message)

    const tj = ((jobsTodayRes.data ?? []) as any) as Job[]
    setTodayJobs(tj)

    setOpenJobsCount(openJobsRes.count ?? 0)

    const up = ((upcomingRes.data ?? []) as any) as Job[]
    setUpcomingJobs(up)

    const rev = tj
      .filter((j) => j.status !== "Canceled")
      .reduce((s, j) => s + Number(j.price ?? 0), 0)
    setRevenueToday(rev)

    const totals = ((totalsRes.data ?? []) as any) as InvoiceTotalRow[]
    const unpaid = totals.filter((t) => Number(t.balance_due ?? 0) > 0)
    setUnpaidCount(unpaid.length)
    setUnpaidBalance(
      unpaid.reduce((s, t) => s + Number(t.balance_due ?? 0), 0)
    )

    setNewLeadsCount(leadsRes.count ?? 0)

    const entries = ((timeRes.data ?? []) as any) as TimeEntry[]
    const byDay: Record<string, number> = {}
    let totalH = 0

    for (const e of entries) {
      const day = isoDate(new Date(e.clock_in_at))
      const out = e.clock_out_at ?? new Date().toISOString()
      const h = hoursBetween(e.clock_in_at, out)
      byDay[day] = (byDay[day] ?? 0) + h
      totalH += h
    }

    setWeekByDay(byDay)
    setWeekTotalHours(totalH)

    await loadClockState(cid, uid)

    setLoading(false)
  }

  useEffect(() => {
    loadDashboard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart])

  const clockIn = async () => {
    setMsg(null)

    if (!companyId || !userId) {
      setMsg("No company/user found.")
      return
    }

    if (activeEntry) {
      setMsg("You are already clocked in.")
      return
    }

    const { error } = await supabase.from("time_entries").insert([
      {
        company_id: companyId,
        user_id: userId,
        clock_in_at: new Date().toISOString(),
        clock_out_at: null,
        note: clockNote || null,
      },
    ])

    if (error) {
      setMsg(error.message)
      return
    }

    setClockNote("")
    await loadDashboard()
  }

  const clockOut = async () => {
    setMsg(null)

    if (!companyId || !userId) {
      setMsg("No company/user found.")
      return
    }

    if (!activeEntry) {
      setMsg("You are not clocked in.")
      return
    }

    const { error } = await supabase
      .from("time_entries")
      .update({ clock_out_at: new Date().toISOString() })
      .eq("id", activeEntry.id)

    if (error) {
      setMsg(error.message)
      return
    }

    await loadDashboard()
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekLabel = `Week of ${isoDate(weekStart)}`

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-white/60 text-sm">{email ?? ""}</p>
        </div>
      </div>

      {msg && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {msg}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-5">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Clock</div>
            <span
              className={
                "text-xs px-2 py-1 rounded-full border " +
                (activeEntry
                  ? "bg-emerald-500/10 border-emerald-400/20 text-emerald-200"
                  : "bg-white/5 border-white/10 text-white/70")
              }
            >
              {activeEntry ? "Clocked In" : "Clocked Out"}
            </span>
          </div>

          {activeEntry ? (
            <div className="text-sm text-white/60 mt-2">
              Started:{" "}
              <span className="text-white/80">
                {new Date(activeEntry.clock_in_at).toLocaleString()}
              </span>
            </div>
          ) : (
            <div className="text-sm text-white/60 mt-2">
              Track work hours (clock in/out).
            </div>
          )}

          <input
            className="mt-3 w-full p-3 rounded-xl bg-zinc-950 border border-white/10 outline-none focus:border-white/20"
            placeholder="Optional note (job, location, etc.)"
            value={clockNote}
            onChange={(e) => setClockNote(e.target.value)}
          />

          <div className="mt-3 flex gap-2">
            <button
              onClick={clockIn}
              type="button"
              className="flex-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 transition disabled:opacity-60"
              disabled={loading || !!activeEntry}
            >
              Clock In
            </button>
            <button
              onClick={clockOut}
              type="button"
              className="flex-1 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 transition disabled:opacity-60"
              disabled={loading || !activeEntry}
            >
              Clock Out
            </button>
          </div>

          <div className="mt-3">
            <Link
              className="text-sm text-white/70 hover:text-white underline"
              href="/timesheet"
            >
              View timesheet →
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-5">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Today’s Schedule</div>
            <div className="text-sm text-white/60">{todayISO}</div>
          </div>

          <div className="mt-3 space-y-2">
            {todayJobs.slice(0, 4).map((j) => (
              <div key={j.id} className="rounded-xl bg-white/5 border border-white/10 p-3">
                <div className="font-medium text-sm">{j.title}</div>
                <div className="text-xs text-white/60">
                  {j.client?.name ?? ""} • {j.status}
                  {j.price != null ? ` • ${money(j.price)}` : ""}
                </div>
              </div>
            ))}
            {todayJobs.length === 0 && (
              <div className="text-sm text-white/60">No jobs scheduled for today.</div>
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <Link
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 transition text-sm"
              href="/jobs"
            >
              Schedule job →
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-5">
          <div className="font-semibold">Revenue Today</div>
          <div className="text-4xl font-bold mt-2">{money(revenueToday)}</div>
          <div className="text-sm text-white/60 mt-2">
            Sum of today’s jobs (excluding canceled).
          </div>

          <div className="mt-4 grid gap-2">
            <div className="rounded-xl bg-white/5 border border-white/10 p-3">
              <div className="text-sm text-white/60">Jobs Today</div>
              <div className="text-2xl font-bold">{todayJobs.length}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-5">
          <div className="text-sm text-white/60">Open Jobs</div>
          <div className="text-3xl font-bold mt-1">{openJobsCount}</div>
          <div className="mt-3">
            <Link className="text-sm text-white/70 hover:text-white underline" href="/jobs">
              View jobs →
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-5">
          <div className="text-sm text-white/60">Unpaid Invoices</div>
          <div className="text-3xl font-bold mt-1">{unpaidCount}</div>
          <div className="text-sm text-white/60 mt-2">
            Balance due: <span className="text-white/85 font-semibold">{money(unpaidBalance)}</span>
          </div>
          <div className="mt-3">
            <Link className="text-sm text-white/70 hover:text-white underline" href="/invoices">
              View invoices →
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-5">
          <div className="text-sm text-white/60">New Leads</div>
          <div className="text-3xl font-bold mt-1">{newLeadsCount}</div>
          <div className="text-sm text-white/60 mt-2">
            (Leads created in the last 7 days.)
          </div>
          <div className="mt-3">
            <Link className="text-sm text-white/70 hover:text-white underline" href="/leads">
              View leads →
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-5">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Calendar (Next 7 days)</div>
            <Link className="text-sm text-white/70 hover:text-white underline" href="/jobs">
              Full schedule →
            </Link>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {Array.from({ length: 7 }, (_, i) => {
              const d = isoDate(addDays(new Date(), i))
              const items = upcomingJobs.filter((j) => j.scheduled_for === d)
              return (
                <div key={d} className="rounded-xl bg-white/5 border border-white/10 p-4">
                  <div className="text-sm text-white/70">{d}</div>
                  <div className="mt-2 space-y-2">
                    {items.slice(0, 3).map((j) => (
                      <div key={j.id} className="rounded-lg bg-black/20 border border-white/10 p-2">
                        <div className="text-sm font-medium">{j.title}</div>
                        <div className="text-xs text-white/60">
                          {j.client?.name ?? ""} • {j.status}
                        </div>
                      </div>
                    ))}
                    {items.length === 0 && (
                      <div className="text-xs text-white/50">No jobs</div>
                    )}
                    {items.length > 3 && (
                      <div className="text-xs text-white/50">+{items.length - 3} more</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Weekly Hours</div>
              <div className="text-sm text-white/60">{weekLabel}</div>
            </div>

            <div className="flex gap-2">
              <button
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 transition text-sm"
                onClick={() => setWeekStart(startOfWeek(addDays(weekStart, -7)))}
                type="button"
              >
                ← Prev
              </button>
              <button
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 transition text-sm"
                onClick={() => setWeekStart(startOfWeek(new Date()))}
                type="button"
              >
                This Week
              </button>
              <button
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 transition text-sm"
                onClick={() => setWeekStart(startOfWeek(addDays(weekStart, 7)))}
                type="button"
              >
                Next →
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-white/5 border border-white/10 p-4">
            <div className="text-sm text-white/60">Week Total</div>
            <div className="text-3xl font-bold mt-1">{weekTotalHours.toFixed(2)} hrs</div>
          </div>

          <div className="mt-4 space-y-2">
            {weekDays.map((d) => {
              const key = isoDate(d)
              const h = weekByDay[key] ?? 0
              return (
                <div key={key} className="rounded-xl bg-white/5 border border-white/10 p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{key}</div>
                    <div className="text-xs text-white/60">Daily total</div>
                  </div>
                  <div className="text-sm text-white/80">{h.toFixed(2)} hrs</div>
                </div>
              )
            })}
          </div>

          <div className="mt-4">
            <Link className="text-sm text-white/70 hover:text-white underline" href="/timesheet">
              Open timesheet →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}