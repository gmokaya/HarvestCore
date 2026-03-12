import { useState } from "react"
import { useListLoans, useRepayLoan } from "@workspace/api-client-react"
import { Card, CardHeader, CardTitle, CardContent, Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label } from "@/components/ui"
import { formatCurrency } from "@/lib/utils"
import { ShieldAlert, Banknote, Check } from "lucide-react"

export default function Loans() {
  const { data, isLoading, refetch } = useListLoans()
  const repayLoan = useRepayLoan()
  
  const [repayId, setRepayId] = useState<string | null>(null)
  const [repayAmount, setRepayAmount] = useState("")

  const handleRepay = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!repayId) return
    await repayLoan.mutateAsync({ 
      loanId: repayId, 
      data: { amount: Number(repayAmount), paymentMethod: 'bank_transfer', transactionRef: 'DEMO-' + Date.now() } 
    })
    setRepayId(null)
    setRepayAmount("")
    refetch()
  }

  const getLtvBadge = (ltv?: number | null) => {
    if (!ltv) return <Badge variant="outline">—</Badge>
    if (ltv < 70) return <Badge variant="success">{ltv}% Healthy</Badge>
    if (ltv < 80) return <Badge variant="warning">{ltv}% Monitor</Badge>
    if (ltv < 90) return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/50">{ltv}% Margin Call</Badge>
    return <Badge variant="destructive">{ltv}% Liquidate</Badge>
  }

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading credit portfolio...</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Credit & Lending</h1>
          <p className="text-muted-foreground mt-1">Manage active loans, risk profiles, and LTV health</p>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Borrower</TableHead>
              <TableHead>Collateral</TableHead>
              <TableHead className="text-right">Principal</TableHead>
              <TableHead className="text-right">Interest</TableHead>
              <TableHead className="text-center">LTV Health</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.loans.map((loan) => (
              <TableRow key={loan.id}>
                <TableCell>
                  <div className="font-medium">{loan.borrowerName}</div>
                  <div className="flex items-center gap-1 mt-1">
                    {loan.riskScore === 'low' && <Badge variant="success" className="text-[10px] px-1 h-4">Low Risk</Badge>}
                    {loan.riskScore === 'medium' && <Badge variant="warning" className="text-[10px] px-1 h-4">Med Risk</Badge>}
                    {loan.riskScore === 'high' && <Badge variant="destructive" className="text-[10px] px-1 h-4">High Risk</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{loan.commodity}</TableCell>
                <TableCell className="text-right font-display font-medium text-foreground">{formatCurrency(loan.principalAmount)}</TableCell>
                <TableCell className="text-right text-muted-foreground">{loan.interestRate}% <span className="text-[10px]">APR</span></TableCell>
                <TableCell className="text-center">{getLtvBadge(loan.ltv)}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={loan.status === 'active' ? 'default' : loan.status === 'defaulted' ? 'destructive' : 'outline'} className="capitalize">
                    {loan.status.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {loan.status === 'active' && (
                    <Button size="sm" variant="outline" onClick={() => setRepayId(loan.id)}>Record Payment</Button>
                  )}
                  {loan.status === 'defaulted' && (
                    <Button size="sm" variant="destructive"><ShieldAlert className="w-4 h-4 mr-1"/> Liquidate</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(!data?.loans || data.loans.length === 0) && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No active loans</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!repayId} onOpenChange={(open) => !open && setRepayId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Loan Repayment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRepay} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Repayment Amount (KES)</Label>
              <Input 
                type="number" 
                value={repayAmount}
                onChange={(e) => setRepayAmount(e.target.value)}
                placeholder="e.g. 50000" 
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setRepayId(null)}>Cancel</Button>
              <Button type="submit" disabled={repayLoan.isPending}>
                <Check className="w-4 h-4 mr-2" /> Confirm Payment
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
