"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { createBrowserClient } from "@supabase/ssr"

type InvoiceStatus = "Unpaid" | "Paid"

type Invoice = {
  id: string
  invoice_no: number | null
  amount: number
  status: InvoiceStatus
  due_date: string | null
  created_at: string
  note: string | null
  client_id: string
  job_id: string | null
  client: { name: string; email?: string | null } | null
  job: { title: string; price?: number | null } | null
  totals?: { paid_total: number; balance_due: number }
}

type Job = {
  id: string
  title: string
  price: number | null
  client_id: string
  client: { name: string } | null
}

type Payment = {
  id: string
  invoice_id: string
  amount: number
  paid_at: string
  method: string | null
  note: string | null
}

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0)
}
function isoToday() {
  return new Date().toISOString().slice(0, 10)
}
function invLabel(n: number | null) {
  return n ? `INV-${String(n).padStart(6, "0")}` : "INV-—"
}

// ✅ Pricing guide (edit to match your prices)
const PRICING_GUIDE = [
  { label: "Diagnostic / Service Call", amount: 75, note: "Diagnostic / service call" },
  { label: "Spring Startup", amount: 120, note: "Spring startup (turn on, test zones, set controller)" },
  { label: "Winterization / Blowout", amount: 95, note: "Winterization / blowout (compressor + zone purge)" },
  { label: "Head / Nozzle Replacement (per head)", amount: 45, note: "Replace sprinkler head/nozzle (per head)" },
  { label: "Valve Replacement", amount: 220, note: "Replace irrigation valve (labor + basic fittings)" },
  { label: "Controller Replacement", amount: 180, note: "Replace irrigation controller + program schedule" },
  { label: "Drip Repair", amount: 85, note: "Drip line repair (labor + small parts)" },
] as const

export default function InvoicesPage() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  )

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  // filters
  const [tab, setTab] = useState<"All" | InvoiceStatus>("Unpaid")
  const [q, setQ] = useState("")

  // create modal
  const [createOpen, setCreateOpen] = useState(false)
  const [jobId, setJobId] = useState("")
  const [clientName, setClientName] = useState("")
  const [amount, setAmount] = useState<string>("")
  const [dueDate, setDueDate] = useState<string>(isoToday())
  const [note, setNote] = useState<string>("")

  // ✅ pricing guide selection
  const [pricingKey, setPricingKey] = useState("")

  // delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // payment modal
  const [payOpen, setPayOpen] = useState(false)
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [payAmount, setPayAmount] = useState("")
  const [payDate, setPayDate] = useState(isoToday())
  const [payMethod, setPayMethod] = useState("")
  const [payNote, setPayNote] = useState("")

  const load = async () => {
    setLoading(true)
    setMsg(null)

    // jobs for create invoice
    const { data: jobsData, error: jErr } = await supabase
      .from("jobs")
      .select("id,title,price,client_id, client:clients(name)")
      .order("created_at", { ascending: false })
    if (jErr) setMsg(jErr.message)
    setJobs((jobsData ?? []) as any)

    // invoices list
    const { data: invData, error: iErr } = await supabase
      .from("invoices")
      .select(
        "id,invoice_no,amount,status,due_date,created_at,note,client_id,job_id, client:clients(name,email), job:jobs(title,price)"
      )
      .order("created_at", { ascending: false })

    if (iErr) {
      setMsg(iErr.message)
      setInvoices([])
      setLoading(false)
      return
    }

    const invs = (invData ?? []) as any as Invoice[]

    // totals via view
    const { data: totalsData } = await supabase
      .from("invoice_totals")
      .select("invoice_id,paid_total,balance_due")

    const totalsMap = new Map<string, { paid_total: number; balance_due: number }>()
    ;(totalsData ?? []).forEach((t: any) => {
      totalsMap.set(t.invoice_id, {
        paid_total: Number(t.paid_total ?? 0),
        balance_due: Number(t.balance_due ?? 0),
      })
    })

    setInvoices(
      invs.map((i) => ({
        ...i,
        totals: totalsMap.get(i.id) ?? { paid_total: 0, balance_due: i.amount },
      }))
    )
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = invoices.filter((inv) => {
    if (tab !== "All" && inv.status !== tab) return false
    if (!q.trim()) return true
    const needle = q.toLowerCase()
    const hay = [invLabel(inv.invoice_no), inv.client?.name ?? "", inv.job?.title ?? "", inv.note ?? ""]
      .join(" ")
      .toLowerCase()
    return hay.includes(needle)
  })

  const totalCount = filtered.length
  const unpaidTotal = filtered
    .filter((i) => i.status === "Unpaid")
    .reduce((s, i) => s + (i.totals?.balance_due ?? i.amount ?? 0), 0)
  const paidTotal = filtered.reduce((s, i) => s + (i.totals?.paid_total ?? 0), 0)

  const togglePaid = async (id: string, next: InvoiceStatus) => {
    setMsg(null)
    const { error } = await supabase.from("invoices").update({ status: next }).eq("id", id)
    if (error) setMsg(error.message)
    await load()
  }

  const onPickJob = (pickedJobId: string) => {
    setJobId(pickedJobId)
    const j = jobs.find((x) => x.id === pickedJobId)
    setClientName(j?.client?.name ?? "")
    setAmount(String(j?.price ?? ""))
  }

  const openCreate = () => {
    setMsg(null)
    setJobId("")
    setClientName("")
    setAmount("")
    setDueDate(isoToday())
    setNote("")
    setPricingKey("") // ✅ reset pricing guide
    setCreateOpen(true)
  }

  const createInvoice = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    setLoading(true)

    const j = jobs.find((x) => x.id === jobId)
    if (!j) {
      setMsg("Pick a job first.")
      setLoading(false)
      return
    }

    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt < 0) {
      setMsg("Enter a valid amount.")
      setLoading(false)
      return
    }

    const { error } = await supabase.from("invoices").insert([
      {
        client_id: j.client_id,
        job_id: j.id,
        amount: amt,
        status: "Unpaid",
        due_date: dueDate || null,
        note: note || null,
      },
    ])

    if (error) {
      setMsg(error.message)
      setLoading(false)
      return
    }

    setCreateOpen(false)
    await load()
    setLoading(false)
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    setMsg(null)
    setLoading(true)

    const { error } = await supabase.from("invoices").delete().eq("id", deleteId)
    if (error) setMsg(error.message)

    setDeleteId(null)
    await load()
    setLoading(false)
  }

  const openPayments = async (inv: Invoice) => {
    setPayInvoice(inv)
    setPayOpen(true)
    setPayAmount("")
    setPayDate(isoToday())
    setPayMethod("")
    setPayNote("")
    setMsg(null)

    const { data, error } = await supabase
      .from("invoice_payments")
      .select("id,invoice_id,amount,paid_at,method,note")
      .eq("invoice_id", inv.id)
      .order("paid_at", { ascending: false })

    if (error) setMsg(error.message)
    setPayments((data ?? []) as any)
  }

  const addPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!payInvoice) return

    const amt = Number(payAmount)
    if (!Number.isFinite(amt) || amt <= 0) {
      setMsg("Enter a valid payment amount.")
      return
    }

    setLoading(true)
    setMsg(null)

    const { error } = await supabase.from("invoice_payments").insert([
      {
        invoice_id: payInvoice.id,
        amount: amt,
        paid_at: payDate,
        method: payMethod || null,
        note: payNote || null,
      },
    ])

    if (error) {
      setMsg(error.message)
      setLoading(false)
      return
    }

    await load()
    await openPayments(payInvoice)
    setLoading(false)
  }

  const deletePayment = async (paymentId: string) => {
    if (!payInvoice) return
    setLoading(true)
    setMsg(null)

    const { error } = await supabase.from("invoice_payments").delete().eq("id", paymentId)
    if (error) setMsg(error.message)

    await load()
    await openPayments(payInvoice)
    setLoading(false)
  }

  const TabButton = ({ label, value }: { label: string; value: "All" | InvoiceStatus }) => {
    const active = tab === value
    return (
      <button
        type="button"
        onClick={() => setTab(value)}
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
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-white/60 text-sm">Paid/unpaid, invoice numbers, partial payments, and printable PDF.</p>
        </div>

        <div className="flex gap-2">
          <Link className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition" href="/dashboard">
            Back
          </Link>
          <button
            className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 transition disabled:opacity-60"
            onClick={openCreate}
            disabled={loading}
            type="button"
          >
            + Create Invoice
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex gap-2">
          <TabButton label="All" value="All" />
          <TabButton label="Unpaid" value="Unpaid" />
          <TabButton label="Paid" value="Paid" />
        </div>

        <div className="md:ml-auto w-full md:w-96">
          <input
            className="w-full p-3 rounded-xl bg-zinc-900 border border-white/10 outline-none focus:border-white/20"
            placeholder="Search (invoice #, client, job, note)…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {msg && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{msg}</div>
      )}

      {/* Totals */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-5">
          <div className="text-sm text-white/60">Invoices (filtered)</div>
          <div className="text-3xl font-bold mt-1">{totalCount}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-5">
          <div className="text-sm text-white/60">Paid Total (filtered)</div>
          <div className="text-3xl font-bold mt-1">{money(paidTotal)}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-5">
          <div className="text-sm text-white/60">Balance Due (Unpaid)</div>
          <div className="text-3xl font-bold mt-1">{money(unpaidTotal)}</div>
        </div>
      </div>

      {/* List */}
      <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-4">
        <div className="space-y-2">
          {filtered.map((inv) => {
            const paid = inv.totals?.paid_total ?? 0
            const due = inv.totals?.balance_due ?? inv.amount
            const invNo = invLabel(inv.invoice_no)

            const emailTo = inv.client?.email?.trim() || ""
            const subject = encodeURIComponent(`${invNo} - Invoice for ${inv.client?.name ?? "Client"}`)
            const body = encodeURIComponent(
              `Hi ${inv.client?.name ?? ""},\n\nHere is your invoice ${invNo}.\nTotal: ${money(inv.amount)}\nPaid: ${money(paid)}\nBalance Due: ${money(due)}\n\nYou can view/print here:\n${
                typeof window !== "undefined" ? window.location.origin : ""
              }/invoices/${inv.id}/print\n\nThank you!`
            )
            const mailto = emailTo ? `mailto:${emailTo}?subject=${subject}&body=${body}` : ""

            return (
              <div
                key={inv.id}
                className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        "text-xs px-2 py-1 rounded-full border " +
                        (inv.status === "Paid"
                          ? "bg-emerald-500/10 border-emerald-400/20 text-emerald-200"
                          : "bg-amber-500/10 border-amber-400/20 text-amber-200")
                      }
                    >
                      {inv.status}
                    </span>

                    <div className="font-semibold truncate">
                      {invNo} • {inv.client?.name ?? "Client"}
                    </div>
                  </div>

                  <div className="text-sm text-white/60 mt-1 truncate">
                    {inv.job?.title ? `Job: ${inv.job.title}` : "No job linked"}
                    {inv.due_date ? ` • Due: ${inv.due_date}` : ""}
                  </div>

                  <div className="text-sm text-white/70 mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    <span>
                      Total: <span className="font-semibold">{money(inv.amount)}</span>
                    </span>
                    <span>
                      Paid: <span className="font-semibold">{money(paid)}</span>
                    </span>
                    <span>
                      Balance: <span className="font-semibold">{money(due)}</span>
                    </span>
                  </div>

                  {inv.note && <div className="text-sm text-white/50 mt-2">{inv.note}</div>}
                </div>

                <div className="flex flex-col md:flex-row gap-2 md:items-center">
                  <Link
                    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition text-center"
                    href={`/invoices/${inv.id}/print`}
                    target="_blank"
                  >
                    Print / PDF
                  </Link>

                  {mailto ? (
                    <a className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition text-center" href={mailto}>
                      Email
                    </a>
                  ) : (
                    <button
                      className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/40 cursor-not-allowed"
                      type="button"
                      title="Add client email to enable"
                    >
                      Email
                    </button>
                  )}

                  <button
                    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition"
                    onClick={() => openPayments(inv)}
                    type="button"
                  >
                    Payments
                  </button>

                  <button
                    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition"
                    onClick={() => togglePaid(inv.id, inv.status === "Paid" ? "Unpaid" : "Paid")}
                    type="button"
                  >
                    Mark {inv.status === "Paid" ? "Unpaid" : "Paid"}
                  </button>

                  <button
                    className="px-3 py-2 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-200 border border-red-400/20 transition"
                    onClick={() => setDeleteId(inv.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}

          {!loading && filtered.length === 0 && <div className="text-white/60 text-sm p-2">No invoices found.</div>}
          {loading && <div className="text-white/60 text-sm p-2">Loading…</div>}
        </div>
      </div>

      {/* Create Invoice Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setCreateOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="text-lg font-bold">Create invoice</div>
                <div className="text-sm text-white/60">Pick a job and (optional) apply a pricing guide item.</div>
              </div>
              <button
                className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15"
                onClick={() => setCreateOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>

            <form onSubmit={createInvoice} className="space-y-3">
              <div>
                <label className="text-xs text-white/60">Job</label>
                <select
                  className="mt-1 w-full p-3 rounded-xl bg-zinc-900 border border-white/10"
                  value={jobId}
                  onChange={(e) => onPickJob(e.target.value)}
                  required
                >
                  <option value="">Select job…</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title} {j.client?.name ? `— ${j.client.name}` : ""}{" "}
                      {j.price != null ? `(${money(j.price)})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* ✅ Pricing Guide dropdown */}
              <div>
                <label className="text-xs text-white/60">Pricing Guide (optional)</label>
                <select
                  className="mt-1 w-full p-3 rounded-xl bg-zinc-900 border border-white/10"
                  value={pricingKey}
                  onChange={(e) => {
                    const key = e.target.value
                    setPricingKey(key)
                    if (!key) return

                    const item = PRICING_GUIDE.find((x) => x.label === key)
                    if (!item) return

                    setAmount(String(item.amount))
                    setNote((prev) => {
                      const cleaned = (prev ?? "").trim()
                      return cleaned ? `${cleaned}\n${item.note}` : item.note
                    })
                  }}
                >
                  <option value="">Select a common price…</option>
                  {PRICING_GUIDE.map((p) => (
                    <option key={p.label} value={p.label}>
                      {p.label} — ${p.amount}
                    </option>
                  ))}
                </select>
                <div className="text-xs text-white/50 mt-1">
                  Selecting an item auto-fills Amount and appends a line to Notes.
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs text-white/60">Client</label>
                  <input
                    className="mt-1 w-full p-3 rounded-xl bg-zinc-900 border border-white/10"
                    value={clientName}
                    readOnly
                    placeholder="Auto-filled"
                  />
                </div>

                <div>
                  <label className="text-xs text-white/60">Amount</label>
                  <input
                    className="mt-1 w-full p-3 rounded-xl bg-zinc-900 border border-white/10"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="decimal"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-white/60">Due date</label>
                <input
                  type="date"
                  className="mt-1 w-full p-3 rounded-xl bg-zinc-900 border border-white/10"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs text-white/60">Note (optional)</label>
                <textarea
                  className="mt-1 w-full p-3 rounded-xl bg-zinc-900 border border-white/10"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Parts, warranty, payment terms…"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </button>
                <button
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60"
                  type="submit"
                >
                  {loading ? "Saving…" : "Create invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payments Modal */}
      {payOpen && payInvoice && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setPayOpen(false)} />
          <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="text-lg font-bold">Payments</div>
                <div className="text-sm text-white/60">
                  {invLabel(payInvoice.invoice_no)} • {payInvoice.client?.name ?? "Client"} • Balance:{" "}
                  {money(payInvoice.totals?.balance_due ?? payInvoice.amount)}
                </div>
              </div>
              <button
                className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15"
                onClick={() => setPayOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>

            <form onSubmit={addPayment} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="md:col-span-1">
                  <label className="text-xs text-white/60">Amount</label>
                  <input
                    className="mt-1 w-full p-3 rounded-xl bg-zinc-900 border border-white/10"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    inputMode="decimal"
                    placeholder="50.00"
                    required
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="text-xs text-white/60">Date</label>
                  <input
                    type="date"
                    className="mt-1 w-full p-3 rounded-xl bg-zinc-900 border border-white/10"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-white/60">Method (optional)</label>
                  <input
                    className="mt-1 w-full p-3 rounded-xl bg-zinc-900 border border-white/10"
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    placeholder="Cash, Card, Check…"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-white/60">Note (optional)</label>
                <input
                  className="mt-1 w-full p-3 rounded-xl bg-zinc-900 border border-white/10"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="Deposit, partial, etc…"
                />
              </div>

              <div className="flex justify-end">
                <button
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60"
                  type="submit"
                >
                  {loading ? "Saving…" : "Add Payment"}
                </button>
              </div>
            </form>

            <div className="mt-4 rounded-xl border border-white/10 bg-zinc-900/40 p-4">
              <div className="font-semibold mb-2">Payment History</div>
              <div className="space-y-2">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl bg-white/5 border border-white/10 p-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-medium">{money(Number(p.amount))}</div>
                      <div className="text-sm text-white/60">
                        {p.paid_at} {p.method ? `• ${p.method}` : ""} {p.note ? `• ${p.note}` : ""}
                      </div>
                    </div>
                    <button
                      className="px-3 py-2 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-200 border border-red-400/20"
                      onClick={() => deletePayment(p.id)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                ))}
                {payments.length === 0 && <div className="text-sm text-white/60">No payments yet.</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteId && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setDeleteId(null)} />
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-2xl">
            <div className="text-lg font-bold">Delete invoice?</div>
            <div className="text-sm text-white/60 mt-1">This can’t be undone. Are you sure you want to delete this invoice?</div>

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