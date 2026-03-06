"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { createBrowserClient } from "@supabase/ssr"

type Client = {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  created_at: string
  is_archived: boolean
  archived_at: string | null
}

export default function ClientsPage() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  )

  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  // UI
  const [tab, setTab] = useState<"Active" | "Archived">("Active")
  const [q, setQ] = useState("")

  // add client
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [address, setAddress] = useState("")

  // permanent delete confirm (optional, only shown in Archived tab)
  const [deleteClient, setDeleteClient] = useState<Client | null>(null)

  const load = async () => {
    setLoading(true)
    setMsg(null)

    const { data, error } = await supabase
      .from("clients")
      .select("id,name,phone,email,address,created_at,is_archived,archived_at")
      .order("created_at", { ascending: false })

    if (error) setMsg(error.message)
    setClients((data ?? []) as any)

    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addClient = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMsg(null)

    if (!name.trim()) {
      setMsg("Client name is required.")
      setLoading(false)
      return
    }

    const { error } = await supabase.from("clients").insert([
      {
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        is_archived: false,
        archived_at: null,
      },
    ])

    if (error) {
      setMsg(error.message)
      setLoading(false)
      return
    }

    setName("")
    setPhone("")
    setEmail("")
    setAddress("")
    await load()
    setLoading(false)
  }

  const setArchived = async (client: Client, archived: boolean) => {
    setLoading(true)
    setMsg(null)

    const payload = archived
      ? { is_archived: true, archived_at: new Date().toISOString() }
      : { is_archived: false, archived_at: null }

    const { error } = await supabase.from("clients").update(payload).eq("id", client.id)

    if (error) {
      setMsg(error.message)
      setLoading(false)
      return
    }

    await load()
    setLoading(false)
  }

  const confirmDelete = async () => {
    if (!deleteClient) return
    setLoading(true)
    setMsg(null)

    const { error } = await supabase.from("clients").delete().eq("id", deleteClient.id)

    if (error) {
      setMsg(error.message)
      setLoading(false)
      return
    }

    setDeleteClient(null)
    await load()
    setLoading(false)
  }

  const filtered = clients
    .filter((c) => (tab === "Active" ? !c.is_archived : c.is_archived))
    .filter((c) => {
      if (!q.trim()) return true
      const needle = q.toLowerCase()
      const hay = `${c.name} ${c.phone ?? ""} ${c.email ?? ""} ${c.address ?? ""}`.toLowerCase()
      return hay.includes(needle)
    })

  const TabButton = ({ label }: { label: "Active" | "Archived" }) => {
    const active = tab === label
    return (
      <button
        type="button"
        onClick={() => setTab(label)}
        className={
          "px-3 py-2 rounded-lg text-sm border transition " +
          (active
            ? "bg-white text-black border-white"
            : "bg-white/5 text-white border-white/10 hover:bg-white/10")
        }
      >
        {label}
      </button>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-white/60 text-sm">
            Keep clients organized. Archive clients you no longer service (history stays).
          </p>
        </div>
        <Link className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition" href="/dashboard">
          Back
        </Link>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex gap-2">
          <TabButton label="Active" />
          <TabButton label="Archived" />
        </div>

        <div className="md:ml-auto w-full md:w-96">
          <input
            className="w-full p-3 rounded-xl bg-zinc-900 border border-white/10 outline-none focus:border-white/20"
            placeholder="Search clients (name, phone, email, address)…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {msg && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {msg}
        </div>
      )}

      {/* Add Client (only on Active tab) */}
      {tab === "Active" && (
        <form onSubmit={addClient} className="rounded-xl border border-white/10 bg-zinc-900/40 p-5 space-y-3">
          <div className="font-semibold">Add Client</div>

          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="w-full p-3 rounded-xl bg-zinc-900 border border-white/10"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Client name"
              required
            />
            <input
              className="w-full p-3 rounded-xl bg-zinc-900 border border-white/10"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone (optional)"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="w-full p-3 rounded-xl bg-zinc-900 border border-white/10"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (optional)"
            />
            <input
              className="w-full p-3 rounded-xl bg-zinc-900 border border-white/10"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Address (optional)"
            />
          </div>

          <div className="flex justify-end">
            <button
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60"
              type="submit"
            >
              {loading ? "Saving…" : "Add Client"}
            </button>
          </div>
        </form>
      )}

      {/* Client List */}
      <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-4">
        {loading && <div className="text-white/60 text-sm p-2">Loading…</div>}

        {!loading && filtered.length === 0 && (
          <div className="text-white/60 text-sm p-2">
            {tab === "Active" ? "No active clients found." : "No archived clients found."}
          </div>
        )}

        <div className="space-y-2">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {c.is_archived && (
                    <span className="text-xs px-2 py-1 rounded-full border bg-amber-500/10 border-amber-400/20 text-amber-200">
                      Archived
                    </span>
                  )}
                  <div className="font-semibold truncate">{c.name}</div>
                </div>

                <div className="text-sm text-white/60 truncate mt-1">
                  {c.phone ? `📞 ${c.phone}` : ""}
                  {c.phone && c.email ? " • " : ""}
                  {c.email ? `✉️ ${c.email}` : ""}
                  {(c.phone || c.email) && c.address ? " • " : ""}
                  {c.address ? `📍 ${c.address}` : ""}
                </div>

                {c.is_archived && c.archived_at ? (
                  <div className="text-xs text-white/50 mt-1">
                    Archived on {new Date(c.archived_at).toLocaleDateString()}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Link
                  className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition text-center"
                  href={`/clients/${c.id}`}
                >
                  View
                </Link>

                {!c.is_archived ? (
                  <button
                    className="px-3 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-400/20 transition"
                    onClick={() => setArchived(c, true)}
                    type="button"
                  >
                    Archive
                  </button>
                ) : (
                  <button
                    className="px-3 py-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border border-emerald-400/20 transition"
                    onClick={() => setArchived(c, false)}
                    type="button"
                  >
                    Restore
                  </button>
                )}

                {/* Optional: permanent delete only in Archived tab */}
                {c.is_archived && (
                  <button
                    className="px-3 py-2 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-200 border border-red-400/20 transition"
                    onClick={() => setDeleteClient(c)}
                    type="button"
                    title="Permanently delete client"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Permanent delete confirm modal */}
      {deleteClient && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setDeleteClient(null)} />
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-2xl">
            <div className="text-lg font-bold">Permanently delete client?</div>
            <div className="text-sm text-white/60 mt-1">
              This will permanently remove <span className="font-semibold text-white">{deleteClient.name}</span>.
              This can’t be undone.
            </div>

            <div className="text-xs text-white/50 mt-3">
              If this client has jobs/invoices linked, delete may fail unless your database foreign keys cascade.
              Archiving is usually safer.
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15"
                onClick={() => setDeleteClient(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60"
                onClick={confirmDelete}
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