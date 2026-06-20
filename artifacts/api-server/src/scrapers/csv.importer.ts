/**
 * ScoutFlow — CSV Importer (ligas propias / datos manuales)
 *
 * Formato esperado del CSV de jugadores:
 *   nombre,equipo,liga,temporada,PJ,Min,Pts,Reb,Ast,Rob,Tap,Per,T2m,T2a,T3m,T3a,TLm,TLa
 *
 * Formato de clasificación:
 *   pos,equipo,liga,temporada,PJ,PG,PP,PF,PC
 */

import { parse } from "csv-parse/sync";
import * as fs from "fs";
import * as path from "path";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CsvPlayerRow {
  playerName:  string;
  teamName:    string;
  leagueName:  string;
  season:      string;
  gamesPlayed: number;
  minutes:     number;
  points:      number;
  rebounds:    number;
  assists:     number;
  steals:      number;
  blocks:      number;
  turnovers:   number;
  fg2Made:     number;
  fg2Att:      number;
  fg3Made:     number;
  fg3Att:      number;
  ftMade:      number;
  ftAtt:       number;
}

export interface CsvStandingRow {
  rank:          number;
  teamName:      string;
  leagueName:    string;
  season:        string;
  gamesPlayed:   number;
  wins:          number;
  losses:        number;
  pointsFor:     number;
  pointsAgainst: number;
}

// ─── Parser ──────────────────────────────────────────────────────────────────

export function parsePlayersCsv(filePath: string): CsvPlayerRow[] {
  const content = fs.readFileSync(path.resolve(filePath), "utf-8");

  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  return records.map((r: any): CsvPlayerRow => ({
    playerName:  r.nombre  ?? r.player ?? r.name ?? "",
    teamName:    r.equipo  ?? r.team   ?? "",
    leagueName:  r.liga    ?? r.league ?? "Liga Propia",
    season:      r.temporada ?? r.season ?? "2024-25",
    gamesPlayed: parseInt(r.PJ ?? r.gamesPlayed) || 0,
    minutes:     parseFloat(r.Min ?? r.minutes)  || 0,
    points:      parseFloat(r.Pts ?? r.points)   || 0,
    rebounds:    parseFloat(r.Reb ?? r.rebounds)  || 0,
    assists:     parseFloat(r.Ast ?? r.assists)   || 0,
    steals:      parseFloat(r.Rob ?? r.steals)    || 0,
    blocks:      parseFloat(r.Tap ?? r.blocks)    || 0,
    turnovers:   parseFloat(r.Per ?? r.turnovers) || 0,
    fg2Made:     parseInt(r.T2m ?? r.fg2Made)     || 0,
    fg2Att:      parseInt(r.T2a ?? r.fg2Att)      || 0,
    fg3Made:     parseInt(r.T3m ?? r.fg3Made)     || 0,
    fg3Att:      parseInt(r.T3a ?? r.fg3Att)      || 0,
    ftMade:      parseInt(r.TLm ?? r.ftMade)      || 0,
    ftAtt:       parseInt(r.TLa ?? r.ftAtt)       || 0,
  }));
}

export function parseStandingsCsv(filePath: string): CsvStandingRow[] {
  const content = fs.readFileSync(path.resolve(filePath), "utf-8");

  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  return records.map((r: any): CsvStandingRow => ({
    rank:          parseInt(r.pos  ?? r.rank) || 0,
    teamName:      r.equipo ?? r.team         ?? "",
    leagueName:    r.liga   ?? r.league       ?? "Liga Propia",
    season:        r.temporada ?? r.season    ?? "2024-25",
    gamesPlayed:   parseInt(r.PJ  ?? r.gamesPlayed)    || 0,
    wins:          parseInt(r.PG  ?? r.wins)           || 0,
    losses:        parseInt(r.PP  ?? r.losses)         || 0,
    pointsFor:     parseInt(r.PF  ?? r.pointsFor)      || 0,
    pointsAgainst: parseInt(r.PC  ?? r.pointsAgainst)  || 0,
  }));
}

// ─── Validate before import ───────────────────────────────────────────────────

export function validatePlayerRows(rows: CsvPlayerRow[]): {
  valid: CsvPlayerRow[];
  errors: { row: number; message: string }[];
} {
  const valid: CsvPlayerRow[] = [];
  const errors: { row: number; message: string }[] = [];

  rows.forEach((row, i) => {
    if (!row.playerName) {
      errors.push({ row: i + 2, message: "Nombre de jugador requerido" });
      return;
    }
    if (!row.teamName) {
      errors.push({ row: i + 2, message: `Equipo requerido para ${row.playerName}` });
      return;
    }
    if (row.gamesPlayed < 0) {
      errors.push({ row: i + 2, message: `PJ negativo en ${row.playerName}` });
      return;
    }
    valid.push(row);
  });

  return { valid, errors };
}
