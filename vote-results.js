import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://nkufgygqbzhtacvoqgmi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_jpLHfC3L8-Nvw4q4xcgTCw_Y0qA_m_0";
const ADMIN_EMAILS = ["justicemw9857@gmail.com"];

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const root = document.querySelector("#app");

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

async function loadHistory() {
  const { data, error } = await supabase.rpc("get_vote_round_history");
  if (error) throw error;
  return data || [];
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function init() {
  try {
    const user = await getUser();
    if (!user) {
      render('<div class="container"><h1>Voting Result Files</h1><div class="card"><p>Please sign in on <a href="/admin">/admin</a> first.</p></div></div>');
      return;
    }

    const ok = await isTeacherOrAdmin(user);
    if (!ok) {
      render('<div class="container"><h1>Voting Result Files</h1><div class="error">Not a teacher/admin account.</div></div>');
      return;
    }

    const rows = await loadHistory();

    render(`
      <div class="container">
        <h1>Voting Result Files</h1>
        <p><a href="/admin">Back to admin</a></p>
        <div class="card">
          <h3>Saved Round Files</h3>
          ${rows.length ? rows.map((r) => `
            <div class="tallyCard">
              <div><strong>${r.round_key}</strong> - ${r.closed_mode} - ${new Date(r.closed_at).toLocaleString()}</div>
              <button class="primary" data-id="${r.id}">Download JSON</button>
            </div>
          `).join("") : "<p>No files yet.</p>"}
        </div>
      </div>
    `);

    rows.forEach((r) => {
      const btn = document.querySelector(`button[data-id="${r.id}"]`);
      if (!btn) return;
      btn.onclick = () => {
        const payload = {
          id: r.id,
          round_key: r.round_key,
          closed_mode: r.closed_mode,
          closed_at: r.closed_at,
          match_ids: r.match_ids,
          tally: r.tally,
          winners_snapshot: r.winners_snapshot
        };
        const stamp = String(r.closed_at || "").replace(/[.:]/g, "-");
        downloadJson(`locura-round-${r.round_key}-${stamp}.json`, payload);
      };
    });
  } catch (e) {
    render(`<div class="container"><h1>Voting Result Files</h1><div class="error">Error: ${e?.message || String(e)}</div></div>`);
  }
}

init();
