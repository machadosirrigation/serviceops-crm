"use client"

import { useState } from "react"
import { createBrowserClient } from "@supabase/ssr"

export default function CreateInvoiceButton({
  jobId,
  clientId,
  defaultAmount,
}: {
  jobId: string
  clientId: string
  defaultAmount: number | null
}) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const createInvoice = async () => {
    setLoading(true)
    setMsg(null)

    const { data: auth } = await supabase.auth.getUser()
    const user_id = auth.user?.id
    if (!user_id) {
      setMsg("Not logged in.")
      setLoading(false)
      return
    }

    const { error } = await supabase.from("invoices").insert([
      {
        user_id,
        client_id: clientId,
        job_id: jobId,
        amount: defaultAmount ?? 0,
        status: "Unpaid",
      },
    ])

    if (error) setMsg(error.message)
    else setMsg("Invoice created ✅")

    setLoading(false)
  }

  return (
    <div className="space-y-1">
      <button
        onClick={createInvoice}
        disabled={loading}
        className="px-3 py-2 rounded bg-white/10 disabled:opacity-60"
      >
        {loading ? "Creating..." : "Create Invoice"}
      </button>
      {msg && <div className="text-xs text-white/60">{msg}</div>}
    </div>
  )
}