import { useGetDashboardStats, useGetRecentActivity, useGetMarketPrices } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle, Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui"
import { TrendingUp, TrendingDown, Clock } from "lucide-react"
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
