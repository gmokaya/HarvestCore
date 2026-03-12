import { useListMarketplaceListings, useGetMarketPrices } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@/components/ui"
import { formatCurrency, formatWeight } from "@/lib/utils"
import { Store, TrendingUp, TrendingDown } from "lucide-react"

export default function Marketplace() {
  const { data: listings, isLoading: listingsLoading } = useListMarketplaceListings({ status: 'active' })
  const { data: prices } = useGetMarketPrices()

  if (listingsLoading) return <div className="p-8 text-center text-muted-foreground">Loading marketplace...</div>

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Marketplace</h1>
          <p className="text-muted-foreground mt-1">Trade tokenized commodities and finance requests</p>
        </div>
        <Button><Store className="w-4 h-4 mr-2" /> New Listing</Button>
      </div>

      {/* Real-time Ticker */}
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {prices?.prices.map(p => (
          <div key={p.commodity} className="flex-shrink-0 bg-card border border-border/50 rounded-lg px-4 py-2 flex items-center gap-3">
            <span className="font-semibold text-sm">{p.commodity}</span>
            <span className="font-display font-bold text-primary">{p.pricePerKg} KES</span>
            <span className={`text-xs flex items-center ${p.change24h >= 0 ? 'text-emerald-400' : 'text-destructive'}`}>
              {p.change24h >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
              {Math.abs(p.changePercent24h).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {listings?.listings.map(listing => (
          <Card key={listing.id} className="group hover:border-primary/50 transition-colors">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex justify-between items-start">
                <div>
                  <Badge variant="outline" className="mb-2 uppercase bg-secondary">{listing.listingType}</Badge>
                  <CardTitle className="text-xl">{listing.commodity}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">Grade {listing.grade} • {formatWeight(listing.weightKg)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground mb-1">Asking Price</p>
                  <p className="font-display font-bold text-lg text-primary">{formatCurrency(listing.askingPrice)}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Seller</p>
                <p className="font-medium text-sm">{listing.sellerName}</p>
              </div>
              <Button size="sm" className="w-24 group-hover:shadow-primary/25">Place Bid</Button>
            </CardContent>
          </Card>
        ))}
        {(!listings?.listings || listings.listings.length === 0) && (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-border/50 rounded-xl text-muted-foreground">
            No active commodity listings at the moment.
          </div>
        )}
      </div>
    </div>
  )
}
