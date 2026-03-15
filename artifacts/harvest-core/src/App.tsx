import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout";
import { AuthProvider, useAuth } from "@/contexts/auth";
import { canAccess } from "@/lib/permissions";
import LoginPage from "@/pages/login";
import AccessDenied from "@/pages/access-denied";
import NotFound from "@/pages/not-found";

// Pages
import Dashboard from "@/pages/dashboard";
import Users from "@/pages/users";
import Inventory from "@/pages/inventory";
import WarehouseManagement from "@/pages/warehouse-management";
import Inspection from "@/pages/inspection";
import Receipts from "@/pages/receipts";
import Tokens from "@/pages/tokens";
import Loans from "@/pages/loans";
import Marketplace from "@/pages/marketplace";
import Settlement from "@/pages/settlement";
import ForwardContracts from "@/pages/forward-contracts";
import WalletPage from "@/pages/wallet";
import FinanceHub from "@/pages/finance-hub";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

/**
 * HOC: wraps a page so it checks role permission at render time.
 * Must be defined outside render functions so Switch gets a stable component ref.
 */
function protect(routePath: string, Page: React.ComponentType) {
  const displayName = Page.displayName ?? Page.name ?? routePath;
  function Protected() {
    const { user } = useAuth();
    if (!user) return null;
    if (!canAccess(user.role, routePath)) return <AccessDenied />;
    return <Page />;
  }
  Protected.displayName = `Protected(${displayName})`;
  return Protected;
}

// Create guarded versions once — stable references, no re-mounting
const PUsers            = protect("/users",             Users);
const PInventory        = protect("/inventory",         Inventory);
const PWarehouseMgmt    = protect("/warehouse-management", WarehouseManagement);
const PInspection       = protect("/inspection",        Inspection);
const PReceipts         = protect("/receipts",          Receipts);
const PTokens           = protect("/tokens",            Tokens);
const PLoans            = protect("/loans",             Loans);
const PForwardContracts = protect("/forward-contracts", ForwardContracts);
const PMarketplace      = protect("/marketplace",       Marketplace);
const PWallet           = protect("/wallet",            WalletPage);
const PFinanceHub       = protect("/finance-hub",       FinanceHub);
const PSettlement       = protect("/settlement",        Settlement);

function AuthenticatedApp() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/"                  component={Dashboard} />
        <Route path="/users"             component={PUsers} />
        <Route path="/inventory"         component={PInventory} />
        <Route path="/warehouse-management" component={PWarehouseMgmt} />
        <Route path="/inspection"        component={PInspection} />
        <Route path="/receipts"          component={PReceipts} />
        <Route path="/tokens"            component={PTokens} />
        <Route path="/loans"             component={PLoans} />
        <Route path="/forward-contracts" component={PForwardContracts} />
        <Route path="/marketplace"       component={PMarketplace} />
        <Route path="/wallet"            component={PWallet} />
        <Route path="/finance-hub"       component={PFinanceHub} />
        <Route path="/settlement"        component={PSettlement} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function Router() {
  const { user } = useAuth();
  if (!user) return <LoginPage />;
  return <AuthenticatedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
