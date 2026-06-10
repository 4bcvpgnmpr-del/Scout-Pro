import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import Players from "@/pages/players";

const queryClient = new QueryClient();

function RedirectToDashboard() {
  const [, setLocation] = useLocation();
  // Using useEffect to avoid React warning during render
  import("react").then(({ useEffect }) => {
    useEffect(() => {
      setLocation("/dashboard");
    }, [setLocation]);
  });
  return null;
}

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={RedirectToDashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/players" component={Players} />
        {/* Placeholder for other routes until created */}
        <Route component={NotFound} />
      </Switch>
    </Layout>
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
