# Avoid 2-person teams when distributing players

## Goal
Change the default team-count suggestion so that remainders are absorbed into 4-person teams instead of creating 2-person teams.

## Current behavior
- The default number of teams is `ceil(non-host players / 3)`.
- Players are assigned round-robin.
- 28 people (27 players) → 10 teams → 8 teams of 3 and 2 teams of 2.
- 29 people (28 players) → 10 teams → 8 teams of 3 and 2 teams of 2.

## Proposed change
1. Change the default team-count suggestion in the host lobby from `ceil(P / 3)` to `floor(P / 3)` (minimum 2 teams).
2. Keep the existing round-robin assignment; it naturally turns the remainder into teams of 4.
3. Add a short helper note near the team-count input explaining that teams will be 3–4 players.

## Expected result
- 28 people (27 players) → 9 teams: 8 teams of 3 + 1 team of 4.
- 29 people (28 players) → 9 teams: 7 teams of 3 + 2 teams of 4.
- No default 2-person teams for groups of 6 or more.

## Files to edit
- `src/routes/game.$code.tsx`

## No database changes required.
