import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MATCHES, resolveMatchEntrants, songLabel } from "./bracket-data.js";

const SUPABASE_URL = "https://nkufgygqbzhtacvoqgmi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_jpLHfC3L8-Nvw4q4xcgTCw_Y0qA_m_0";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const root = document.querySelector("#app");
const voted = new Set();
let currentUser = null;
let authBootstrapped = false;

function render(html) {
  root.innerHTML = html;
}

async function loadCurrentUser() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.user ?? null;
}

async function signIn() {
  const redirectTo = new URL(window.location.href);
  redirectTo.hash = "";
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: redirectTo.toString() }
  });
}

async function signOut() {
  await supabase.auth.signOut();
  currentUser = null;
  draw();
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

async function castVote(matchId, choice) {
  const { data, error } = await supabase.rpc("cast_vote", { p_match_id: matchId, p_choice: choice });
  if (error) throw error;
  return data;
}

async function loadPublicTally() {
  const { data, error } = await supabase.rpc("get_public_vote_tally");
  if (error) throw error;
  return data || [];
}

function matchById(id) {
  return MATCHES.find((m) => m.id === id) || null;
}

async function draw() {
  try {
    currentUser = await loadCurrentUser();
    const [round, winners, tallyRows] = await Promise.all([loadCurrentRound(), loadWinners(), loadPublicTally().catch(() => [])]);
    const tallyByMatch = Object.fromEntries(tallyRows.map((r) => [r.match_id, r]));

    if (!round || round.status !== "open") {
      render(`
        <div class="container">
          <h1>Locura Voting</h1>
          <div class="card"><p>Voting is currently closed.</p></div>
        </div>
      `);
      return;
    }

    const ids = Array.isArray(round.match_ids) ? round.match_ids : [];
    const matches = ids
      .map((id) => matchById(id))
      .filter(Boolean)
      .map((m) => ({ ...m, ...resolveMatchEntrants(m, winners) }))
      .filter((m) => m.aKey && m.bKey);

    let html = `
      <div class="container">
        <h1>Locura Voting</h1>
        <div class="card">
          <p><strong>Current round:</strong> ${round.round_key}</p>
          <p class="small">One vote per match per signed-in student account.</p>
          <p class="small">${currentUser ? `Signed in as ${currentUser.email}` : "Sign in with Google to vote."}</p>
          <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">
            <button class="primary" id="authBtn">${currentUser ? "Sign out" : "Sign in with Google"}</button>
          </div>
        </div>
    `;

    for (const m of matches) {
      const disabled = voted.has(m.id) ? "disabled" : "";
      const t = tallyByMatch[m.id] || { votes_a: 0, votes_b: 0, total: 0 };
      const total = Number(t.total || 0);
      const aPct = total > 0 ? Math.round((Number(t.votes_a || 0) / total) * 100) : 0;
      const bPct = total > 0 ? Math.round((Number(t.votes_b || 0) / total) * 100) : 0;
      html += `
        <div class="card">
          <h3>${m.id}</h3>
          <div class="match">
            <button class="option" data-match="${m.id}" data-slot="A" ${disabled}>${songLabel(m.aKey)}</button>
            <button class="option" data-match="${m.id}" data-slot="B" ${disabled}>${songLabel(m.bKey)}</button>
          </div>
          <div class="tallyLine">
            <div class="small">${songLabel(m.aKey)} - ${t.votes_a} (${aPct}%)</div>
            <div class="barTrack"><div class="barFill barA" style="width:${aPct}%"></div></div>
          </div>
          <div class="tallyLine">
            <div class="small">${songLabel(m.bKey)} - ${t.votes_b} (${bPct}%)</div>
            <div class="barTrack"><div class="barFill barB" style="width:${bPct}%"></div></div>
          </div>
        </div>
      `;
    }

    html += `</div>`;
    render(html);

    document.querySelector("#authBtn").onclick = async () => {
      try {
        if (currentUser) await signOut();
        else await signIn();
      } catch (e) {
        alert("Auth failed: " + (e?.message || String(e)));
      }
    };

    document.querySelectorAll(".option").forEach((btn) => {
      btn.onclick = async () => {
        if (!currentUser) {
          alert("Sign in with Google before voting.");
          return;
        }
        const matchId = btn.dataset.match;
        const choice = btn.dataset.slot;
        try {
          const out = await castVote(matchId, choice);
          if (!out?.ok) {
            if (out?.error === "already_voted") {
              alert("You already voted for this match.");
              voted.add(matchId);
              draw();
              return;
            }
            if (out?.error === "auth_required") {
              alert("Sign in with Google before voting.");
              return;
            }
            alert("Vote failed: " + (out?.error || "unknown"));
            return;
          }
          voted.add(matchId);
          alert("Vote saved.");
          draw();
        } catch (e) {
          alert("Vote failed: " + (e?.message || String(e)));
        }
      };
    });
  } catch (e) {
    render(`
      <div class="container">
        <h1>Locura Voting</h1>
        <div class="error">Error: ${e?.message || String(e)}</div>
      </div>
    `);
  }
}

if (!authBootstrapped) {
  authBootstrapped = true;
  supabase.auth.onAuthStateChange(() => {
    draw();
  });
}

draw();
