import { useListDefaultedLoans, useInitiateSettlement } from "@workspace/api-client-react"
import { Card, CardHeader, CardTitle, CardContent, Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Button } from "@/components/ui"
import { formatCurrency } from "@/lib/utils"
import { Scale, AlertCircle } from "lucide-react"

export default function Settlement() {
  const { data, isLoading, refetch } = useListDefaultedLoans()
  const initiate = useInitiateSettlement()

  const handleInitiate = async (loanId: string) => {
    await initiate.mutateAsync({ loanId })
    refetch()
  }

  const getStageBadge = (stage: string) => {
    switch(stage) {
      case 'at_risk': return <Badge variant="warning">At Risk</Badge>
      case 'grace_period': return <Badge className="bg-orange-500/20 text-orange-400">Grace Period</Badge>
      case 'notice_sent': return <Badge variant="destructive">Notice Sent</Badge>
      case 'for_sale': return <Badge variant="info">In Liquidation</Badge>
      case 'settled': return <Badge variant="success">Settled</Badge>
      default: return <Badge variant="outline">{stage}</Badge>
    }
  }

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading settlement queue...</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settlement & Liquidation</h1>
          <p className="text-sm text-muted-foreground mt-1">Default watchdog and asset liquidation waterfall</p>
        </div>
      </div>

      {data?.loans.length ? (
        <div className="grid gap-6">
          {data.loans.map(loan => (
            <Card key={loan.id} className="border-destructive/30 shadow-destructive/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-destructive/10 rounded-full">
                    <AlertCircle className="w-5 h-5 text-destructive" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Loan Default: {loan.borrowerName}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">Asset: {loan.commodity} • {loan.daysOverdue} Days Overdue</p>
                  </div>
                </div>
                {getStageBadge(loan.stage)}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4 py-4 border-y border-border/50 mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Outstanding Balance</p>
                    <p className="font-display font-bold text-foreground">{formatCurrency(loan.outstandingBalance)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Collateral Value (Est.)</p>
                    <p className="font-display font-bold text-primary">{formatCurrency(loan.collateralValue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Current LTV</p>
                    <p className="font-bold text-destructive">{loan.currentLtv}%</p>
                  </div>
                  <div className="flex items-center justify-end">
                    {loan.stage === 'notice_sent' && (
                      <Button variant="destructive" onClick={() => handleInitiate(loan.id)} disabled={initiate.isPending}>
                        <Scale className="w-4 h-4 mr-2" /> Force Liquidate
                      </Button>
                    )}
                    {loan.stage === 'for_sale' && (
                      <Button variant="outline" className="border-blue-500/50 text-blue-400">View Auction</Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="py-16 text-center border-dashed">
          <div className="mx-auto w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
            <Scale className="w-6 h-6 text-emerald-400" />
          </div>
          <h3 className="text-lg font-medium text-foreground">Zero Defaults</h3>
          <p className="text-muted-foreground mt-1">All loans are currently performing or within grace periods.</p>
        </Card>
      )}
    </div>
  )
}
