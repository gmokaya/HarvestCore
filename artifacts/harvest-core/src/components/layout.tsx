import { Link, useLocation } from "wouter"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth"
import { canAccess } from "@/lib/permissions"
import { 
  LayoutDashboard, 
  Users, 
  Coins, 
  Banknote, 
  Store, 
  Scale,
  LogOut,
  Bell,
  ClipboardCheck,
  FileCheck2,
  Warehouse,
  FileSignature,
  Wallet,
  Layers,
} from "lucide-react"

const NAV_GROUPS = [
  {
    label: "Platform Modules",
    items: [
      { href: "/",      label: "Dashboard",      icon: LayoutDashboard },
      { href: "/users", label: "Identity & KYC", icon: Users },
    ],
  },
  {
    label: "Commodity Operations",
    items: [
      { href: "/inventory",   label: "Inventory & Logistics", icon: Warehouse },
      { href: "/inspection",  label: "Inspection & Quality",  icon: ClipboardCheck },
      { href: "/receipts",    label: "Warehouse Receipts",    icon: FileCheck2 },
    ],
  },
  {
    label: "Finance & Trade",
    items: [
      { href: "/tokens",            label: "Tokens",             icon: Coins },
      { href: "/loans",             label: "Credit & Loans",     icon: Banknote },
      { href: "/forward-contracts", label: "Forward Contracts",  icon: FileSignature },
      { href: "/wallet",            label: "Wallet & Payments",  icon: Wallet },
      { href: "/finance-hub",       label: "Finance Engine",     icon: Layers },
      { href: "/marketplace",       label: "Marketplace",        icon: Store },
      { href: "/settlement",        label: "Settlement",         icon: Scale },
    ],
  },
]

const ROLE_SHORT: Record<string, string> = {
  admin:              "System Administrator",
  farmer:             "Farmer / Borrower",
  trader:             "Commodity Trader",
  collateral_manager: "Collateral Manager",
  processor:          "Processor",
  warehouse_op:       "Warehouse Operator",
  checker:            "Checker / Auditor",
  lender:             "Lender",
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation()
  const { user, logout } = useAuth()
  const role = user?.role ?? ""

  // Filter nav items to only those the current role can access
  const visibleGroups = NAV_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccess(role, item.href)),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar — brand dark */}
      <aside className="w-60 flex-shrink-0 hidden md:flex flex-col" style={{ backgroundColor: "#0A2A2A" }}>
        {/* Logo */}
        <div className="px-5 py-4 border-b border-white/10 flex flex-col">
          <span style={{ fontFamily: "'Belleza', serif", fontSize: "28px", lineHeight: 1.2, color: "rgba(255,255,255,0.92)", letterSpacing: "0.01em" }}>
            TokenHarvest
          </span>
          <span style={{ fontFamily: "'Josefin Sans', 'Futura', 'Century Gothic', sans-serif", fontSize: "9px", letterSpacing: "0.196em", color: "rgba(199,215,218,0.65)", textTransform: "uppercase", textAlign: "right", marginTop: "2px" }}>
            TRADE FINANCE
          </span>
        </div>

        {/* Navigation */}
        <div className="flex-1 py-5 px-3 space-y-6 overflow-y-auto">
          {visibleGroups.map((group) => (
            <div key={group.label}>
              <div className="mb-1.5 px-2 text-[10px] font-semibold text-white/35 uppercase tracking-widest">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href))
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                        isActive
                          ? "bg-white/12 text-white"
                          : "text-white/55 hover:bg-white/8 hover:text-white/90"
                      )}
                    >
                      <item.icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-white" : "text-white/50")} />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* User footer */}
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-bold text-white">
                {user ? user.name.slice(0, 2).toUpperCase() : "??"}
              </span>
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-semibold text-white truncate">{user?.name ?? "—"}</p>
              <p className="text-[10px] text-white/40 truncate">{user ? (ROLE_SHORT[user.role] ?? user.role) : ""}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="h-14 flex-shrink-0 border-b border-border bg-background flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="flex flex-col md:hidden">
            <span style={{ fontFamily: "'Belleza', serif", fontSize: "18px", lineHeight: 1.2, color: "inherit" }}>
              TokenHarvest
            </span>
            <span style={{ fontFamily: "'Josefin Sans', 'Futura', 'Century Gothic', sans-serif", fontSize: "7.5px", letterSpacing: "0.196em", textTransform: "uppercase", opacity: 0.5, textAlign: "right", marginTop: "1px" }}>
              TRADE FINANCE
            </span>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <button className="relative p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              <Bell className="w-4.5 h-4.5" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-destructive border-2 border-background" />
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-background">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
