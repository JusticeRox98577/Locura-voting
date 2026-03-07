export const SONGS = {
  TQMQA: ["TQMQA", "Eladio Carrion"],
  AKAKAW: ["Akakaw", "Renata Flores"],
  ANGEL: ["Angel", "Grupo Frontera & Romeo Santos"],
  TOCANDO: ["Tocando el Cielo", "Luis Fonsi"],
  REGALO: ["Regalo", "Alvaro Soler"],
  SISABES: ["Si Sabes Contar", "Los Angeles Azules, Luck Ra, Yami Safdie"],
  AMULETO: ["Amuleto", "Diego Torres"],
  NARCISISTA: ["Narcisista", "The Warning"],
  COLEC: ["Coleccionando Heridas", "Karol G & Antonis Solis"],
  PARAQUE: ["Para Que?", "Ela Taubert"],
  MUJER: ["La Mujer que Soy", "Fanny Lu"],
  BUENCAFE: ["Buen Cafe", "Efecto Pasillo"],
  GOODBYE: ["Goodbye", "Arthur Hanlon, Carlos Vives, Goyo"],
  FEB6: ["6 de Febrero", "Aitana"],
  LUNALLENA: ["Luna Llena", "Ebenezer Guerra & Elvis Crespo"],
  VUELA: ["Vuela", "Luck Ra & Ke Personaje"],
  BZRP: ["Music Sessions #66", "Daddy Yankee & BZRP"]
};

export const MATCHES = [
  { id: "L-R0", title: "Play-In Round", roundKey: "R0", a: "TQMQA", b: "AKAKAW" },
  { id: "L-R1-1", title: "Round 1 - Left", roundKey: "R1", a: "ANGEL", b: { from: "L-R0" } },
  { id: "L-R1-2", title: "Round 1 - Left", roundKey: "R1", a: "TOCANDO", b: "REGALO" },
  { id: "L-R1-3", title: "Round 1 - Left", roundKey: "R1", a: "SISABES", b: "AMULETO" },
  { id: "L-R1-4", title: "Round 1 - Left", roundKey: "R1", a: "NARCISISTA", b: "COLEC" },
  { id: "R-R1-1", title: "Round 1 - Right", roundKey: "R1", a: "PARAQUE", b: "MUJER" },
  { id: "R-R1-2", title: "Round 1 - Right", roundKey: "R1", a: "BUENCAFE", b: "GOODBYE" },
  { id: "R-R1-3", title: "Round 1 - Right", roundKey: "R1", a: "FEB6", b: "LUNALLENA" },
  { id: "R-R1-4", title: "Round 1 - Right", roundKey: "R1", a: "VUELA", b: "BZRP" },
  { id: "L-QF-1", title: "Quarterfinals - Left", roundKey: "QF", a: { from: "L-R1-1" }, b: { from: "L-R1-2" } },
  { id: "L-QF-2", title: "Quarterfinals - Left", roundKey: "QF", a: { from: "L-R1-3" }, b: { from: "L-R1-4" } },
  { id: "R-QF-1", title: "Quarterfinals - Right", roundKey: "QF", a: { from: "R-R1-1" }, b: { from: "R-R1-2" } },
  { id: "R-QF-2", title: "Quarterfinals - Right", roundKey: "QF", a: { from: "R-R1-3" }, b: { from: "R-R1-4" } },
  { id: "L-SF", title: "Semifinals", roundKey: "SF", a: { from: "L-QF-1" }, b: { from: "L-QF-2" } },
  { id: "R-SF", title: "Semifinals", roundKey: "SF", a: { from: "R-QF-1" }, b: { from: "R-QF-2" } },
  { id: "FINAL", title: "Championship Final", roundKey: "FINAL", a: { from: "L-SF" }, b: { from: "R-SF" } }
];

export const ROUND_OPTIONS = [
  { key: "R0", label: "Play-In Round" },
  { key: "R1", label: "Round 1" },
  { key: "QF", label: "Quarterfinals" },
  { key: "SF", label: "Semifinals" },
  { key: "FINAL", label: "Final" }
];

const MATCH_BY_ID = Object.fromEntries(MATCHES.map((m) => [m.id, m]));

export function resolveSlot(slot, winners) {
  if (typeof slot === "string") return slot;
  if (!slot?.from) return null;

  const prev = MATCH_BY_ID[slot.from];
  if (!prev) return null;

  const win = winners?.[slot.from];
  if (win === "A") return resolveSlot(prev.a, winners);
  if (win === "B") return resolveSlot(prev.b, winners);
  return null;
}

export function resolveMatchEntrants(match, winners) {
  const aKey = resolveSlot(match.a, winners);
  const bKey = resolveSlot(match.b, winners);
  return { aKey, bKey };
}

export function getReadyMatchesForRound(roundKey, winners) {
  return MATCHES
    .filter((m) => m.roundKey === roundKey)
    .map((m) => {
      const { aKey, bKey } = resolveMatchEntrants(m, winners);
      return { ...m, aKey, bKey, ready: !!(aKey && bKey) };
    })
    .filter((m) => m.ready);
}

export function songLabel(key) {
  const s = SONGS[key];
  if (!s) return "Waiting...";
  return `${s[0]} - ${s[1]}`;
}
