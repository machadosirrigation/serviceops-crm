"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import GlobalSearch from "@/components/GlobalSearch"
import NotificationsBell from "@/components/NotificationsBell"

function NavLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const active = pathname === href

  return (
    <Link
      href={href}
      className={
        "block px-4 py-3 rounded-xl border transition " +
        (active
          ? "bg-white text-black border-white"
          : "bg-white/5 text-white border-white/10 hover:bg-white/10")
      }
    >
      {children}
    </Link>
  )
}

export default function AppShell({
  email,
  children,
}: {
  email?: string | null
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">

      {/* Sidebar */}
      <aside className="w-72 border-r border-white/10 p-6 space-y-6">
        <div className="text-xl font-bold">ServiceOps CRM</div>

        <nav className="space-y-2">
          <NavLink href="/dashboard">Dashboard</NavLink>
          <NavLink href="/timesheet">Timesheet</NavLink>
          <NavLink href="/clients">Clients</NavLink>
          <NavLink href="/jobs">Jobs</NavLink>
          <NavLink href="/invoices">Invoices</NavLink>
	  <Link href="/leads">Leads</Link>
        </nav>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col">

        {/* Top Bar */}
        <header className="h-16 border-b border-white/10 flex items-center justify-between px-6">

          {/* App Name */}
          <div className="text-lg font-semibold">
            ServiceOps
          </div>

         {/* Global Search */}
<GlobalSearch />

          {/* Right side */}
          <div className="flex items-center gap-4">

            <NotificationsBell />

            {/* User Profile */}
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2 rounded-lg">
              <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-xs font-bold">
                {email?.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm">{email}</span>
            </div>

          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>

      </div>
    </div>
  )
}