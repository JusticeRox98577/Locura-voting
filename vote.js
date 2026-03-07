import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MATCHES, resolveMatchEntrants, songLabel } from "./bracket-data.js";

const SUPABASE_URL = "https://nkufgygqbzhtacvoqgmi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_jpLHfC3L8-Nvw4q4xcgTCw_Y0qA_m_0";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const root = document.querySelector("#app");
const voted = new Set();

function render(html) {
  root.innerHTML = html;
}

async function loadWinners() {
  const { data, error } = await supabase.from("results").select("winners").eq("id", "current").single();
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

function matchById(id) {
  return MATCHES.find((m) => m.id === id) || null;
}

async function draw() {
  try {
    const [round, winners] = await Promise.all([loadCurrentRound(), loadWinners()]);

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
          <p class="small">One vote per match per IP address.</p>
        </div>
    `;

    for (const m of matches) {
      const disabled = voted.has(m.id) ? "disabled" : "";
      html += `
        <div class="card">
          <h3>${m.id}</h3>
          <div class="match">
            <button class="option" data-match="${m.id}" data-slot="A" ${disabled}>${songLabel(m.aKey)}</button>
            <button class="option" data-match="${m.id}" data-slot="B" ${disabled}>${songLabel(m.bKey)}</button>
          </div>
        </div>
      `;
    }

    html += `</div>`;
    render(html);

    document.querySelectorAll(".option").forEach((btn) => {
      btn.onclick = async () => {
        const matchId = btn.dataset.match;
        const choice = btn.dataset.slot;
        try {
          const out = await castVote(matchId, choice);
          if (!out?.ok) {
            if (out?.error === "already_voted") {
              alert("Already voted for this match from this IP.");
              voted.add(matchId);
              draw();
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

draw();
