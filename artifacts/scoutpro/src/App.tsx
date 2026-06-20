import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { SubLayout } from "@/components/sub-layout";
import { AuthProvider } from "@/contexts/AuthContext";
import { SeasonProvider } from "@/contexts/SeasonContext";
import { ProtectedRoute } from "@/components/protected-route";

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
import GameMatchCenter from "@/pages/game-match-center";
import MatchCenterHub from "@/pages/match-center-hub";
import ScoutingHub from "@/pages/scouting-hub";
import SyncPage from "@/pages/admin/sync";
import AdminSeasonsPage from "@/pages/admin/seasons";
import MiCuenta from "@/pages/mi-cuenta";

import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import SelectTeamPage from "@/pages/select-team";
import UpgradePage from "@/pages/upgrade";

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
      {/* ── Public auth routes ─────────────────────────────────── */}
      <Route path="/login">
        <LoginPage />
      </Route>
      <Route path="/register">
        <RegisterPage />
      </Route>

      {/* ── Protected: Selección de equipo / upgrade ───────────── */}
      <Route path="/equipos/seleccionar">
        <ProtectedRoute>
          <Layout><SelectTeamPage /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/upgrade">
        <ProtectedRoute>
          <Layout><UpgradePage /></Layout>
        </ProtectedRoute>
      </Route>

      {/* ── Layout pages ─────────────────────────────────────────── */}
      <Route path="/">
        <ProtectedRoute>
          <Layout><Dashboard /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/scout">
        <ProtectedRoute>
          <Scout />
        </ProtectedRoute>
      </Route>
      <Route path="/equipos">
        <ProtectedRoute>
          <Layout><Teams /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/jugadores">
        <ProtectedRoute>
          <Layout><Players /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/games">
        <ProtectedRoute>
          <Layout><Games /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/reports">
        <ProtectedRoute>
          <Layout><Reports /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/calendar">
        <ProtectedRoute>
          <Layout><CalendarPage /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/fichajes">
        <ProtectedRoute>
          <Layout><Fichajes /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/videos">
        <ProtectedRoute>
          <Layout><Videos /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/jugadas">
        <ProtectedRoute>
          <Layout><Jugadas /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/usuarios">
        <ProtectedRoute>
          <Layout><Usuarios /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/ajustes">
        <ProtectedRoute>
          <Layout><Ajustes /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/sync">
        <ProtectedRoute>
          <Layout><SyncPage /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/admin/temporadas">
        <ProtectedRoute>
          <Layout><AdminSeasonsPage /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/mi-cuenta">
        <ProtectedRoute>
          <Layout><MiCuenta /></Layout>
        </ProtectedRoute>
      </Route>

      {/* ── SubLayout: Players ───────────────────────────────────── */}
      <Route path="/players/new">
        <ProtectedRoute>
          <SubLayout backTo="/jugadores" backLabel="Jugadores"><PlayerNew /></SubLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/players/:id/edit">
        {() => (
          <ProtectedRoute>
            <SubLayout backTo="/jugadores" backLabel="Jugadores"><PlayerEdit /></SubLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/players/:id">
        {() => (
          <ProtectedRoute>
            <SubLayout backTo="/jugadores" backLabel="Jugadores"><PlayerDetail /></SubLayout>
          </ProtectedRoute>
        )}
      </Route>

      {/* ── SubLayout: Teams ─────────────────────────────────────── */}
      <Route path="/teams/new">
        <ProtectedRoute>
          <SubLayout backTo="/equipos" backLabel="Equipos"><TeamNew /></SubLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/teams/:id/edit">
        {() => (
          <ProtectedRoute>
            <SubLayout backTo="/equipos" backLabel="Equipos"><TeamEdit /></SubLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/teams/:id">
        {() => (
          <ProtectedRoute>
            <SubLayout backTo="/equipos" backLabel="Equipos"><TeamDetail /></SubLayout>
          </ProtectedRoute>
        )}
      </Route>

      <Route path="/match-center">
        <ProtectedRoute>
          <Layout><MatchCenterHub /></Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/scouting">
        <ProtectedRoute>
          <Layout><ScoutingHub /></Layout>
        </ProtectedRoute>
      </Route>

      {/* ── SubLayout: Games ─────────────────────────────────────── */}
      <Route path="/games/new">
        <ProtectedRoute>
          <SubLayout backTo="/games" backLabel="Partidos"><GameNew /></SubLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/games/:id/match-center">
        {() => (
          <ProtectedRoute>
            <Layout><GameMatchCenter /></Layout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/games/:id/edit">
        {() => (
          <ProtectedRoute>
            <SubLayout backTo="/games" backLabel="Partidos"><GameEdit /></SubLayout>
          </ProtectedRoute>
        )}
      </Route>

      {/* ── SubLayout: Reports ───────────────────────────────────── */}
      <Route path="/reports/new">
        <ProtectedRoute>
          <SubLayout backTo="/reports" backLabel="Informes"><ReportNew /></SubLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/reports/:id/edit">
        {() => (
          <ProtectedRoute>
            <SubLayout backTo="/reports" backLabel="Informes"><ReportEdit /></SubLayout>
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/reports/:id">
        {() => (
          <ProtectedRoute>
            <SubLayout backTo="/reports" backLabel="Informes"><ReportDetail /></SubLayout>
          </ProtectedRoute>
        )}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <SeasonProvider>
              <AppInit />
              <Router />
            </SeasonProvider>
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
