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
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

/** Wraps a page component — shows access denied screen if role lacks permission */
function Guard({ path, component: Page }: { path: string; component: React.ComponentType }) {
  const { user } = useAuth();
  if (!user) return null;
  if (!canAccess(user.role, path)) return <AccessDenied />;
  return <Page />;
}

function AuthenticatedApp() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/"                  component={Dashboard} />
        <Route path="/users">            {() => <Guard path="/users"             component={Users} />}           </Route>
        <Route path="/inventory">        {() => <Guard path="/inventory"         component={Inventory} />}       </Route>
        <Route path="/inspection">       {() => <Guard path="/inspection"        component={Inspection} />}      </Route>
        <Route path="/receipts">         {() => <Guard path="/receipts"          component={Receipts} />}        </Route>
        <Route path="/tokens">           {() => <Guard path="/tokens"            component={Tokens} />}          </Route>
        <Route path="/loans">            {() => <Guard path="/loans"             component={Loans} />}           </Route>
        <Route path="/forward-contracts">{() => <Guard path="/forward-contracts" component={ForwardContracts} />}</Route>
        <Route path="/marketplace">      {() => <Guard path="/marketplace"       component={Marketplace} />}     </Route>
        <Route path="/wallet">           {() => <Guard path="/wallet"            component={WalletPage} />}      </Route>
        <Route path="/finance-hub">      {() => <Guard path="/finance-hub"       component={FinanceHub} />}      </Route>
        <Route path="/settlement">       {() => <Guard path="/settlement"        component={Settlement} />}      </Route>
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
