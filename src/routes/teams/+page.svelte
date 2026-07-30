<script lang="ts">
  let newTeamName: string = $state("");
  let password: string = $state("");
  let teams: any[] = $state([]);

  async function addTeam() {
    if (!newTeamName) return;
    const res = await fetch("https://api.quartzdev.cc/teams?key=" + password, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTeamName }),
    });
    if (!res.ok) {
      alert("Nepavyko pridėti komandos");
      return;
    }
    newTeamName = "";
    await fetchTeams();
  }

  async function fetchTeams() {
    const res = await fetch("https://api.quartzdev.cc/teams/get");
    if (res.ok) teams = await res.json();
  }

  fetchTeams();
</script>

<main class="wrap">
  <div class="grid">

    <section class="panel">
      <h3>Pridėti komandą</h3>
      <div class="auth-bar">
        <input type="password" bind:value={password} placeholder="Raktas" />
      </div>
      <div class="add-box">
        <input type="text" bind:value={newTeamName} placeholder="Komandos pavadinimas" />
        <button onclick={addTeam}>Pridėti</button>
      </div>
    </section>

    <section class="panel">
      <h3>Komandos ({teams.length})</h3>
      <div class="team-list">
        {#each teams as team}
          <div class="team-item">
            {team.name}
            <small>#{team.id}</small>
          </div>
        {:else}
          <p class="empty">Nėra komandų</p>
        {/each}
      </div>
      <button class="refresh" onclick={fetchTeams}>Atnaujinti</button>
    </section>

  </div>
</main>

<style>
  :global(body) {
    background: #0f172a;
    color: white;
    font-family: sans-serif;
    margin: 0;
  }

  .wrap {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
  }

  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }

  .panel {
    background: #1e293b;
    padding: 20px;
    border-radius: 12px;
  }

  .panel h3 {
    margin: 0 0 16px;
    color: #94a3b8;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .auth-bar {
    margin-bottom: 10px;
  }

  .auth-bar input,
  .add-box input {
    width: 100%;
    background: #0f172a;
    border: 1px solid #334155;
    color: white;
    padding: 8px 10px;
    border-radius: 6px;
    box-sizing: border-box;
  }

  .add-box {
    display: flex;
    gap: 8px;
  }

  .add-box input {
    flex: 1;
  }

  .add-box button {
    background: #38bdf8;
    color: #0f172a;
    border: none;
    padding: 8px 14px;
    border-radius: 6px;
    font-weight: bold;
    cursor: pointer;
    white-space: nowrap;
  }

  .add-box button:hover {
    background: #7dd3fc;
  }

  .team-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 12px;
  }

  .team-item {
    background: #334155;
    padding: 10px;
    border-radius: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .team-item small {
    color: #64748b;
  }

  .empty {
    color: #475569;
    font-size: 0.9rem;
  }

  .refresh {
    width: 100%;
    background: #475569;
    color: white;
    border: none;
    padding: 10px;
    border-radius: 8px;
    font-weight: bold;
    cursor: pointer;
  }

  .refresh:hover {
    background: #64748b;
  }

  @media (max-width: 600px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>