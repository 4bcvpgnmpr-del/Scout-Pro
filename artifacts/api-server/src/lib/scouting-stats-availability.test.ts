import assert from "node:assert/strict";
import test from "node:test";
import {
  assessStandingAvailability,
  getReliableAggregateGamesPlayed,
} from "./scouting-stats-availability.js";

test("historical BEV sentinel zeroes remain unavailable", () => {
  const availability = assessStandingAvailability({
    gamesPlayed: 30,
    wins: 0,
    losses: 0,
    rank: 0,
    pointsFor: 2_250,
    pointsAgainst: 0,
  });

  assert.deepEqual(availability, {
    standings: true,
    record: false,
    rank: false,
    pointsFor: true,
    pointsAgainst: false,
    diff: false,
    provenance: "partial",
  });
});

test("a legitimate winless record is available", () => {
  const availability = assessStandingAvailability({
    gamesPlayed: 10,
    wins: 0,
    losses: 10,
    rank: 14,
    pointsFor: 610,
    pointsAgainst: 790,
  });

  assert.equal(availability.record, true);
  assert.equal(availability.pointsAgainst, true);
  assert.equal(availability.diff, true);
  assert.equal(availability.provenance, "official");
});

test("an empty standing has no available metrics", () => {
  const availability = assessStandingAvailability({
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    rank: 0,
    pointsFor: 0,
    pointsAgainst: 0,
  });

  assert.equal(availability.standings, false);
  assert.equal(availability.provenance, "none");
});

test("mixed single-game and season totals are rejected as inconsistent", () => {
  const standing = {
    gamesPlayed: 1,
    wins: 20,
    losses: 12,
    rank: 5,
    pointsFor: 97,
    pointsAgainst: 2_561,
  };
  const availability = assessStandingAvailability(standing);

  assert.equal(availability.record, false);
  assert.equal(availability.pointsFor, false);
  assert.equal(availability.pointsAgainst, false);
  assert.equal(availability.diff, false);
  assert.equal(getReliableAggregateGamesPlayed(standing), 32);
});