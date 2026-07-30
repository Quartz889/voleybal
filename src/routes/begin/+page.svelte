<script lang="ts">
  import { onMount } from "svelte";

  let allGames: any[] = $state([]);
  let allTeams: any[] = $state([]);
  let adminKey = $state("");
  let newTeamName = $state("");
  let showModal = $state(false);

  // Edit Modal State
  let selectedGame = $state({
    id: "",
    team1: "",
    team2: "",
    score1: "",
    score2: "",
    score3: "",
    eval: "",
    phase: "robin",
  });
  let t1s1 = $state("");
  let t2s1 = $state("");
  let t1s2 = $state("");
  let t2s2 = $state("");
  let t1s3 = $state("");
  let t2s3 = $state("");

  const API_BASE = "https://api.quartzdev.cc";

  async function loadData() {
    const [tRes, gRes] = await Promise.all([
      fetch(`${API_BASE}/teams/get`),
      fetch(`${API_BASE}/games/get/all`),
    ]);
    if (tRes.ok) allTeams = await tRes.json();
    if (gRes.ok) allGames = await gRes.json();
  }

  async function addTeam() {
    if (!newTeamName) return;
    await fetch(`${API_BASE}/teams/add?key=` + adminKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTeamName }),
    });
    newTeamName = "";
    await loadData();
  }

  async function runPhase(endpoint: string, msg: string) {
    //if (adminKey !== "61") return alert("Invalid Admin Key");
    if (!confirm(msg)) return;

    const res = await fetch(`${API_BASE}/root/${endpoint}?key=` + adminKey, {
      method: "POST",
    });

    if (res.ok) {
      // THIS LINE IS CRITICAL:
      await loadData();
      alert("Action completed!");
    }
  }

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
  async function triggerBackup() {
    if (!adminKey) return alert("Enter Admin Key first!");

    try {
      const res = await fetch(`${API_BASE}/root/backup?key=${adminKey}`, {
        method: "POST",
      });

      if (res.ok) {
        alert("Manual backup created successfully!");
      } else {
        const err = await res.json();
        alert("Backup failed: " + (err.detail || "Unauthorized"));
      }
    } catch (e) {
      alert("Server connection error");
    }
  }

  async function saveMatch() {
    //if (adminKey !== "61") return alert("Key required");

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

    const res = await fetch(`${API_BASE}/games/update?key=` + adminKey, {
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

<main class="admin-wrap">
  <div class="auth-bar">
    <input
      type="password"
      bind:value={adminKey}
      placeholder="Enter Key to Unlock Actions"
    />
    <span class="status-dot" class:unlocked={adminKey === "6"}></span>
  </div>

  <div class="admin-grid">
    <section class="panel">
      <h3>Komandos ({allTeams.length})</h3>
      <div class="add-box">
        <input bind:value={newTeamName} placeholder="Komandos pavadinimas" />
        <button onclick={addTeam}>Pridėti</button>
      </div>
      <div class="team-list">
        {#each allTeams as team}
          <div class="team-item">{team.name} <small>#{team.id}</small></div>
        {/each}
      </div>
    </section>

    <section class="panel">
      <h3>Veiksmai</h3>
      <div class="action-grid">
        <button
          class="danger"
          onclick={() =>
            runPhase("generate-robin", "Trinti viską ir pradėti iš naujo?")}
        >
          Pradėti iš naujo
        </button>
        <button
          class="success"
          onclick={() => runPhase("seed-playoffs", "Generuoti playofus?")}
        >
          Generuoti playofus
        </button>
        <button class="btn-backup" onclick={triggerBackup}>
          Atsarginė kopija
        </button>
      </div>

      <h3 style="margin-top: 2rem;">Žaidimai</h3>
      <div class="match-grid">
        {#each allGames as g}
          <button class="match-card" onclick={() => openEdit(g)}>
            <div class="m-head">
              <span class="tag {g.phase}">{g.phase}</span>
              <span class="m-id">#{g.id}</span>
            </div>
            <div class="m-teams">
              {allTeams.find((t) => String(t.id) === String(g.team1))?.name ||
                "TBD"}
              <span class="vs">vs</span>
              {allTeams.find((t) => String(t.id) === String(g.team2))?.name ||
                "TBD"}
            </div>
            {#if g.score1}<div class="m-score">{g.score1}</div>{/if}
          </button>
        {/each}
      </div>
    </section>
  </div>

  {#if showModal}
    <div class="modal">
      <h4>Pakeisti žaidimą #{selectedGame.id}</h4>
      <div class="score-grid">
        <div class="s-input">
          Setas 1 <input type="number" bind:value={t1s1} /> x
          <input type="number" bind:value={t2s1} />
        </div>
        <div class="s-input">
          Setas 2 <input type="number" bind:value={t1s2} /> x
          <input type="number" bind:value={t2s2} />
        </div>
        <div class="s-input">
          Setas 3 <input type="number" bind:value={t1s3} /> x
          <input type="number" bind:value={t2s3} />
        </div>
      </div>
      <div class="modal-actions">
        <button class="save" onclick={saveMatch}>Išsaugoti</button>
        <button class="close" onclick={() => (showModal = false)}
          >Atšaukti</button
        >
      </div>
    </div>
    <div
      class="backdrop"
      onclick={() => (showModal = false)}
      onkeydown={(e) => e.key === "Escape" && (showModal = false)}
      role="presentation"
    ></div>
  {/if}
</main>

<style>
  :global(body) {
    background: #0f172a;
    color: white;
    font-family: sans-serif;
    margin: 0;
  }
  .admin-wrap {
    max-width: 1000px;
    margin: 0 auto;
    padding: 20px;
  }

  .auth-bar {
    background: #1e293b;
    padding: 10px 20px;
    border-radius: 10px;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 15px;
  }
  .auth-bar input {
    background: #0f172a;
    border: 1px solid #334155;
    color: white;
    padding: 8px;
    border-radius: 6px;
    flex: 1;
  }
  .status-dot {
    width: 12px;
    height: 12px;
    background: #ef4444;
    border-radius: 50%;
  }
  .status-dot.unlocked {
    background: #22c55e;
    box-shadow: 0 0 10px #22c55e;
  }

  .admin-grid {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 20px;
  }
  .panel {
    background: #1e293b;
    padding: 20px;
    border-radius: 12px;
  }

  .add-box {
    display: flex;
    gap: 5px;
    margin-bottom: 15px;
  }
  .add-box input {
    flex: 1;
    background: #0f172a;
    border: 1px solid #334155;
    color: white;
    padding: 8px;
    border-radius: 6px;
  }

  .team-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .team-item {
    background: #334155;
    padding: 10px;
    border-radius: 8px;
    display: flex;
    justify-content: space-between;
  }

  .action-grid {
    display: flex;
    gap: 10px;
  }
  .action-grid button {
    flex: 1;
    padding: 12px;
    border: none;
    border-radius: 8px;
    font-weight: bold;
    cursor: pointer;
  }
  .danger {
    background: #ef4444;
    color: white;
  }
  .success {
    background: #22c55e;
    color: white;
  }

  .match-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 10px;
    margin-top: 10px;
  }
  .match-card {
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 12px;
    color: white;
    text-align: left;
    cursor: pointer;
  }
  .m-head {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .tag {
    font-size: 0.6rem;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .tag.robin {
    background: #3b82f6;
  }
  .tag.playoffs {
    background: #ec4899;
  }
  .vs {
    color: #64748b;
    font-size: 0.8rem;
  }
  .m-score {
    margin-top: 8px;
    color: #fbbf24;
    font-family: monospace;
    font-weight: bold;
  }

  .modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #1e293b;
    padding: 25px;
    border-radius: 15px;
    z-index: 100;
    width: 320px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
  }
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    z-index: 50;
  }
  .score-grid {
    background: #0f172a;
    padding: 15px;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .s-input {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .s-input input {
    width: 50px;
    text-align: center;
    padding: 5px;
    background: #1e293b;
    border: 1px solid #334155;
    color: white;
  }

  .modal-actions {
    margin-top: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .modal-actions button {
    padding: 12px;
    border-radius: 8px;
    border: none;
    font-weight: bold;
    cursor: pointer;
  }
  .save {
    background: #38bdf8;
    color: #0f172a;
  }
  .close {
    background: #475569;
    color: white;
  }

  @media (max-width: 800px) {
    .admin-grid {
      grid-template-columns: 1fr;
    }
  }
  .button-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 1rem;
  }

  button {
    padding: 12px;
    border-radius: 8px;
    border: none;
    font-weight: bold;
    cursor: pointer;
    transition: transform 0.1s;
  }

  button:active {
    transform: scale(0.98);
  }

  .btn-seed {
    background: #38bdf8;
    color: #0f172a;
  }

  .btn-backup {
    background: #475569; /* Slate gray color */
    color: white;
  }

  .btn-backup:hover {
    background: #64748b;
  }
</style>
