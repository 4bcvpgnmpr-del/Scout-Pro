import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { SubLayout } from "@/components/sub-layout";

import Dashboard from "@/pages/dashboard";
import Scout from "@/pages/scout";
import Players from "@/pages/players";
import Teams from "@/pages/teams";
import Games from "@/pages/games";
import Reports from "@/pages/reports";
import CalendarPage from "@/pages/calendar";
import Fichajes from "@/pages/fichajes";
import Videos from "@/pages/videos";
import Jugadas from "@/pages/jugadas";
import Usuarios from "@/pages/usuarios";
import Ajustes from "@/pages/ajustes";

import PlayerNew from "@/pages/player-new";
import PlayerEdit from "@/pages/player-edit";
import PlayerDetail from "@/pages/player-detail";
import TeamNew from "@/pages/team-new";
import TeamEdit from "@/pages/team-edit";
import TeamDetail from "@/pages/team-detail";
import GameNew from "@/pages/game-new";
import GameEdit from "@/pages/game-edit";
import ReportNew from "@/pages/report-new";
import ReportEdit from "@/pages/report-edit";
import ReportDetail from "@/pages/report-detail";

import { applyTheme, applyFont } from "@/lib/themes";
import type { ThemeId, FontId } from "@/lib/themes";

const queryClient = new QueryClient();

function AppInit() {
  useEffect(() => {
    const theme = (localStorage.getItem("sp-theme") as ThemeId) ?? "naranja";
    const font = (localStorage.getItem("sp-font") as FontId) ?? "teko";
    applyTheme(theme);
    applyFont(font);
  }, []);
  return null;
}

function Router() {
  return (
    <Switch>
      {/* ── Layout pages ─────────────────────────────────────────── */}
      <Route path="/">
        <Layout><Dashboard /></Layout>
      </Route>
      <Route path="/scout">
        <Scout />
      </Route>
      <Route path="/equipos">
        <Layout><Teams /></Layout>
      </Route>
      <Route path="/jugadores">
        <Layout><Players /></Layout>
      </Route>
      <Route path="/games">
        <Layout><Games /></Layout>
      </Route>
      <Route path="/reports">
        <Layout><Reports /></Layout>
      </Route>
      <Route path="/calendar">
        <Layout><CalendarPage /></Layout>
      </Route>
      <Route path="/fichajes">
        <Layout><Fichajes /></Layout>
      </Route>
      <Route path="/videos">
        <Layout><Videos /></Layout>
      </Route>
      <Route path="/jugadas">
        <Layout><Jugadas /></Layout>
      </Route>
      <Route path="/usuarios">
        <Layout><Usuarios /></Layout>
      </Route>
      <Route path="/ajustes">
        <Layout><Ajustes /></Layout>
      </Route>

      {/* ── SubLayout: Players ───────────────────────────────────── */}
      <Route path="/players/new">
        <SubLayout backTo="/jugadores" backLabel="Jugadores"><PlayerNew /></SubLayout>
      </Route>
      <Route path="/players/:id/edit">
        {() => <SubLayout backTo="/jugadores" backLabel="Jugadores"><PlayerEdit /></SubLayout>}
      </Route>
      <Route path="/players/:id">
        {() => <SubLayout backTo="/jugadores" backLabel="Jugadores"><PlayerDetail /></SubLayout>}
      </Route>

      {/* ── SubLayout: Teams ─────────────────────────────────────── */}
      <Route path="/teams/new">
        <SubLayout backTo="/equipos" backLabel="Equipos"><TeamNew /></SubLayout>
      </Route>
      <Route path="/teams/:id/edit">
        {() => <SubLayout backTo="/equipos" backLabel="Equipos"><TeamEdit /></SubLayout>}
      </Route>
      <Route path="/teams/:id">
        {() => <SubLayout backTo="/equipos" backLabel="Equipos"><TeamDetail /></SubLayout>}
      </Route>

      {/* ── SubLayout: Games ─────────────────────────────────────── */}
      <Route path="/games/new">
        <SubLayout backTo="/games" backLabel="Partidos"><GameNew /></SubLayout>
      </Route>
      <Route path="/games/:id/edit">
        {() => <SubLayout backTo="/games" backLabel="Partidos"><GameEdit /></SubLayout>}
      </Route>

      {/* ── SubLayout: Reports ───────────────────────────────────── */}
      <Route path="/reports/new">
        <SubLayout backTo="/reports" backLabel="Informes"><ReportNew /></SubLayout>
      </Route>
      <Route path="/reports/:id/edit">
        {() => <SubLayout backTo="/reports" backLabel="Informes"><ReportEdit /></SubLayout>}
      </Route>
      <Route path="/reports/:id">
        {() => <SubLayout backTo="/reports" backLabel="Informes"><ReportDetail /></SubLayout>}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppInit />
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
