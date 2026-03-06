import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const {
      name,
      phone,
      email,
      address,
      job_type,
      description,
    } = body

    if (!name || !phone || !job_type) {
      return NextResponse.json(
        { error: "Name, phone, and job type are required." },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Use your real org id here
    const orgId = "4c111b29-620a-44f3-895e-9135f0288eb1"

    const { error } = await supabase.from("leads").insert([
      {
        org_id: orgId,
        source: "Website",
        status: "New",
        job_type,
        description: description || null,
        name: name || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
      },
    ])

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }
}