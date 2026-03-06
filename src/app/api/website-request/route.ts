import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const ORG_ID = "4c111b29-620a-44f3-895e-9135f0288eb1"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/* Allow GitHub Pages to call this API */
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

    const name = body.name?.trim()
    const phone = body.phone?.trim()
    const email = body.email?.trim()
    const address = body.address?.trim()
    const serviceType = body.serviceType?.trim()
    const message = body.message?.trim()
    const preferredDate = body.preferredDate || null

    if (!name || !phone || !serviceType) {
      return NextResponse.json(
        { error: "Name, phone, and service type are required." },
        { status: 400, headers: corsHeaders }
      )
    }

    /* -------------------------------- */
    /* Find existing client */
    /* -------------------------------- */

    let clientId: string | null = null

    if (email || phone) {
      const { data } = await supabase
        .from("clients")
        .select("id")
        .eq("company_id", ORG_ID)
        .or(`email.eq.${email},phone.eq.${phone}`)
        .limit(1)

      if (data && data.length > 0) {
        clientId = data[0].id
      }
    }

    /* -------------------------------- */
    /* Create client if none exists */
    /* -------------------------------- */

    if (!clientId) {
      const { data, error } = await supabase
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

      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500, headers: corsHeaders }
        )
      }

      clientId = data.id
    }

    /* -------------------------------- */
    /* Create lead */
    /* -------------------------------- */

    const { data: leadData, error: leadError } = await supabase
      .from("leads")
      .insert([
        {
          org_id: ORG_ID,
          source: "Website",
          status: "New",
          job_type: serviceType,
          description: message || null,
        },
      ])
      .select("id")
      .single()

    if (leadError) {
      return NextResponse.json(
        { error: leadError.message },
        { status: 500, headers: corsHeaders }
      )
    }

    /* -------------------------------- */
    /* Create job draft */
    /* -------------------------------- */

    const { data: jobData, error: jobError } = await supabase
      .from("jobs")
      .insert([
        {
          company_id: ORG_ID,
          client_id: clientId,
          title: serviceType,
          status: "Scheduled",
          scheduled_for: preferredDate || null,
          price: 0,
        },
      ])
      .select("id")
      .single()

    if (jobError) {
      return NextResponse.json(
        { error: jobError.message },
        { status: 500, headers: corsHeaders }
      )
    }

    /* -------------------------------- */
    /* Mark lead converted */
    /* -------------------------------- */

    await supabase
      .from("leads")
      .update({ status: "Converted" })
      .eq("id", leadData.id)

    return NextResponse.json(
      {
        success: true,
        leadId: leadData.id,
        clientId,
        jobId: jobData.id,
      },
      { headers: corsHeaders }
    )
  } catch {
    return NextResponse.json(
      { error: "Invalid request." },
      { status: 400, headers: corsHeaders }
    )
  }
}