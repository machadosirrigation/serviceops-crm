import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get("q") ?? "").trim()

  if (!q) return NextResponse.json({ clients: [], jobs: [] })

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ clients: [], jobs: [] }, { status: 401 })

  // Adjust columns to match your schema
  const [clientsRes, jobsRes] = await Promise.all([
    supabase
      .from("clients")
      .select("id,name,phone,email")
      .or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(8),
    supabase
      .from("jobs")
      .select("id,title,status,scheduled_for, client:clients(name)")
      .or(`title.ilike.%${q}%,status.ilike.%${q}%`)
      .limit(8),
  ])

  if (clientsRes.error || jobsRes.error) {
    return NextResponse.json(
      { error: clientsRes.error?.message || jobsRes.error?.message },
      { status: 400 }
    )
  }

  return NextResponse.json({
    clients: clientsRes.data ?? [],
    jobs: jobsRes.data ?? [],
  })
}