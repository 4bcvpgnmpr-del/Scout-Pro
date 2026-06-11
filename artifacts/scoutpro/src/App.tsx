import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Scout from "@/pages/scout";
import PlayerNew from "@/pages/player-new";
import PlayerEdit from "@/pages/player-edit";
import PlayerDetail from "@/pages/player-detail";
import TeamNew from "@/pages/team-new";
import TeamEdit from "@/pages/team-edit";
import TeamDetail from "@/pages/team-detail";
import Games from "@/pages/games";
import GameNew from "@/pages/game-new";
import GameEdit from "@/pages/game-edit";
import Reports from "@/pages/reports";
import ReportNew from "@/pages/report-new";
import ReportEdit from "@/pages/report-edit";
import ReportDetail from "@/pages/report-detail";
import CalendarPage from "@/pages/calendar";
import { SubLayout } from "@/components/sub-layout";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      {/* Main 3-column scout view */}
      <Route path="/" component={Scout} />

      {/* Sub-pages use a simple layout with back navigation */}
      <Route path="/players/new">
        <SubLayout backTo="/" backLabel="Volver al Scout"><PlayerNew /></SubLayout>
      </Route>
      <Route path="/players/:id/edit">
        {(params) => <SubLayout backTo="/" backLabel="Volver al Scout"><PlayerEdit /></SubLayout>}
      </Route>
      <Route path="/players/:id">
        {(params) => <SubLayout backTo="/" backLabel="Volver al Scout"><PlayerDetail /></SubLayout>}
      </Route>
      <Route path="/teams/new">
        <SubLayout backTo="/" backLabel="Volver al Scout"><TeamNew /></SubLayout>
      </Route>
      <Route path="/teams/:id/edit">
        {(params) => <SubLayout backTo="/" backLabel="Volver al Scout"><TeamEdit /></SubLayout>}
      </Route>
      <Route path="/teams/:id">
        {(params) => <SubLayout backTo="/" backLabel="Volver al Scout"><TeamDetail /></SubLayout>}
      </Route>
      <Route path="/games/new">
        <SubLayout backTo="/games" backLabel="Partidos"><GameNew /></SubLayout>
      </Route>
      <Route path="/games/:id/edit">
        {(params) => <SubLayout backTo="/games" backLabel="Partidos"><GameEdit /></SubLayout>}
      </Route>
      <Route path="/games">
        <SubLayout backTo="/" backLabel="Volver al Scout"><Games /></SubLayout>
      </Route>
      <Route path="/reports/new">
        <SubLayout backTo="/" backLabel="Volver al Scout"><ReportNew /></SubLayout>
      </Route>
      <Route path="/reports/:id/edit">
        {(params) => <SubLayout backTo="/" backLabel="Volver al Scout"><ReportEdit /></SubLayout>}
      </Route>
      <Route path="/reports/:id">
        {(params) => <SubLayout backTo="/" backLabel="Volver al Scout"><ReportDetail /></SubLayout>}
      </Route>
      <Route path="/reports">
        <SubLayout backTo="/" backLabel="Volver al Scout"><Reports /></SubLayout>
      </Route>
      <Route path="/calendar">
        <SubLayout backTo="/" backLabel="Volver al Scout"><CalendarPage /></SubLayout>
      </Route>
    </Switch>
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
