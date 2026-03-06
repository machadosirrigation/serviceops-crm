"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"

export default function AddNoteForm({ clientId }: { clientId: string }) {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const addNote = async (e: React.FormEvent) => {
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

    const { error } = await supabase.from("client_notes").insert([
      { user_id, client_id: clientId, note },
    ])

    if (error) {
      setMsg(error.message)
      setLoading(false)
      return
    }

    setNote("")
    setMsg("Note added ✅")
    router.refresh()
    setLoading(false)
  }

  return (
    <form onSubmit={addNote} className="space-y-2">
      <textarea
        className="w-full p-2 rounded bg-zinc-900 border border-white/10"
        rows={3}
        placeholder="Add a note (controller model, zone issues, parts used, etc.)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        required
      />
      <button
        disabled={loading}
        className="px-3 py-2 rounded bg-blue-600 disabled:opacity-60"
        type="submit"
      >
        {loading ? "Saving..." : "Add Note"}
      </button>
      {msg && <p className="text-sm text-white/70">{msg}</p>}
    </form>
  )
}