"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { createBrowserClient } from "@supabase/ssr"

type Lead = {
  id: string
  org_id: string
  customer_id: string | null
  property_id: string | null
  source: string | null
  status: string | null
  job_type: string | null
  description: string | null
  created_at: string
}

export default function LeadsPage() {
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
  const [orgId, setOrgId] = useState<string | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const load = async () => {
    setMsg(null)
    setLoading(true)

    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) {
      setMsg("Not logged in.")
      setLoading(false)
      return
    }

    const { data: cm, error: cmErr } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (cmErr) {
      setMsg(cmErr.message)
      setLoading(false)
      return
    }

    if (!cm?.company_id) {
      setMsg("No company found for this user.")
      setLoading(false)
      return
    }

    setOrgId(cm.company_id)

    const { data, error } = await supabase
      .from("leads")
      .select("id,org_id,customer_id,property_id,source,status,job_type,description,created_at")
      .eq("org_id", cm.company_id)
      .order("created_at", { ascending: false })

    if (error) {
      setMsg(error.message)
      setLeads([])
      setLoading(false)
      return
    }

    setLeads((data ?? []) as Lead[])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const markConverted = async (leadId: string) => {
    setMsg(null)
    if (!orgId) return

    const { error } = await supabase
      .from("leads")
      .update({ status: "Converted" })
      .eq("id", leadId)
      .eq("org_id", orgId)

    if (error) {
      setMsg(error.message)
      return
    }

    await load()
  }

  const deleteLead = async () => {
    if (!deleteId || !orgId) return

    setMsg(null)
    setLoading(true)

    const { error } = await supabase
      .from("leads")
      .delete()
      .eq("id", deleteId)
      .eq("org_id", orgId)

    if (error) {
      setMsg(error.message)
      setLoading(false)
      return
    }

    setDeleteId(null)
    await load()
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
          <p className="text-white/60 text-sm">Review leads and convert them to jobs.</p>
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

      <div className="rounded-2xl border border-white/10 bg-zinc-900/40 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="text-sm text-white/70">{loading ? "Loading…" : `${leads.length} lead(s)`}</div>
          <button
            onClick={load}
            className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition text-sm"
            type="button"
          >
            Refresh
          </button>
        </div>

        <div className="divide-y divide-white/10">
          {leads.map((l) => (
            <div key={l.id} className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div className="font-semibold">
                  {l.job_type ?? "Lead"}{" "}
                  <span className="text-xs text-white/60 font-normal">
                    • {new Date(l.created_at).toLocaleString()}
                  </span>
                </div>

                <div className="text-sm text-white/70 mt-1">
                  {l.description ?? "No description"}
                </div>

                <div className="text-xs text-white/50 mt-2">
                  Status: {l.status ?? "New"} • Source: {l.source ?? "Unknown"}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/jobs/new?lead_id=${l.id}`}
                  className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 transition text-sm"
                >
                  Convert to Job →
                </Link>

                <button
                  onClick={() => markConverted(l.id)}
                  className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition text-sm"
                  type="button"
                >
                  Mark Converted
                </button>

                <button
                  onClick={() => setDeleteId(l.id)}
                  className="px-3 py-2 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-200 border border-red-400/20 transition text-sm"
                  type="button"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}

          {leads.length === 0 && (
            <div className="p-6 text-sm text-white/60">No leads yet.</div>
          )}
        </div>
      </div>

      {deleteId && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setDeleteId(null)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-2xl">
            <div className="text-lg font-bold">Delete lead?</div>
            <div className="text-sm text-white/60 mt-1">
              This can’t be undone. Are you sure you want to delete this lead?
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15"
                onClick={() => setDeleteId(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60"
                onClick={deleteLead}
                disabled={loading}
                type="button"
              >
                {loading ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}