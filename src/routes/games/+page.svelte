<script lang="ts">
  import { onMount } from "svelte";

  let allGames: any[] = $state([]);
  let allTeams: any[] = $state([]);
  let filter: "all" | "robin" | "playoffs" = $state("all");
  let adminKey = $state("");
  let showModal = $state(false);

  // Modal state for quick-editing scores
  let selectedGame = $state({
    id: "",
    team1: "",
    team2: "",
    score1: "",
    score2: "",
    score3: "",
    eval: "",
    phase: "",
  });
  let t1s1 = $state("");
  let t2s1 = $state("");
  let t1s2 = $state("");
  let t2s2 = $state("");
  let t1s3 = $state("");
  let t2s3 = $state("");

  const API_BASE = "http://api.quartzdev.cc";

  async function loadData() {
    const savedKey = localStorage.getItem("voley_admin_key");
    if (savedKey) adminKey = savedKey;

    const [tRes, gRes] = await Promise.all([
      fetch(`${API_BASE}/teams/get`),
      fetch(`${API_BASE}/games/get/all`),
    ]);
    if (tRes.ok) allTeams = await tRes.json();
    if (gRes.ok) allGames = await gRes.json();
  }

  function getTeamName(id: string) {
    if (!id || id === "TBD") return "TBD";
    return allTeams.find((t) => String(t.id) === String(id))?.name || "TBD";
  }

  let filteredGames = $derived(
    filter === "all" ? allGames : allGames.filter((g) => g.phase === filter),
  );

  function openEdit(game: any) {
    // 1. Ensure we have a clean object with fallbacks for every field
    selectedGame = {
      id: game.id ?? "",
      team1: game.team1 ?? "",
      team2: game.team2 ?? "",
      score1: game.score1 ?? "",
      score2: game.score2 ?? "",
      score3: game.score3 ?? "",
      eval: game.eval ?? "",
      phase: game.phase ?? "robin", // Default to robin if the file lost it
    };

    // 2. Helper to split scores safely
    const splitScore = (scoreStr: string) => {
      if (!scoreStr || !scoreStr.includes("x")) return ["", ""];
      return scoreStr.split("x");
    };

    // 3. Map the split scores to your bound variables
    const [s1a, s1b] = splitScore(selectedGame.score1);
    const [s2a, s2b] = splitScore(selectedGame.score2);
    const [s3a, s3b] = splitScore(selectedGame.score3);

    t1s1 = s1a;
    t2s1 = s1b;
    t1s2 = s2a;
    t2s2 = s2b;
    t1s3 = s3a;
    t2s3 = s3b;

    showModal = true;
  }

  async function saveMatch() {
    if (adminKey !== "67") return alert("Key required");

    // Create the object to send to the backend
    const updatedGame = {
      id: String(selectedGame.id),
      team1: String(selectedGame.team1),
      team2: String(selectedGame.team2),
      score1: t1s1 || t2s1 ? `${t1s1}x${t2s1}` : "",
      score2: t1s2 || t2s2 ? `${t1s2}x${t2s2}` : "",
      score3: t1s3 || t2s3 ? `${t1s3}x${t2s3}` : "",
      eval: selectedGame.eval || "", // Match Name (e.g., "Match 1")
      phase: selectedGame.phase || "robin", // CRITICAL: This was being dropped
    };

    const res = await fetch(`${API_BASE}/games/update?key=67`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedGame),
    });

    if (res.ok) {
      showModal = false;
      await loadData();
    }
  }

  onMount(loadData);
</script>

<main class="games-container">
  <header>
    <div class="top-nav">
      <a href="/" class="back-link">← Atgal</a>
      <div class="key-input">
        <span>Key:</span>
        <input
          type="password"
          bind:value={adminKey}
          oninput={(e) =>
            localStorage.setItem("voley_admin_key", e.currentTarget.value)}
          placeholder=""
        />
      </div>
    </div>
    <h1>Tvarkaraštis</h1>
    <div class="filter-bar">
      <button class:active={filter === "all"} onclick={() => (filter = "all")}
        >All</button
      >
      <button
        class:active={filter === "robin"}
        onclick={() => (filter = "robin")}>Robinai</button
      >
      <button
        class:active={filter === "playoffs"}
        onclick={() => (filter = "playoffs")}>Playofai</button
      >
    </div>
  </header>

  <div class="games-list">
    {#each filteredGames as g}
      <button class="game-card" onclick={() => openEdit(g)}>
        <div class="card-meta">
          <span class="phase-tag {g.phase}">{g.phase}</span>
          <span class="edit-hint">Spausk kad pakeisti</span>
        </div>
        <div class="matchup">
          <span class="team-name">{getTeamName(g.team1)}</span>
          <span class="score-display">{g.score1 || "VS"}</span>
          <span class="team-name">{getTeamName(g.team2)}</span>
        </div>
        {#if g.eval}<div class="footer">{g.eval}</div>{/if}
      </button>
    {/each}
  </div>
</main>

{#if showModal}
  <div class="modal-overlay">
    <div class="modal">
      <h2>Atnaujinti rezultatą</h2>
      <div class="score-group">
        <div class="s-row">
          Pirmas setas: <input type="number" bind:value={t1s1} /> x
          <input type="number" bind:value={t2s1} />
        </div>
        <div class="s-row">
          Antras setas: <input type="number" bind:value={t1s2} /> x
          <input type="number" bind:value={t2s2} />
        </div>
        <div class="s-row">
          Trečias setas: <input type="number" bind:value={t1s3} /> x
          <input type="number" bind:value={t2s3} />
        </div>
      </div>
      <div class="actions">
        <button class="save" onclick={saveMatch}>Išsaugoti</button>
        <button class="cancel" onclick={() => (showModal = false)}
          >Atšaukti</button
        >
      </div>
    </div>
  </div>
{/if}

<style>
  :global(body) {
    background: #0f172a;
    color: white;
    font-family: sans-serif;
    margin: 0;
  }
  .games-container {
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
  }

  .top-nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }
  .back-link {
    color: #38bdf8;
    text-decoration: none;
    font-size: 0.9rem;
  }
  .key-input {
    display: flex;
    gap: 5px;
    align-items: center;
    background: #1e293b;
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid #334155;
  }
  .key-input input {
    background: transparent;
    border: none;
    color: white;
    width: 40px;
    text-align: center;
    font-weight: bold;
  }

  .filter-bar {
    display: flex;
    gap: 10px;
    margin: 20px 0;
  }
  .filter-bar button {
    flex: 1;
    padding: 10px;
    border-radius: 8px;
    border: 1px solid #334155;
    background: #1e293b;
    color: #94a3b8;
    cursor: pointer;
  }
  .filter-bar button.active {
    background: #38bdf8;
    color: #0f172a;
    border-color: #38bdf8;
    font-weight: bold;
  }

  .games-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .game-card {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 16px;
    text-align: left;
    color: white;
    cursor: pointer;
    width: 100%;
  }

  .card-meta {
    display: flex;
    justify-content: space-between;
    margin-bottom: 12px;
  }
  .phase-tag {
    font-size: 0.6rem;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 4px;
    background: #334155;
  }
  .edit-hint {
    font-size: 0.65rem;
    color: #475569;
  }

  .matchup {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: bold;
    font-size: 1.1rem;
  }
  .score-display {
    color: #fbbf24;
    font-family: monospace;
  }
  .footer {
    margin-top: 10px;
    font-size: 0.8rem;
    color: #64748b;
    text-align: center;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    display: grid;
    place-items: center;
    z-index: 100;
  }
  .modal {
    background: #1e293b;
    padding: 25px;
    border-radius: 16px;
    width: 300px;
    border: 1px solid #334155;
  }
  .score-group {
    background: #0f172a;
    padding: 15px;
    border-radius: 10px;
    margin: 15px 0;
  }
  .s-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    align-items: center;
  }
  .s-row input {
    width: 50px;
    text-align: center;
    background: #1e293b;
    border: 1px solid #334155;
    color: white;
    padding: 5px;
  }

  .actions {
    display: flex;
    gap: 10px;
  }
  .actions button {
    flex: 1;
    padding: 12px;
    border-radius: 8px;
    border: none;
    font-weight: bold;
    cursor: pointer;
  }
  .save {
    background: #22c55e;
    color: #052e16;
  }
  .cancel {
    background: #334155;
    color: white;
  }
</style>
