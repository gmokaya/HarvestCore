import { useListTokens, useMintToken } from "@workspace/api-client-react"
import { Card, Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Button } from "@/components/ui"
import { formatCurrency, formatWeight } from "@/lib/utils"
import { Coins, Hexagon, ArrowRightLeft } from "lucide-react"

export default function Tokens() {
  const { data, isLoading, refetch } = useListTokens()
  const mintToken = useMintToken()

  const handleMint = async (tokenId: string) => {
    await mintToken.mutateAsync({ tokenId })
    refetch()
  }

  const getStateBadge = (state: string) => {
    switch(state) {
      case 'free': return <Badge variant="success">Free</Badge>
      case 'pledged': return <Badge variant="warning">Pledged</Badge>
      case 'financed': return <Badge variant="info">Financed</Badge>
      case 'locked': return <Badge variant="destructive" className="bg-red-500/20 text-red-400">Locked</Badge>
      case 'in_liquidation': return <Badge variant="destructive">Liquidation</Badge>
      case 'released': return <Badge variant="outline">Released</Badge>
      default: return <Badge>{state}</Badge>
    }
  }

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading registry...</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Token Registry</h1>
          <p className="text-muted-foreground mt-1">Commodity-backed NFT lifecycle management</p>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Token ID</TableHead>
              <TableHead>Asset Details</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead className="text-right">Fair Market Value</TableHead>
              <TableHead className="text-center">State</TableHead>
              <TableHead className="text-right">Blockchain</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.tokens.map((token) => (
              <TableRow key={token.id}>
                <TableCell>
                  <div className="flex items-center gap-2 font-mono text-sm text-primary">
                    <Hexagon className="w-4 h-4" />
                    {token.id.split('-')[0]}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium text-foreground">{token.commodity} <span className="text-muted-foreground font-normal ml-1">({token.grade})</span></div>
                  <div className="text-xs text-muted-foreground mt-0.5">{formatWeight(token.weightKg)} • {token.warehouseName}</div>
                </TableCell>
                <TableCell className="font-medium">{token.ownerName}</TableCell>
                <TableCell className="text-right font-display font-medium">
                  {token.fairMarketValue ? formatCurrency(token.fairMarketValue) : '—'}
                </TableCell>
                <TableCell className="text-center">{getStateBadge(token.tokenState)}</TableCell>
                <TableCell className="text-right">
                  {!token.txHash ? (
                    <Button size="sm" variant="outline" className="border-primary/50 text-primary hover:bg-primary/10" onClick={() => handleMint(token.id)} disabled={mintToken.isPending}>
                      Mint NFT
                    </Button>
                  ) : (
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="outline" className="font-mono text-[10px] bg-background">0x...{token.txHash.slice(-6)}</Badge>
                      {token.tokenState === 'free' && (
                        <Button size="sm" variant="ghost" className="h-6 text-xs px-2"><ArrowRightLeft className="w-3 h-3 mr-1" /> Transfer</Button>
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(!data?.tokens || data.tokens.length === 0) && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No tokens registered</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
