import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const ORG_ID = "4c111b29-620a-44f3-895e-9135f0288eb1"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://machadosirrigation.github.io",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const name = String(body.name ?? "").trim()
    const phone = String(body.phone ?? "").trim()
    const email = String(body.email ?? "").trim()
    const address = String(body.address ?? "").trim()
    const serviceType = String(body.serviceType ?? "").trim()
    const message = String(body.message ?? "").trim()
    const preferredDate = body.preferredDate ? String(body.preferredDate) : null

    if (!name || !phone || !serviceType) {
      return NextResponse.json(
        { error: "Name, phone, and service type are required." },
        { status: 400, headers: corsHeaders }
      )
    }

    // --------------------------------
    // 1) Find a company owner user_id
    // --------------------------------
    const { data: ownerRow, error: ownerError } = await supabase
      .from("company_members")
      .select("user_id")
      .eq("company_id", ORG_ID)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle()

    if (ownerError) {
      return NextResponse.json(
        { error: `Owner lookup failed: ${ownerError.message}` },
        { status: 500, headers: corsHeaders }
      )
    }

    if (!ownerRow?.user_id) {
      return NextResponse.json(
        { error: "No company owner found for this org." },
        { status: 500, headers: corsHeaders }
      )
    }

    const ownerUserId = ownerRow.user_id

    // --------------------------------
    // 2) Find existing client
    // --------------------------------
    let clientId: string | null = null

    if (email || phone) {
      const filters: string[] = []
      if (email) filters.push(`email.eq.${email}`)
      if (phone) filters.push(`phone.eq.${phone}`)

      const { data: existingClients, error: existingClientError } = await supabase
        .from("clients")
        .select("id")
        .eq("company_id", ORG_ID)
        .or(filters.join(","))
        .limit(1)

      if (existingClientError) {
        return NextResponse.json(
          { error: `Client lookup failed: ${existingClientError.message}` },
          { status: 500, headers: corsHeaders }
        )
      }

      if (existingClients && existingClients.length > 0) {
        clientId = existingClients[0].id
      }
    }

    // --------------------------------
    // 3) Create client if needed
    // --------------------------------
    if (!clientId) {
      const { data: newClient, error: newClientError } = await supabase
        .from("clients")
        .insert([
          {
            company_id: ORG_ID,
            name,
            phone: phone || null,
            email: email || null,
            address: address || null,
          },
        ])
        .select("id")
        .single()

      if (newClientError) {
        return NextResponse.json(
          { error: `Client create failed: ${newClientError.message}` },
          { status: 500, headers: corsHeaders }
        )
      }

      clientId = newClient.id
    }

    // --------------------------------
    // 4) Create lead
    // --------------------------------
    const { data: leadRow, error: leadError } = await supabase
      .from("leads")
      .insert([
        {
          org_id: ORG_ID,
          source: "Website",
          status: "New",
          job_type: serviceType,
          description: message || null,
          customer_id: null,
          property_id: null,
        },
      ])
      .select("id")
      .single()

    if (leadError) {
      return NextResponse.json(
        { error: `Lead create failed: ${leadError.message}` },
        { status: 500, headers: corsHeaders }
      )
    }

    // --------------------------------
    // 5) Create job
    // --------------------------------
    const { data: jobRow, error: jobError } = await supabase
      .from("jobs")
      .insert([
        {
          company_id: ORG_ID,
          user_id: ownerUserId,
          client_id: clientId,
          title: serviceType || "Website Request",
          status: "Scheduled",
          scheduled_for: preferredDate || null,
          price: 0,
        },
      ])
      .select("id")
      .single()

    if (jobError) {
      return NextResponse.json(
        { error: `Job create failed: ${jobError.message}` },
        { status: 500, headers: corsHeaders }
      )
    }

    // --------------------------------
    // 6) Mark lead converted
    // --------------------------------
    await supabase
      .from("leads")
      .update({ status: "Converted" })
      .eq("id", leadRow.id)

    return NextResponse.json(
      {
        success: true,
        leadId: leadRow.id,
        clientId,
        jobId: jobRow.id,
      },
      { headers: corsHeaders }
    )
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request." },
      { status: 400, headers: corsHeaders }
    )
  }
}