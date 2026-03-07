# Locura-voting

Standalone voting site for `voting.locurademarzo.org`.

Routes:
- `/` student voting page
- `/admin` teacher/admin round manager

This app uses Supabase RPC functions and tables:
- `vote_rounds`
- `vote_votes`
- `set_current_vote_round`
- `cast_vote`
- `get_current_vote_tally`
- `close_current_vote_round`
