import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout";
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/users" component={Users} />
        <Route path="/inventory" component={Inventory} />
        <Route path="/inspection" component={Inspection} />
        <Route path="/receipts" component={Receipts} />
        <Route path="/tokens" component={Tokens} />
        <Route path="/loans" component={Loans} />
        <Route path="/marketplace" component={Marketplace} />
        <Route path="/settlement" component={Settlement} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
