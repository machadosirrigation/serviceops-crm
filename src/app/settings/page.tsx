"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [name, setName] = useState("");

  async function loadCustomers() {
    const { data } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });

    setCustomers(data || []);
  }

  async function addCustomer() {
    if (!name) return;

    await supabase.from("customers").insert([
      { full_name: name }
    ]);

    setName("");
    loadCustomers();
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  return (
    <main style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 28 }}>ServiceOps</h1>

      <div style={{ marginTop: 20 }}>
        <input
          placeholder="Customer name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ padding: 10, width: 250 }}
        />

        <button
          onClick={addCustomer}
          style={{
            padding: 10,
            marginLeft: 10,
            backgroundColor: "black",
            color: "white",
            border: "none",
            cursor: "pointer"
          }}
        >
          Add
        </button>
      </div>

      <div style={{ marginTop: 40 }}>
        {customers.map((c) => (
          <div
            key={c.id}
            style={{
              padding: 15,
              border: "1px solid #ddd",
              marginBottom: 10
            }}
          >
            <strong>{c.full_name}</strong>
          </div>
        ))}
      </div>
    </main>
  );
}