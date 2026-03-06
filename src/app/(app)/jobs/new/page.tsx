"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"

type Lead = {
  id: string
  org_id: string
  status: string | null
  source: string | null
  job_type: string | null
  description: string | null
  created_at: string
}

type Client = {
  id: string
  name: string
}

export default function NewJobPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const leadId = searchParams.get("lead_id")

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

  const [companyId, setCompanyId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const [lead, setLead] = useState<Lead | null>(null)
  const [clients, setClients] = useState<Client[]>([])

  const [clientId, setClientId] = useState("")
  const [title, setTitle] = useState("")
  const [status, setStatus] = useState("Scheduled")
  const [scheduledFor, setScheduledFor] = useState("")
  const [price, setPrice] = useState("")
  const [notes, setNotes] = useState("")

  const load = async () => {
    setMsg(null)
    setLoading(true)

    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (authErr) {
      setMsg(authErr.message)
      setLoading(false)
      return
    }

    const user = authData.user
    if (!user) {
      setMsg("Not logged in.")
      setLoading(false)
      return
    }

    setUserId(user.id)

    const { data: member, error: memberErr } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle()

    if (memberErr) {
      setMsg(memberErr.message)
      setLoading(false)
      return
    }

    if (!member?.company_id) {
      setMsg("No company found for this user.")
      setLoading(false)
      return
    }

    setCompanyId(member.company_id)

    const { data: clientRows, error: clientErr } = await supabase
      .from("clients")
      .select("id,name")
      .eq("company_id", member.company_id)
      .order("name", { ascending: true })

    if (clientErr) {
      setMsg(clientErr.message)
      setLoading(false)
      return
    }

    setClients((clientRows ?? []) as Client[])

    if (leadId) {
      const { data: leadRow, error: leadErr } = await supabase
        .from("leads")
        .select("id,org_id,status,source,job_type,description,created_at")
        .eq("id", leadId)
        .eq("org_id", member.company_id)
        .maybeSingle()

      if (leadErr) {
        setMsg(leadErr.message)
        setLoading(false)
        return
      }

      if (leadRow) {
        const l = leadRow as Lead
        setLead(l)
        setTitle(l.job_type || "Service Request")
        setNotes(l.description || "")
      }
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId])

  const createJob = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)

    if (!companyId || !userId) {
      setMsg("Missing company or user.")
      return
    }

    if (!clientId) {
      setMsg("Select a client.")
      return
    }

    if (!title.trim()) {
      setMsg("Job title is required.")
      return
    }

    const parsedPrice = price ? Number(price) : 0
    if (!Number.isFinite(parsedPrice)) {
      setMsg("Enter a valid price.")
      return
    }

    setLoading(true)

    const insertPayload: any = {
      company_id: companyId,
      user_id: userId,
      client_id: clientId,
      title: title.trim(),
      status,
      scheduled_for: scheduledFor || null,
      price: parsedPrice,
    }

    // If your jobs table has a notes/description column later, we can wire it here.
    const { data: newJob, error: jobErr } = await supabase
      .from("jobs")
      .insert([insertPayload])
      .select("id")
      .single()

    if (jobErr) {
      setMsg(jobErr.message)
      setLoading(false)
      return
    }

    if (leadId) {
      await supabase
        .from("leads")
        .update({ status: "Converted" })
        .eq("id", leadId)
        .eq("org_id", companyId)
    }

    setLoading(false)
    router.push(`/jobs`)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Job</h1>
          <p className="text-white/60 text-sm">
            Create a job{lead ? " from website lead" : ""}.
          </p>
        </div>

        <Link
          className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition"
          href={leadId ? "/leads" : "/jobs"}
        >
          Back
        </Link>
      </div>

      {msg && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {msg}
        </div>
      )}

      {lead && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
          <div className="font-semibold">Lead Imported</div>
          <div className="text-sm text-white/70 mt-1">
            Source: {lead.source ?? "Unknown"} • Status: {lead.status ?? "New"}
          </div>
          {lead.description && (
            <div className="text-sm text-white/70 mt-2">
              Request: {lead.description}
            </div>
          )}
        </div>
      )}

      <form
        onSubmit={createJob}
        className="rounded-2xl border border-white/10 bg-zinc-900/40 p-5 space-y-4"
      >
        <div>
          <label className="text-sm text-white/70">Client</label>
          <select
            className="mt-1 w-full rounded-xl bg-zinc-950 border border-white/10 p-3"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
          >
            <option value="">Select client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm text-white/70">Job Title</label>
          <input
            className="mt-1 w-full rounded-xl bg-zinc-950 border border-white/10 p-3"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sprinkler Repair"
            required
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="text-sm text-white/70">Status</label>
            <select
              className="mt-1 w-full rounded-xl bg-zinc-950 border border-white/10 p-3"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="Scheduled">Scheduled</option>
              <option value="In Progress">In Progress</option>
              <option value="Done">Done</option>
              <option value="Canceled">Canceled</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-white/70">Scheduled Date</label>
            <input
              type="date"
              className="mt-1 w-full rounded-xl bg-zinc-950 border border-white/10 p-3"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm text-white/70">Price</label>
            <input
              type="number"
              step="0.01"
              className="mt-1 w-full rounded-xl bg-zinc-950 border border-white/10 p-3"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        <div>
          <label className="text-sm text-white/70">Lead Notes</label>
          <textarea
            className="mt-1 w-full rounded-xl bg-zinc-950 border border-white/10 p-3"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Customer request details"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Link
            href={leadId ? "/leads" : "/jobs"}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 transition"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 transition disabled:opacity-60"
          >
            {loading ? "Saving..." : "Create Job"}
          </button>
        </div>
      </form>
    </div>
  )
}