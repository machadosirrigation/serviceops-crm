"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import Link from "next/link"

type Invoice = {
  id: string
  invoice_no: number | null
  amount: number
  status: "Unpaid" | "Paid"
  due_date: string | null
  created_at: string
  note: string | null
  client: { name: string; phone?: string | null; email?: string | null; address?: string | null } | null
  job: { title: string } | null
}

type Totals = { paid_total: number; balance_due: number }

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0)
}

export default function PrintInvoicePage() {
  const params = useParams<{ id: string }>()
  const id = params?.id

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  )

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [totals, setTotals] = useState<Totals>({ paid_total: 0, balance_due: 0 })
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      setMsg(null)

      const { data: inv, error } = await supabase
        .from("invoices")
        .select("id,invoice_no,amount,status,due_date,created_at,note, client:clients(name,phone,email,address), job:jobs(title)")
        .eq("id", id)
        .single()

      if (error) {
        setMsg(error.message)
        return
      }

      const { data: t, error: tErr } = await supabase
        .from("invoice_totals")
        .select("paid_total,balance_due")
        .eq("invoice_id", id)
        .single()

      if (tErr) {
        // not fatal
        setTotals({ paid_total: 0, balance_due: inv?.amount ?? 0 })
      } else {
        setTotals({ paid_total: Number(t?.paid_total ?? 0), balance_due: Number(t?.balance_due ?? 0) })
      }

      setInvoice(inv as any)
    })()
  }, [id, supabase])

  if (msg) return <div className="p-6 text-red-300">{msg}</div>
  if (!invoice) return <div className="p-6 text-white/70">Loading…</div>

  const invNo = invoice.invoice_no ? `INV-${String(invoice.invoice_no).padStart(6, "0")}` : "INV-—"

  return (
    <div className="min-h-screen bg-white text-black p-6 print:p-0">
      {/* Controls (hidden when printing) */}
      <div className="flex items-center justify-between gap-2 mb-6 print:hidden">
        <Link className="px-3 py-2 rounded bg-black text-white" href="/invoices">
          Back
        </Link>
        <button className="px-3 py-2 rounded bg-black text-white" onClick={() => window.print()}>
          Print / Save PDF
        </button>
      </div>

      {/* Invoice */}
      <div className="max-w-3xl mx-auto border border-black/10 rounded-xl p-6 print:border-0 print:rounded-none print:p-0">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-2xl font-bold">Invoice</div>
            <div className="text-sm text-black/70">{invNo}</div>
            <div className="text-sm text-black/70">
              Created: {new Date(invoice.created_at).toLocaleDateString()}
              {invoice.due_date ? ` • Due: ${invoice.due_date}` : ""}
            </div>
          </div>

          <div className="text-right">
            <div className="font-semibold">Your Company</div>
            <div className="text-sm text-black/70">Irrigation Services</div>
            <div className="text-sm text-black/70">Phone • Email</div>
          </div>
        </div>

        <hr className="my-5 border-black/10" />

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="font-semibold">Bill To</div>
            <div className="text-sm">{invoice.client?.name ?? "Client"}</div>
            {invoice.client?.address ? <div className="text-sm text-black/70">{invoice.client.address}</div> : null}
            {invoice.client?.phone ? <div className="text-sm text-black/70">{invoice.client.phone}</div> : null}
            {invoice.client?.email ? <div className="text-sm text-black/70">{invoice.client.email}</div> : null}
          </div>

          <div>
            <div className="font-semibold">Job</div>
            <div className="text-sm">{invoice.job?.title ?? "—"}</div>
          </div>
        </div>

        <hr className="my-5 border-black/10" />

        <div className="rounded-lg bg-black/5 p-4">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Invoice Total</div>
            <div className="font-semibold">{money(invoice.amount)}</div>
          </div>

          <div className="flex items-center justify-between mt-2 text-sm text-black/70">
            <div>Payments</div>
            <div>{money(totals.paid_total)}</div>
          </div>

          <div className="flex items-center justify-between mt-2 text-sm">
            <div className="font-semibold">Balance Due</div>
            <div className="font-semibold">{money(totals.balance_due)}</div>
          </div>
        </div>

        {invoice.note ? (
          <>
            <hr className="my-5 border-black/10" />
            <div>
              <div className="font-semibold">Notes</div>
              <div className="text-sm text-black/80 whitespace-pre-wrap">{invoice.note}</div>
            </div>
          </>
        ) : null}

        <div className="mt-8 text-xs text-black/50">
          Thank you for your business.
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  )
}