<script lang="ts">
  import { onMount } from "svelte";

  let allGames: any[] = $state([]);
  let allTeams: any[] = $state([]);
  let tournamentMode: "robin" | "playoffs" = $state("robin");

  const API_BASE = "https://api.quartzdev.cc";

  async function fetchData() {
    try {
      const [tRes, gRes] = await Promise.all([
        fetch(`${API_BASE}/teams/get`),
        fetch(`${API_BASE}/games/get/all`),
      ]);
      if (tRes.ok) allTeams = await tRes.json();
      if (gRes.ok) allGames = await gRes.json();
    } catch (e) {
      console.error("Connection error. Is the backend running?");
    }
  }

  // --- DATA DERIVATIONS ---

  let robinSchedule = $derived(
    allGames.filter((g) => {
      const isRobin = !g.phase || g.phase === "robin";
      const hasNoScore = !g.score1 || !g.score1.includes("x");
      return isRobin && hasNoScore;
    }),
  );

  let robinResults = $derived(
    allGames.filter(
      (g) =>
        (!g.phase || g.phase === "robin") && g.score1 && g.score1.includes("x"),
    ),
  );

  let playoffGames = $derived(
    allGames.filter((g) => {
      if (g.phase !== "playoffs") return false;
      const isFirstRound = g.eval.includes("1/8 Final");
      const hasTBD = g.team1 === "TBD" || g.team2 === "TBD";
      if (isFirstRound && hasTBD) return false;
      return true;
    }),
  );

  let leaderboard = $derived.by(() => {
    const standings = allTeams.map((team) => {
      let wins = 0;
      allGames.forEach((game) => {
        if (
          (!game.phase || game.phase === "robin") &&
          game.score1?.includes("x")
        ) {
          const [s1a, s1b] = game.score1.split("x").map(Number);
          const [s2a, s2b] = game.score2.split("x").map(Number);
          let t1Sets = (s1a > s1b ? 1 : 0) + (s2a > s2b ? 1 : 0);
          let t2Sets = (s1b > s1a ? 1 : 0) + (s2b > s2a ? 1 : 0);
          if (String(game.team1) === String(team.id) && t1Sets > t2Sets) wins++;
          if (String(game.team2) === String(team.id) && t2Sets > t1Sets) wins++;
        }
      });
      return { name: team.name, wins };
    });
    return standings.sort((a, b) => b.wins - a.wins);
  });

  // --- PLAYOFF HELPERS ---

  function getSetsWon(game: any): [number, number] {
    let t1 = 0, t2 = 0;
    for (const score of [game.score1, game.score2, game.score3]) {
      if (!score?.includes("x")) continue;
      const [a, b] = score.split("x").map(Number);
      if (a > b) t1++; else if (b > a) t2++;
    }
    return [t1, t2];
  }

  function isWinner(game: any, teamId: string): boolean {
    const [t1, t2] = getSetsWon(game);
    if (t1 === t2) return false;
    return String(game.team1) === String(teamId) ? t1 > t2 : t2 > t1;
  }

  function setsWonBy(game: any, teamId: string): number {
    const [t1, t2] = getSetsWon(game);
    return String(game.team1) === String(teamId) ? t1 : t2;
  }

  function getWinner(game: any): string | null {
    if (!game) return null;
    const [t1, t2] = getSetsWon(game);
    if (t1 === t2) return null;
    return t1 > t2 ? String(game.team1) : String(game.team2);
  }

  function getLoser(game: any): string | null {
    if (!game) return null;
    const [t1, t2] = getSetsWon(game);
    if (t1 === t2) return null;
    return t1 > t2 ? String(game.team2) : String(game.team1);
  }

  // --- FINAL STANDINGS (DYNAMIC) ---
  let playoffStandings = $derived.by(() => {
  // All completed playoff games (score1 contains 'x')
  const playoffComplete = allGames.filter(
    (g) => g.phase === "playoffs" && g.score1?.includes("x")
  );

  // All playoff games (even unfinished) to extract participants
  const allPlayoffGames = allGames.filter((g) => g.phase === "playoffs");

  // 1. Collect every unique team ID that ever appears in a playoff game
  const participantSet = new Set<string>();
  for (const g of allPlayoffGames) {
    if (g.team1 && g.team1 !== "TBD" && g.team1 !== "BYE")
      participantSet.add(String(g.team1));
    if (g.team2 && g.team2 !== "TBD" && g.team2 !== "BYE")
      participantSet.add(String(g.team2));
  }
  const participants = Array.from(participantSet);

  // 2. Place assignments (from explicit placement games)
  const placements = new Map<string, number>();

  const assign = (teamId: string | null, place: number) => {
    if (!teamId || teamId === "TBD") return;
    if (!placements.has(teamId)) placements.set(teamId, place);
  };

  // Championship final
  const final = playoffComplete.find(
    (g) => g.eval?.toLowerCase() === "finalas"
  );
  if (final) {
    assign(getWinner(final), 1);
    assign(getLoser(final), 2);
  }

  // Third‑place match
  const third = playoffComplete.find((g) =>
    g.eval?.toLowerCase().includes("dėl 3 vietos")
  );
  if (third) {
    assign(getWinner(third), 3);
    assign(getLoser(third), 4);
  }

  // Process every completed game that explicitly names a place
  for (const g of playoffComplete) {
    const ev = g.eval.toLowerCase();

    // "Dėl X vietos" (e.g. "Dėl 7 vietos")
    const m = ev.match(/dėl\s+(\d+)\s+vietos/);
    if (m) {
      const place = parseInt(m[1]);
      assign(getWinner(g), place);
      assign(getLoser(g), place + 1);
    }

    // "Dėl paskutinės vietos" → last two places
    if (ev === "dėl paskutinės vietos") {
      const total = participants.length;
      assign(getWinner(g), total - 1);
      assign(getLoser(g), total);
    }

    // "Kova dėl X‑Y vietų Finalas" → places X and X+1
    const poolFinal = ev.match(/kova dėl\s+(\d+)-\d+\s+vietų finalas/);
    if (poolFinal) {
      const place = parseInt(poolFinal[1]);
      assign(getWinner(g), place);
      assign(getLoser(g), place + 1);
    }
  }

  // 3. Fallback: fill remaining spots using bracket elimination logic
  // Determine total tournament size (next power of 2 >= number of participants)
  const n = participants.length;
  const bracketSize = n <= 2 ? 2 : Math.pow(2, Math.ceil(Math.log2(n)));

  // Identify the rounds from game labels
  const roundGroups: Map<string, any[]> = new Map();
  for (const g of allPlayoffGames) {
    const lbl = g.eval || "";
    if (
      lbl.includes("Ketvirtfinalis") ||
      lbl.includes("1/8 Final") ||
      lbl.includes("1/16 Final") ||
      lbl.includes("Pusfinalis") ||
      lbl.includes("Finalas") ||
      lbl.includes("Raundas")
    ) {
      // strip any suffix like " 1" to get the round key
      const key = lbl.replace(/\s*\d+$/, "").trim();
      if (!roundGroups.has(key)) roundGroups.set(key, []);
      roundGroups.get(key)!.push(g);
    }
  }

  // Sort round groups by presumed round order (first round first)
  const roundOrder = [
    "1/16 Final",
    "1/8 Final",
    "Ketvirtfinalis",
    "Raundas 1",
    "Raundas 2",
    "Raundas 3",
    "Raundas 4",
    "Pusfinalis",
    "Finalas",
  ];
  const sortedRounds: string[] = [];
  for (const r of roundOrder) {
    if (roundGroups.has(r)) sortedRounds.push(r);
  }
  // Also include any missing round names
  for (const k of roundGroups.keys()) {
    if (!sortedRounds.includes(k)) sortedRounds.push(k);
  }

  // For each round, figure out which teams lost there and haven't been placed yet
  const unplaced = participants.filter((id) => !placements.has(id));

  // Place unplaced teams based on the round they lost
  // We'll scan rounds from earliest (lowest) to latest (highest) and assign
  // the lowest available places to teams that lost in the earliest rounds.
  // The total number of unplaced teams determines the range of places left.
  // For example, in an 8-team bracket, if places 1-6 are filled, the two unplaced
  // teams will get 7 and 8. We need to decide who gets 7 and who gets 8.
  // They are the losers of the two semi-finals of the 5th-8th pool,
  // but if those games aren't explicit, we can deduce from the bracket.
  // The best we can do is: teams that lost in an earlier round get worse places.
  // So we'll assign the worst places to teams that lost in the earliest possible round
  // among the unplaced ones.

  // Collect all games from completed rounds (score1 with 'x') and note losers.
  const roundLosers: { teamId: string; roundIndex: number }[] = [];
  for (let i = 0; i < sortedRounds.length; i++) {
    const roundName = sortedRounds[i];
    const games = roundGroups.get(roundName) || [];
    for (const g of games) {
      if (g.score1?.includes("x")) {
        const loser = getLoser(g);
        if (loser && unplaced.includes(loser)) {
          roundLosers.push({ teamId: loser, roundIndex: i });
        }
      }
    }
  }

  // Sort unplaced losers by round index (earlier = worse)
  roundLosers.sort((a, b) => a.roundIndex - b.roundIndex);

  // Available places are the remaining numbers from 1..participants.length
  const usedPlaces = new Set(placements.values());
  const freePlaces = [];
  for (let p = 1; p <= participants.length; p++) {
    if (!usedPlaces.has(p)) freePlaces.push(p);
  }
  freePlaces.sort((a, b) => a - b); // ascending: worst place is highest number

  // Assign worst places (largest numbers) to earliest losers
  for (let i = 0; i < roundLosers.length; i++) {
    const placeIdx = freePlaces.length - 1 - i; // take from the end
    if (placeIdx >= 0) {
      const place = freePlaces[placeIdx];
      assign(roundLosers[i].teamId, place);
    }
  }

  // For any still unplaced teams (shouldn't happen if all games are in the system),
  // assign them the worst remaining places arbitrarily.
  const stillUnplaced = participants.filter((id) => !placements.has(id));
  for (let i = 0; i < stillUnplaced.length; i++) {
    const p = freePlaces[freePlaces.length - 1 - (roundLosers.length + i)];
    if (p) assign(stillUnplaced[i], p);
  }

  // Build final sorted array
  const result = Array.from(placements, ([teamId, place]) => ({
    teamId,
    place,
  }));
  result.sort((a, b) => a.place - b.place);
  return result;
});

  // --- GENERAL HELPERS ---

  function getTeamName(id: string) {
    if (!id || id === "TBD") return "TBD";
    const team = allTeams.find((t) => String(t.id) === String(id));
    return team ? team.name : "TBD";
  }

  function placeLabel(place: number): string {
    if (place === 1) return "🥇";
    if (place === 2) return "🥈";
    if (place === 3) return "🥉";
    return `${place}.`;
  }

  onMount(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  });
</script>

<main>
  <header>
    <h1>Tinklinis</h1>
    <div class="mode-toggle">
      <button
        class:active={tournamentMode === "robin"}
        onclick={() => (tournamentMode = "robin")}>Robinas</button
      >
      <button
        class:active={tournamentMode === "playoffs"}
        onclick={() => (tournamentMode = "playoffs")}>Playoffai</button
      >
    </div>
  </header>

  {#if tournamentMode === "robin"}
    <div class="fade-in">
      <section>
        <h2>Rezultatai</h2>
        <div class="card">
          <table>
            <thead><tr><th>#</th><th>Komanda</th><th>Pergalės</th></tr></thead>
            <tbody>
              {#each leaderboard as team, i}
                <tr>
                  <td>{i + 1}</td>
                  <td>{team.name}</td>
                  <td class="wins">{team.wins}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>

      <section class="section-spacer">
        <h2>Ateinantys žaidimai</h2>
        <div class="match-list">
          {#each robinSchedule as schedule}
            <div class="match-item upcoming">
              <div class="m-info">
                <span class="round-label">{schedule.eval}</span>
                <span class="pairing">
                  <strong>{getTeamName(schedule.team1)}</strong>
                  <small>vs</small>
                  <strong>{getTeamName(schedule.team2)}</strong>
                </span>
              </div>
              <span class="tag">ATEINANTYS</span>
            </div>
          {:else}
            <p class="empty-msg">Jokių ateinančių žaidimų</p>
          {/each}
        </div>
      </section>

      <section class="section-spacer">
        <h2>Naujausi Rezultatai</h2>
        <div class="match-list">
          {#each robinResults.slice().reverse().slice(0, 5) as res}
            <div class="match-item result">
              <span>{getTeamName(res.team1)} prieš {getTeamName(res.team2)}</span>
              <span class="score-tag">{res.score1} {res.score2} {res.score3}</span>
            </div>
          {/each}
        </div>
      </section>
    </div>

  {:else}
    <div class="fade-in">
      <section>
        <h2>Čempijonatas</h2>
        <div class="bracket-list">
          {#each playoffGames as pg}
            <div class="playoff-card" class:completed={pg.score1?.includes("x")}>
              <div class="pg-header">
                {pg.eval || "Playoff Match"}
                {#if !pg.score1?.includes("x")}<span class="live-pulse"></span>{/if}
              </div>
              <div class="pg-content">
                <div class="pg-row" class:winner={isWinner(pg, pg.team1)}>
                  <span>{getTeamName(pg.team1)}</span>
                  <span class="num">{setsWonBy(pg, pg.team1) || "-"}</span>
                </div>
                <div class="pg-row" class:winner={isWinner(pg, pg.team2)}>
                  <span>{getTeamName(pg.team2)}</span>
                  <span class="num">{setsWonBy(pg, pg.team2) || "-"}</span>
                </div>
              </div>
            </div>
          {:else}
            <div class="card empty-msg">
              <p>Playoffai dar neprasidėjo</p>
            </div>
          {/each}
        </div>
      </section>

      {#if playoffStandings.length > 0}
        <section class="section-spacer">
          <h2>Galutinė lentelė</h2>
          <div class="card">
            <table>
              <tbody>
                {#each playoffStandings as entry}
                  <tr
                    class:gold={entry.place === 1}
                    class:silver={entry.place === 2}
                    class:bronze={entry.place === 3}
                  >
                    <td class="place-cell">{placeLabel(entry.place)}</td>
                    <td>{getTeamName(entry.teamId)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </section>
      {/if}
    </div>
  {/if}
</main>

<style>
  :global(body) {
    background: #0f172a;
    color: #f8fafc;
    font-family: sans-serif;
    margin: 0;
  }
  main {
    max-width: 480px;
    margin: 0 auto;
    padding: 20px;
  }
  header {
    text-align: center;
    margin-bottom: 2rem;
  }
  h1 {
    margin-bottom: 1.5rem;
    font-weight: 800;
    letter-spacing: -0.05em;
  }
  .mode-toggle {
    display: flex;
    background: #1e293b;
    padding: 4px;
    border-radius: 12px;
    border: 1px solid #334155;
  }
  .mode-toggle button {
    flex: 1;
    padding: 10px;
    border: none;
    background: none;
    color: #64748b;
    font-weight: bold;
    cursor: pointer;
    border-radius: 8px;
  }
  .mode-toggle button.active {
    background: #38bdf8;
    color: #0f172a;
  }
  .card {
    background: #1e293b;
    padding: 1rem;
    border-radius: 1rem;
    border: 1px solid #334155;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  td {
    padding: 12px 0;
    border-bottom: 1px solid #334155;
  }
  .wins {
    text-align: right;
    color: #4ade80;
    font-weight: bold;
  }
  .place-cell {
    width: 2.5rem;
    font-size: 1.1rem;
  }
  tr.gold td   { color: #fbbf24; font-weight: bold; }
  tr.silver td { color: #94a3b8; font-weight: bold; }
  tr.bronze td { color: #b45309; font-weight: bold; }
  .section-spacer {
    margin-top: 2.5rem;
  }
  .match-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .match-item {
    background: #1e293b;
    padding: 16px;
    border-radius: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border: 1px solid #334155;
  }
  .match-item.upcoming {
    border-left: 4px solid #38bdf8;
  }
  .tag {
    font-size: 0.6rem;
    background: #0c4a6e;
    color: #38bdf8;
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: bold;
  }
  .score-tag {
    color: #fbbf24;
    font-family: monospace;
    font-weight: 900;
    font-size: 1.1rem;
  }
  .bracket-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .playoff-card {
    background: #1e293b;
    border-radius: 14px;
    overflow: hidden;
    border: 1px solid #334155;
  }
  .pg-header {
    background: #334155;
    padding: 8px 16px;
    font-size: 0.7rem;
    text-transform: uppercase;
    color: #94a3b8;
    display: flex;
    justify-content: space-between;
    font-weight: bold;
  }
  .pg-content {
    padding: 4px 0;
  }
  .pg-row {
    display: flex;
    justify-content: space-between;
    padding: 12px 16px;
    font-weight: 700;
  }
  .pg-row.winner {
    color: #4ade80;
  }
  .num {
    font-family: monospace;
    font-size: 1.1rem;
  }
  .live-pulse {
    color: #f87171;
    animation: pulse 1.5s infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  .empty-msg {
    text-align: center;
    color: #64748b;
    padding: 40px 20px;
  }
  .fade-in {
    animation: fadeIn 0.4s ease-out;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
</style>