"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { createBrowserClient } from "@supabase/ssr"
import CreateInvoiceButton from "./CreateInvoiceButton"

type Client = { id: string; name: string }
type JobStatus = "Scheduled" | "In Progress" | "Done" | "Canceled"
type Job = {
  id: string
  title: string
  status: JobStatus
  scheduled_for: string | null // YYYY-MM-DD
  price: number | null
  client_id: string
  client?: { name: string } | null
  details: string | null
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function startOfWeek(d: Date) {
  // Monday start
  const date = new Date(d)
  const day = date.getDay() // 0 Sun .. 6 Sat
  const diff = (day === 0 ? -6 : 1) - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export default function JobsPage() {
  const supabase = useMemo(() => {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }, [])

  const [view, setView] = useState<"list" | "calendar">("calendar")

  const [clients, setClients] = useState<Client[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  // filters
  const [q, setQ] = useState("")
  const [statusFilter, setStatusFilter] = useState<JobStatus | "All">("All")
  const [clientFilter, setClientFilter] = useState<string>("All")
  const [fromDate, setFromDate] = useState<string>("")
  const [toDate, setToDate] = useState<string>("")

  // add job form state
  const [clientId, setClientId] = useState("")
  const [title, setTitle] = useState("")
  const [status, setStatus] = useState<JobStatus>("Scheduled")
  const [scheduledFor, setScheduledFor] = useState<string>(toISODate(new Date()))
  const [price, setPrice] = useState<string>("")
  const [details, setDetails] = useState<string>("")

  // calendar state
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()))

  const load = async () => {
    // clients for dropdown
    const { data: clientsData, error: cErr } = await supabase
      .from("clients")
      .select("id,name")
      .order("name", { ascending: true })

    if (cErr) setMsg(cErr.message)
    setClients((clientsData ?? []) as any)

    // jobs list
    const { data: jobsData, error: jErr } = await supabase
      .from("jobs")
      .select("id,title,status,scheduled_for,price,client_id,details,client:clients(name)")
      .order("scheduled_for", { ascending: true })
      .order("created_at", { ascending: false })

    if (jErr) setMsg(jErr.message)
    setJobs((jobsData ?? []) as any)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addJob = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMsg(null)

    const { data: auth } = await supabase.auth.getUser()
    const user_id = auth.user?.id
    if (!user_id) {
      setMsg("Not logged in.")
      setLoading(false)
      return
    }

    if (!clientId) {
      setMsg("Select a client first.")
      setLoading(false)
      return
    }

    const { error } = await supabase.from("jobs").insert([
      {
        user_id,
        client_id: clientId,
        title,
        status,
        scheduled_for: scheduledFor || null,
        price: price ? Number(price) : null,
        details: details || null,
      },
    ])

    if (error) {
      setMsg(error.message)
      setLoading(false)
      return
    }

    setTitle("")
    setStatus("Scheduled")
    setPrice("")
    setDetails("")
    setMsg("Job added ✅")
    await load()
    setLoading(false)
  }

  const updateJobStatus = async (jobId: string, newStatus: JobStatus) => {
    setMsg(null)
    const { error } = await supabase.from("jobs").update({ status: newStatus }).eq("id", jobId)
    if (error) {
      setMsg(error.message)
      return
    }
    await load()
  }

  const filteredJobs = jobs.filter((j) => {
    const text = `${j.title ?? ""} ${j.details ?? ""} ${j.client?.name ?? ""}`.toLowerCase()
    const matchesQ = q ? text.includes(q.toLowerCase()) : true

    const matchesStatus = statusFilter === "All" ? true : j.status === statusFilter
    const matchesClient = clientFilter === "All" ? true : j.client_id === clientFilter

    const jobDate = j.scheduled_for ?? ""
    const matchesFrom = fromDate ? jobDate >= fromDate : true
    const matchesTo = toDate ? jobDate <= toDate : true

    return matchesQ && matchesStatus && matchesClient && matchesFrom && matchesTo
  })

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekJobsByDate = (dateISO: string) =>
    filteredJobs.filter((j) => j.scheduled_for === dateISO)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Jobs</h1>
        <div className="flex gap-2">
          <Link className="px-3 py-2 rounded bg-white/10" href="/dashboard">
            Back
          </Link>
          <button
            className="px-3 py-2 rounded bg-white/10"
            onClick={() => setView(view === "list" ? "calendar" : "list")}
            type="button"
          >
            View: {view === "list" ? "List" : "Calendar"}
          </button>
        </div>
      </div>

      {/* Add Job */}
      <form onSubmit={addJob} className="rounded border border-white/10 p-4 space-y-3 max-w-2xl">
        <h2 className="font-semibold">Add Job</h2>

        <div className="grid gap-2 md:grid-cols-2">
          <select
            className="w-full p-2 rounded bg-zinc-900 border border-white/10"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
          >
            <option value="">Select client...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <input
            className="w-full p-2 rounded bg-zinc-900 border border-white/10"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Job title (e.g., Spring startup, Repair zone 3)"
            required
          />
        </div>

        <div className="grid gap-2 md:grid-cols-4">
          <select
            className="w-full p-2 rounded bg-zinc-900 border border-white/10"
            value={status}
            onChange={(e) => setStatus(e.target.value as JobStatus)}
          >
            <option>Scheduled</option>
            <option>In Progress</option>
            <option>Done</option>
            <option>Canceled</option>
          </select>

          <input
            className="w-full p-2 rounded bg-zinc-900 border border-white/10"
            type="date"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
          />

          <input
            className="w-full p-2 rounded bg-zinc-900 border border-white/10"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Price"
          />

          <button
            disabled={loading}
            className="px-3 py-2 rounded bg-blue-600 disabled:opacity-60"
            type="submit"
          >
            {loading ? "Saving..." : "Add Job"}
          </button>
        </div>

        <textarea
          className="w-full p-2 rounded bg-zinc-900 border border-white/10"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Details (controller, zones, parts, notes...)"
          rows={3}
        />

        {msg && <p className="text-sm text-white/70">{msg}</p>}
      </form>

      {/* Filters */}
      <div className="rounded border border-white/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Filters</h2>
          <button
            type="button"
            className="px-3 py-2 rounded bg-white/10"
            onClick={() => {
              setQ("")
              setStatusFilter("All")
              setClientFilter("All")
              setFromDate("")
              setToDate("")
            }}
          >
            Clear
          </button>
        </div>

        <div className="grid gap-2 md:grid-cols-4">
          <input
            className="w-full p-2 rounded bg-zinc-900 border border-white/10"
            placeholder="Search title / details / client"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <select
            className="w-full p-2 rounded bg-zinc-900 border border-white/10"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="All">All Status</option>
            <option value="Scheduled">Scheduled</option>
            <option value="In Progress">In Progress</option>
            <option value="Done">Done</option>
            <option value="Canceled">Canceled</option>
          </select>

          <select
            className="w-full p-2 rounded bg-zinc-900 border border-white/10"
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
          >
            <option value="All">All Clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <input
              className="w-full p-2 rounded bg-zinc-900 border border-white/10"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
            <input
              className="w-full p-2 rounded bg-zinc-900 border border-white/10"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        </div>

        <div className="text-sm text-white/60">
          Showing <span className="text-white">{filteredJobs.length}</span> of{" "}
          <span className="text-white">{jobs.length}</span> jobs
        </div>
      </div>

      {/* Calendar View */}
      {view === "calendar" && (
        <div className="rounded border border-white/10 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Week Schedule</h2>
            <div className="flex gap-2">
              <button
                className="px-3 py-2 rounded bg-white/10"
                onClick={() => setWeekStart(startOfWeek(addDays(weekStart, -7)))}
                type="button"
              >
                ← Prev
              </button>
              <button
                className="px-3 py-2 rounded bg-white/10"
                onClick={() => setWeekStart(startOfWeek(new Date()))}
                type="button"
              >
                This Week
              </button>
              <button
                className="px-3 py-2 rounded bg-white/10"
                onClick={() => setWeekStart(startOfWeek(addDays(weekStart, 7)))}
                type="button"
              >
                Next →
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-7">
            {weekDays.map((d) => {
              const iso = toISODate(d)
              const dayJobs = weekJobsByDate(iso)
              return (
                <div key={iso} className="rounded border border-white/10 p-3">
                  <div className="text-sm text-white/60">{iso}</div>
                  <div className="mt-2 space-y-2">
                    {dayJobs.map((j) => (
                      <div key={j.id} className="rounded bg-white/5 p-2 space-y-2">
                        <div>
                          <div className="font-medium text-sm">{j.title}</div>
                          <div className="text-xs text-white/60">
                            {j.client?.name ?? ""} • {j.status}
                            {j.price != null ? ` • $${j.price}` : ""}
                          </div>
                        </div>

                        <CreateInvoiceButton
                          jobId={j.id}
                          clientId={j.client_id}
                          defaultAmount={j.price}
                        />

                        <select
                          className="w-full p-2 rounded bg-zinc-900 border border-white/10 text-sm"
                          value={j.status}
                          onChange={(e) => updateJobStatus(j.id, e.target.value as JobStatus)}
                        >
                          <option>Scheduled</option>
                          <option>In Progress</option>
                          <option>Done</option>
                          <option>Canceled</option>
                        </select>
                      </div>
                    ))}
                    {dayJobs.length === 0 && (
                      <div className="text-xs text-white/50">No jobs</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* List View */}
      {view === "list" && (
        <div className="rounded border border-white/10 p-4">
          <h2 className="font-semibold mb-3">All Jobs</h2>
          <div className="space-y-2">
            {filteredJobs.map((j) => (
              <div
                key={j.id}
                className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 rounded bg-white/5 p-3"
              >
                <div className="flex-1">
                  <div className="font-medium">{j.title}</div>
                  <div className="text-sm text-white/60">
                    {j.client?.name ?? ""}{" "}
                    {j.scheduled_for ? `• ${j.scheduled_for}` : ""}{" "}
                    {j.price != null ? `• $${j.price}` : ""}
                  </div>
                  {j.details ? (
                    <div className="text-sm text-white/50 mt-1">{j.details}</div>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2 md:w-56">
                  <CreateInvoiceButton
                    jobId={j.id}
                    clientId={j.client_id}
                    defaultAmount={j.price}
                  />

                  <select
                    className="p-2 rounded bg-zinc-900 border border-white/10"
                    value={j.status}
                    onChange={(e) => updateJobStatus(j.id, e.target.value as JobStatus)}
                  >
                    <option>Scheduled</option>
                    <option>In Progress</option>
                    <option>Done</option>
                    <option>Canceled</option>
                  </select>
                </div>
              </div>
            ))}
            {filteredJobs.length === 0 && (
              <div className="text-white/60 text-sm">No matching jobs.</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}