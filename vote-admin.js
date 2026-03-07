import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ROUND_OPTIONS, getReadyMatchesForRound, songLabel, resolveMatchEntrants } from "./bracket-data.js";

const SUPABASE_URL = "https://nkufgygqbzhtacvoqgmi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_jpLHfC3L8-Nvw4q4xcgTCw_Y0qA_m_0";
const ADMIN_EMAILS = ["justicemw9857@gmail.com"];
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const root = document.querySelector("#app");

const state = {
  user: null,
  winners: {},
  currentRound: null,
  selectedRound: "R0",
  selectedMatches: new Set(),
  tally: []
};

function render(html) {
  root.innerHTML = html;
}

async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data.user || null;
}

async function isTeacherOrAdmin(user) {
  const email = (user?.email || "").toLowerCase();
  if (ADMIN_EMAILS.includes(email)) return true;

  const { data } = await supabase
    .from("teacher_profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return !!data;
}

async function loadWinners() {
  const { data, error } = await supabase
    .from("results")
    .select("winners")
    .eq("id", "current")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.winners || {};
}

async function loadCurrentRound() {
  const { data, error } = await supabase.from("vote_rounds").select("*").eq("id", "current").maybeSingle();
  if (error) throw error;
  return data;
}

async function loadTally() {
  const { data, error } = await supabase.rpc("get_current_vote_tally");
  if (error) throw error;
  return data || [];
}

async function setRound(roundKey, matchIds) {
  const { data, error } = await supabase.rpc("set_current_vote_round", {
    p_round_key: roundKey,
    p_match_ids: matchIds
  });
  if (error) throw error;
  return data;
}

async function closeRound(applyResults) {
  const { data, error } = await supabase.rpc("close_current_vote_round", { p_apply_results: applyResults });
  if (error) throw error;
  return data;
}

function labelForMatch(m) {
  const resolved = resolveMatchEntrants(m, state.winners);
  if (!resolved.aKey || !resolved.bKey) return `${m.id} (not ready)`;
  return `${m.id}: ${songLabel(resolved.aKey)} vs ${songLabel(resolved.bKey)}`;
}

function renderTallyRows() {
  if (!state.tally.length) return "<p>No votes yet.</p>";

  return state.tally.map((r) => {
    const ready = getReadyMatchesForRound(state.currentRound?.round_key || "", state.winners).find((m) => m.id === r.match_id);
    const aName = ready?.aKey ? songLabel(ready.aKey) : "Song A";
    const bName = ready?.bKey ? songLabel(ready.bKey) : "Song B";
    const total = Number(r.total || 0);
    const aPct = total > 0 ? Math.round((Number(r.votes_a || 0) / total) * 100) : 0;
    const bPct = total > 0 ? Math.round((Number(r.votes_b || 0) / total) * 100) : 0;

    return `
      <div class="tallyCard">
        <div><strong>${r.match_id}</strong> <span class="small">(${total} votes)</span></div>
        <div class="tallyLine">
          <div class="small">${aName} - ${r.votes_a} (${aPct}%)</div>
          <div class="barTrack"><div class="barFill barA" style="width:${aPct}%"></div></div>
        </div>
        <div class="tallyLine">
          <div class="small">${bName} - ${r.votes_b} (${bPct}%)</div>
          <div class="barTrack"><div class="barFill barB" style="width:${bPct}%"></div></div>
        </div>
      </div>
    `;
  }).join("");
}

function syncRoundSelection() {
  const ready = getReadyMatchesForRound(state.selectedRound, state.winners);
  state.selectedMatches = new Set(ready.map((m) => m.id));
}

function renderLogin(msg = "") {
  render(`
    <div class="container">
      <h1>Voting Admin</h1>
      <input id="email" class="input" placeholder="Email" />
      <input id="pass" class="input" type="password" placeholder="Password" />
      <button id="login" class="primary">Sign in</button>
      ${msg ? `<div class="error">${msg}</div>` : ""}
    </div>
  `);

  document.querySelector("#login").onclick = async () => {
    const email = document.querySelector("#email").value.trim();
    const password = document.querySelector("#pass").value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) renderLogin(error.message);
    else init();
  };
}

function renderApp() {
  const ready = getReadyMatchesForRound(state.selectedRound, state.winners);

  let html = `
    <div class="container">
      <h1>Voting Admin</h1>
      <p><a href="/">Open student voting page</a></p>
      <p><a href="/downloads">Download saved round files</a></p>
      <button id="signout" class="danger">Sign out</button>

      <div class="card">
        <h3>Current Voting Round</h3>
        <p>${state.currentRound ? `${state.currentRound.round_key} (${state.currentRound.status})` : "No round set yet."}</p>
      </div>

      <div class="card">
        <h3>Start New Round</h3>
        <select id="roundSelect" class="input">
          ${ROUND_OPTIONS.map((r) => `<option value="${r.key}" ${state.selectedRound === r.key ? "selected" : ""}>${r.label}</option>`).join("")}
        </select>
        <p class="small">Auto-filled from current official bracket winners.</p>
        <div id="matchesList">
          ${ready.length ? ready.map((m) => `
            <label style="display:block;margin-bottom:8px;">
              <input type="checkbox" class="matchCheck" data-id="${m.id}" ${state.selectedMatches.has(m.id) ? "checked" : ""} />
              ${labelForMatch(m)}
            </label>
          `).join("") : "<p>No ready matches for this round yet.</p>"}
        </div>
        <button id="startRound" class="primary">Start Voting Round</button>
      </div>

      <div class="card">
        <h3>Close Current Round</h3>
        <button id="closeSave" class="primary">Close + Save Results</button>
        <button id="closeOnly">Close Without Saving</button>
      </div>

      <div class="card">
        <h3>Live Tally</h3>
        <button id="refreshTally">Refresh Tally</button>
        <div id="tallyWrap">
          ${renderTallyRows()}
        </div>
      </div>
    </div>
  `;

  render(html);

  document.querySelector("#signout").onclick = async () => {
    await supabase.auth.signOut();
    init();
  };

  document.querySelector("#roundSelect").onchange = (e) => {
    state.selectedRound = e.target.value;
    syncRoundSelection();
    renderApp();
  };

  document.querySelectorAll(".matchCheck").forEach((el) => {
    el.onchange = () => {
      const id = el.dataset.id;
      if (el.checked) state.selectedMatches.add(id);
      else state.selectedMatches.delete(id);
    };
  });

  document.querySelector("#startRound").onclick = async () => {
    try {
      const ids = [...state.selectedMatches];
      if (!ids.length) return alert("Select at least one match.");
      const out = await setRound(state.selectedRound, ids);
      if (!out?.ok) return alert("Could not start round: " + (out?.error || "unknown"));
      state.currentRound = await loadCurrentRound();
      state.tally = await loadTally();
      alert("Round started.");
      renderApp();
    } catch (e) {
      alert(e?.message || String(e));
    }
  };

  document.querySelector("#closeSave").onclick = async () => {
    try {
      const out = await closeRound(true);
      if (!out?.ok) return alert("Close failed: " + (out?.error || "unknown"));
      state.winners = await loadWinners();
      state.currentRound = await loadCurrentRound();
      state.tally = [];
      syncRoundSelection();
      alert("Round closed and results saved.");
      renderApp();
    } catch (e) {
      alert(e?.message || String(e));
    }
  };

  document.querySelector("#closeOnly").onclick = async () => {
    try {
      const out = await closeRound(false);
      if (!out?.ok) return alert("Close failed: " + (out?.error || "unknown"));
      state.currentRound = await loadCurrentRound();
      state.tally = [];
      alert("Round closed.");
      renderApp();
    } catch (e) {
      alert(e?.message || String(e));
    }
  };

  document.querySelector("#refreshTally").onclick = async () => {
    try {
      state.tally = await loadTally();
      renderApp();
    } catch (e) {
      alert(e?.message || String(e));
    }
  };
}

async function init() {
  const user = await getUser();
  if (!user) return renderLogin();
  state.user = user;

  const ok = await isTeacherOrAdmin(user);
  if (!ok) return renderLogin("Not a teacher/admin account.");

  state.winners = await loadWinners();
  state.currentRound = await loadCurrentRound();
  state.selectedRound = state.currentRound?.round_key || "R0";
  syncRoundSelection();
  state.tally = await loadTally().catch(() => []);
  renderApp();
}

init();
