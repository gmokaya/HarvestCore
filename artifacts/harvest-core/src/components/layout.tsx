import { Link, useLocation } from "wouter"
import { cn } from "@/lib/utils"
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
} from "lucide-react"

const navGroups = [
  {
    label: "Platform Modules",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/users", label: "Identity & KYC", icon: Users },
    ],
  },
  {
    label: "Commodity Operations",
    items: [
      { href: "/inventory", label: "Inventory & Logistics", icon: Warehouse },
      { href: "/inspection", label: "Inspection & Quality", icon: ClipboardCheck },
      { href: "/receipts", label: "Warehouse Receipts", icon: FileCheck2 },
    ],
  },
  {
    label: "Finance & Trade",
    items: [
      { href: "/tokens", label: "Tokens", icon: Coins },
      { href: "/loans", label: "Credit & Loans", icon: Banknote },
      { href: "/marketplace", label: "Marketplace", icon: Store },
      { href: "/settlement", label: "Settlement", icon: Scale },
    ],
  },
]

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation()

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar — brand dark */}
      <aside className="w-60 flex-shrink-0 hidden md:flex flex-col" style={{ backgroundColor: "#0A2A2A" }}>
        {/* Logo */}
        <div className="px-5 py-4 border-b border-white/10 text-center">
          <span
            style={{
              fontFamily: "'Belleza', serif",
              fontSize: "28px",
              lineHeight: 1.4,
              color: "rgba(255,255,255,0.92)",
              letterSpacing: "0.01em",
            }}
          >
            TokenHarvest
          </span>
        </div>

        {/* Navigation */}
        <div className="flex-1 py-5 px-3 space-y-6 overflow-y-auto">
          {navGroups.map((group) => (
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
              <span className="text-[10px] font-bold text-white">AD</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-semibold text-white truncate">Admin User</p>
              <p className="text-[10px] text-white/40 truncate">System Administrator</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="h-14 flex-shrink-0 border-b border-border bg-background flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="flex items-center md:hidden">
            <span style={{ fontFamily: "'Belleza', serif", fontSize: "18px", lineHeight: 1.4, color: "inherit" }}>
              TokenHarvest
            </span>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <button className="relative p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              <Bell className="w-4.5 h-4.5" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-destructive border-2 border-background" />
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors text-sm font-medium">
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
