"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"

export default function AddClientForm() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault() // ✅ prevents “stuck on this screen” / weird reloads
    setError(null)

    const { error } = await supabase.from("clients").insert([{ name, phone }])
    if (error) {
      setError(error.message)
      return
    }

    // ✅ clear the form so it feels like it “moved on”
    setName("")
    setPhone("")

    // ✅ refresh any server-fetched lists on the page
    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 max-w-md">
      <h2 className="text-lg font-semibold">Add Client</h2>

      <input
        className="w-full p-2 bg-zinc-900 border border-white/10 rounded"
        placeholder="Client name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      <input
        className="w-full p-2 bg-zinc-900 border border-white/10 rounded"
        placeholder="Phone"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        disabled={isPending}
        className="px-4 py-2 rounded bg-blue-600 disabled:opacity-60"
      >
        {isPending ? "Adding..." : "Add Client"}
      </button>
    </form>
  )
}