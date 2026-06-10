import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Players from "@/pages/players";
import PlayerDetail from "@/pages/player-detail";
import PlayerNew from "@/pages/player-new";
import Teams from "@/pages/teams";
import TeamNew from "@/pages/team-new";
import TeamDetail from "@/pages/team-detail";
import Games from "@/pages/games";
import GameNew from "@/pages/game-new";
import Reports from "@/pages/reports";
import ReportNew from "@/pages/report-new";
import ReportDetail from "@/pages/report-detail";

const queryClient = new QueryClient();

function RedirectToDashboard() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/dashboard");
  }, [setLocation]);
  return null;
}

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={RedirectToDashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/players/new" component={PlayerNew} />
        <Route path="/players/:id" component={PlayerDetail} />
        <Route path="/players" component={Players} />
        <Route path="/teams/new" component={TeamNew} />
        <Route path="/teams/:id" component={TeamDetail} />
        <Route path="/teams" component={Teams} />
        <Route path="/games/new" component={GameNew} />
        <Route path="/games" component={Games} />
        <Route path="/reports/new" component={ReportNew} />
        <Route path="/reports/:id" component={ReportDetail} />
        <Route path="/reports" component={Reports} />
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
