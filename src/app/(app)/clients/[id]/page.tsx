import Link from "next/link"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import AddNoteForm from "./AddNoteForm"

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createSupabaseServerClient()

  const { data: client } = await supabase
    .from("clients")
    .select("id,name,phone,email,address,created_at")
    .eq("id", params.id)
    .single()

  const { data: notes } = await supabase
    .from("client_notes")
    .select("id,note,created_at")
    .eq("client_id", params.id)
    .order("created_at", { ascending: false })

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id,title,status,scheduled_for,price,created_at")
    .eq("client_id", params.id)
    .order("created_at", { ascending: false })

  if (!client) {
    return (
      <div className="space-y-4">
        <Link href="/clients" className="underline">Back</Link>
        <div>Client not found.</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{client.name}</h1>
          <div className="text-white/60 text-sm">{client.phone ?? ""} {client.email ? `• ${client.email}` : ""}</div>
          <div className="text-white/60 text-sm">{client.address ?? ""}</div>
        </div>
        <Link className="px-3 py-2 rounded bg-white/10" href="/clients">Back</Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded border border-white/10 p-4">
          <h2 className="font-semibold mb-3">Notes</h2>
          <div className="space-y-2">
            {(notes ?? []).map(n => (
              <div key={n.id} className="rounded bg-white/5 p-3 text-sm">{n.note}</div>
            ))}
            {(!notes || notes.length === 0) && <div className="text-white/60 text-sm">No notes yet.</div>}
          </div>
          <div className="text-white/60 text-xs mt-3">
            Next: I can add a “New Note” form here.
		<AddNoteForm clientId={params.id} />
          </div>
        </div>

        <div className="rounded border border-white/10 p-4">
          <h2 className="font-semibold mb-3">Jobs</h2>
          <div className="space-y-2">
            {(jobs ?? []).map(j => (
              <div key={j.id} className="rounded bg-white/5 p-3">
                <div className="font-medium">{j.title}</div>
                <div className="text-sm text-white/60">
                  {j.status} {j.scheduled_for ? `• ${j.scheduled_for}` : ""} {j.price ? `• $${j.price}` : ""}
                </div>
              </div>
            ))}
            {(!jobs || jobs.length === 0) && <div className="text-white/60 text-sm">No jobs yet.</div>}
          </div>
          <div className="text-white/60 text-xs mt-3">
            Next: I can add an “Add Job for this client” button here.
          </div>
        </div>
      </div>
    </div>
  )
}