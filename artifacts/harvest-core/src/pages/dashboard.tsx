import { useGetDashboardStats, useGetRecentActivity, useGetMarketPrices } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle, Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui"
import { Coins, Banknote, Store, AlertTriangle, TrendingUp, TrendingDown, Clock } from "lucide-react"
import { formatCurrency, formatWeight, cn } from "@/lib/utils"

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats()
  const { data: activity, isLoading: activityLoading } = useGetRecentActivity({ limit: 5 })
  const { data: prices, isLoading: pricesLoading } = useGetMarketPrices()

  if (statsLoading || activityLoading || pricesLoading) {
    return <div className="h-[60vh] flex items-center justify-center text-muted-foreground">Loading dashboard data...</div>
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Platform Overview</h1>
        <p className="text-muted-foreground mt-2">Real-time metrics for the HarvestCore network.</p>
      </div>

      {/* Top Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-card to-card hover:from-primary/10 hover:border-primary/50 transition-colors duration-300">
          <CardContent className="p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="p-3 bg-primary/10 text-primary rounded-xl">
                <Coins className="w-5 h-5" />
              </div>
              <Badge variant="success" className="bg-emerald-500/20 text-emerald-400">+12%</Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Active Tokens</p>
              <h3 className="text-3xl font-display font-bold mt-1">{stats?.totalTokens || 0}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-card hover:from-blue-500/10 hover:border-blue-500/50 transition-colors duration-300">
          <CardContent className="p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
                <Banknote className="w-5 h-5" />
              </div>
              <Badge variant="info" className="bg-blue-500/20 text-blue-400">+5.4%</Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Loan Value</p>
              <h3 className="text-3xl font-display font-bold mt-1">{formatCurrency(stats?.totalLoanValue || 0)}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-card hover:from-amber-500/10 hover:border-amber-500/50 transition-colors duration-300">
          <CardContent className="p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
                <Store className="w-5 h-5" />
              </div>
              <span className="text-sm text-muted-foreground">Listings</span>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Marketplace Listings</p>
              <h3 className="text-3xl font-display font-bold mt-1">{stats?.activeListings || 0}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-card hover:from-destructive/10 hover:border-destructive/50 transition-colors duration-300">
          <CardContent className="p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="p-3 bg-destructive/10 text-destructive rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <Badge variant="destructive">{stats?.atRiskLoans || 0} Need Action</Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">At-Risk Loans</p>
              <h3 className="text-3xl font-display font-bold mt-1">{stats?.atRiskLoans || 0}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Feed */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-4 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
              {activity?.activities.map((item, i) => (
                <div key={item.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full border-4 border-background bg-secondary text-muted-foreground shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                    <Clock className="w-3 h-3" />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-border/50 bg-background/50 shadow-sm transition-all hover:border-primary/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm text-primary">{item.actorName}</span>
                      <time className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</time>
                    </div>
                    <p className="text-sm text-foreground/80">{item.description}</p>
                    <Badge variant="outline" className="mt-2 text-[10px] uppercase">{item.type.replace('_', ' ')}</Badge>
                  </div>
                </div>
              ))}
              {(!activity?.activities || activity.activities.length === 0) && (
                <p className="text-center text-muted-foreground py-8">No recent activity</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Market Prices */}
        <Card>
          <CardHeader>
            <CardTitle>Market Index (KES/kg)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {prices?.prices.map((price) => (
                <div key={price.commodity} className="flex items-center justify-between p-3 rounded-lg border border-border/30 bg-secondary/30 hover:bg-secondary/60 transition-colors">
                  <div>
                    <p className="font-semibold text-foreground">{price.commodity}</p>
                    <p className="text-xs text-muted-foreground">Vol: {formatWeight(price.volume24h)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display font-bold">{price.pricePerKg.toFixed(2)}</p>
                    <div className={cn("flex items-center justify-end gap-1 text-xs font-medium", price.change24h >= 0 ? "text-emerald-400" : "text-destructive")}>
                      {price.change24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {Math.abs(price.changePercent24h).toFixed(2)}%
                    </div>
                  </div>
                </div>
              ))}
              {(!prices?.prices || prices.prices.length === 0) && (
                 <p className="text-center text-muted-foreground py-4">No price data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
