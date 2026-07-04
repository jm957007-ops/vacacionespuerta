import { useState, useEffect, useMemo } from "react";
import { doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

const DOC_REF_PATH = ["vacaciones", "equipo"]; // colección "vacaciones", documento "equipo"
const ME_KEY = "vacaciones-equipo-mi-nombre";
const ADMIN_KEY = "vacaciones-equipo-es-admin";
const ADMIN_PASSWORD = "puerta2026"; // cámbiala antes de compartir la app

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DIAS = ["L", "M", "M", "J", "V", "S", "D"];
const PALETA = ["#1F6F6B", "#B4622C", "#5B5FA0", "#7A8B3F", "#A0507A", "#3F7CA0"];

function pad(n) { return String(n).padStart(2, "0"); }
function toKey(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
function todayKey() {
  const t = new Date();
  return toKey(t.getFullYear(), t.getMonth(), t.getDate());
}
function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function firstWeekdayMondayFirst(y, m) {
  const jsDay = new Date(y, m, 1).getDay();
  return (jsDay + 6) % 7;
}

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [members, setMembers] = useState([]);
  const [days, setDays] = useState({});
  const [me, setMe] = useState(localStorage.getItem(ME_KEY) || "");
  const [isAdmin, setIsAdmin] = useState(localStorage.getItem(ADMIN_KEY) === "true");
  const [newMemberName, setNewMemberName] = useState("");
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [pending, setPending] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const [adminInput, setAdminInput] = useState("");
  const [adminError, setAdminError] = useState("");
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  const docRef = doc(db, ...DOC_REF_PATH);

  // ---- realtime sync with Firestore ----
  useEffect(() => {
    const unsub = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setMembers(data.members || []);
          setDays(data.days || {});
        }
        setLoaded(true);
      },
      (err) => {
        console.error(err);
        setError("No se pudo conectar con la base de datos. Revisa tu configuración de Firebase.");
        setLoaded(true);
      }
    );
    return () => unsub();
  }, []);

  async function persist(nextMembers, nextDays) {
    try {
      await setDoc(docRef, { members: nextMembers, days: nextDays });
    } catch (e) {
      setError("No se pudo guardar. Revisa tu conexión o las reglas de Firestore.");
    }
  }

  function rememberMe(name) {
    setMe(name);
    localStorage.setItem(ME_KEY, name);
  }

  const memberById = useMemo(() => {
    const map = {};
    members.forEach((m) => (map[m.id] = m));
    return map;
  }, [members]);

  const myMember = useMemo(() => members.find((m) => m.name === me), [members, me]);

  function tryAdminLogin() {
    if (adminInput === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setAdminError("");
      setAdminInput("");
      setShowAdminLogin(false);
      localStorage.setItem(ADMIN_KEY, "true");
    } else {
      setAdminError("Contraseña incorrecta.");
    }
  }

  function adminLogout() {
    setIsAdmin(false);
    localStorage.setItem(ADMIN_KEY, "false");
  }

  function addMember() {
    if (!isAdmin) return;
    const name = newMemberName.trim();
    if (!name) return;
    if (members.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
      setError("Ese compañero ya está en la lista.");
      return;
    }
    const color = PALETA[members.length % PALETA.length];
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const next = [...members, { id, name, color }];
    setNewMemberName("");
    setError("");
    persist(next, days);
    if (!me) rememberMe(name);
  }

  function askRemoveMember(id) {
    if (!isAdmin) return;
    setConfirmRemoveId(id);
  }

  function cancelRemoveMember() {
    setConfirmRemoveId(null);
  }

  function removeMember(id) {
    if (!isAdmin) return;
    const target = memberById[id];
    if (!target) return;
    const nextMembers = members.filter((m) => m.id !== id);
    const nextDays = { ...days };
    Object.keys(nextDays).forEach((k) => {
      if (nextDays[k] === id) delete nextDays[k];
    });
    setConfirmRemoveId(null);
    persist(nextMembers, nextDays);
    if (me === target.name) {
      setMe("");
      localStorage.setItem(ME_KEY, "");
    }
  }

  function changeMonth(delta) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  }

  function toggleDay(dateKey) {
    setError("");
    if (!myMember) {
      setError("Primero elige quién eres arriba.");
      return;
    }
    if (days[dateKey]) return;
    setPending((prev) =>
      prev.includes(dateKey) ? prev.filter((d) => d !== dateKey) : [...prev, dateKey].sort()
    );
  }

  function cancelMyDay(dateKey) {
    if (days[dateKey] !== myMember.id) return;
    const next = { ...days };
    delete next[dateKey];
    persist(members, next);
  }

  async function confirmarSeleccion() {
    if (!myMember) {
      setError("Primero elige quién eres arriba.");
      return;
    }
    if (pending.length === 0) return;

    // revisa contra el estado más reciente en el servidor antes de guardar
    setSaving(true);
    try {
      const fresh = await getDoc(docRef);
      const freshDays = fresh.exists() ? fresh.data().days || {} : {};
      const clash = pending.filter((d) => freshDays[d]);
      if (clash.length > 0) {
        setError("Alguno de esos días ya se ocupó mientras elegías. Vuelve a intentar.");
        setPending([]);
        setSaving(false);
        return;
      }
      const next = { ...freshDays };
      pending.forEach((d) => (next[d] = myMember.id));
      setPending([]);
      await persist(members, next);
    } catch (e) {
      setError("No se pudo guardar. Intenta de nuevo.");
    }
    setSaving(false);
  }

  const gridDays = useMemo(() => {
    const total = daysInMonth(viewYear, viewMonth);
    const offset = firstWeekdayMondayFirst(viewYear, viewMonth);
    const cells = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= total; d++) cells.push(d);
    return cells;
  }, [viewYear, viewMonth]);

  const today = todayKey();
  const usedByMe = useMemo(
    () => Object.entries(days).filter(([, id]) => id === myMember?.id).length,
    [days, myMember]
  );

  if (!loaded) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.loadingText}>Cargando calendario del equipo…</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Work+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        .day-cell:hover:not(.occupied):not(.blank) { background: #EFE6D8 !important; cursor: pointer; }
        .day-cell.pending:hover { filter: brightness(0.95); }
        .day-cell.occupied.mine:hover { cursor: pointer; filter: brightness(0.93); }
        button { font-family: inherit; }
        input { font-family: inherit; }
      `}</style>

      <header style={styles.header}>
        <div>
          <div style={styles.eyebrow}>PLANEADOR DE EQUIPO</div>
          <h1 style={styles.title}>Vacaciones de Controladores de Puerta</h1>
        </div>
        <div style={styles.headerNote}>
          Cada quien elige sus días. Nadie puede tomar un día que ya esté en rojo.
        </div>
      </header>

      <section style={styles.adminBar}>
        {isAdmin ? (
          <div style={styles.adminActive}>
            <span style={styles.adminBadge}>🔑 Modo administrador activo</span>
            <button onClick={adminLogout} style={styles.adminLogoutBtn}>Salir</button>
          </div>
        ) : showAdminLogin ? (
          <div style={styles.adminLoginRow}>
            <input
              type="password"
              placeholder="Contraseña de administrador"
              value={adminInput}
              onChange={(e) => setAdminInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && tryAdminLogin()}
              style={styles.input}
            />
            <button onClick={tryAdminLogin} style={styles.addBtn}>Entrar</button>
            <button
              onClick={() => { setShowAdminLogin(false); setAdminError(""); setAdminInput(""); }}
              style={styles.confirmNoBtn}
            >
              Cancelar
            </button>
            {adminError && <span style={styles.adminErrorText}>{adminError}</span>}
          </div>
        ) : (
          <button onClick={() => setShowAdminLogin(true)} style={styles.adminLoginLink}>
            Iniciar sesión como administrador
          </button>
        )}
      </section>

      <section style={styles.identityBar}>
        <div style={styles.identityLeft}>
          <label style={styles.label}>Yo soy:</label>
          <select value={me} onChange={(e) => rememberMe(e.target.value)} style={styles.select}>
            <option value="">— elegir —</option>
            {members.map((m) => (
              <option key={m.id} value={m.name}>{m.name}</option>
            ))}
          </select>
          {myMember && (
            <span style={{ ...styles.mePill, background: myMember.color }}>
              {usedByMe} {usedByMe === 1 ? "día tomado" : "días tomados"}
            </span>
          )}
        </div>

        <div style={styles.identityRight}>
          {isAdmin && (
            <>
              <input
                placeholder="Agregar compañero…"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addMember()}
                style={styles.input}
              />
              <button onClick={addMember} style={styles.addBtn}>Agregar</button>
            </>
          )}
        </div>
      </section>

      {error && <div style={styles.errorBanner}>{error}</div>}

      {confirmRemoveId && memberById[confirmRemoveId] && (
        <div style={styles.confirmBanner}>
          <span>
            ¿Eliminar a <strong>{memberById[confirmRemoveId].name}</strong>? Sus días reservados quedarán libres para todos.
          </span>
          <span style={styles.confirmBannerActions}>
            <button onClick={() => removeMember(confirmRemoveId)} style={styles.confirmYesBtn}>
              Sí, eliminar
            </button>
            <button onClick={cancelRemoveMember} style={styles.confirmNoBtn}>
              Cancelar
            </button>
          </span>
        </div>
      )}

      <section style={styles.calendarCard}>
        <div style={styles.monthNav}>
          <button onClick={() => changeMonth(-1)} style={styles.navBtn} aria-label="Mes anterior">‹</button>
          <div style={styles.monthLabel}>{MESES[viewMonth]} {viewYear}</div>
          <button onClick={() => changeMonth(1)} style={styles.navBtn} aria-label="Mes siguiente">›</button>
        </div>

        <div style={styles.weekRow}>
          {DIAS.map((d, i) => (
            <div key={i} style={styles.weekDay}>{d}</div>
          ))}
        </div>

        <div style={styles.grid}>
          {gridDays.map((d, idx) => {
            if (d === null) {
              return <div key={idx} className="day-cell blank" style={styles.blankCell} />;
            }
            const key = toKey(viewYear, viewMonth, d);
            const ownerId = days[key];
            const owner = ownerId ? memberById[ownerId] : null;
            const isPending = pending.includes(key);
            const isToday = key === today;
            const isMine = ownerId && ownerId === myMember?.id;

            let cellStyle = { ...styles.dayCell };
            let cls = "day-cell";
            if (owner) {
              cellStyle = { ...cellStyle, ...styles.occupiedCell };
              cls += " occupied";
              if (isMine) cls += " mine";
            } else if (isPending) {
              cellStyle = { ...cellStyle, ...styles.pendingCell };
              cls += " pending";
            }
            if (isToday) cellStyle = { ...cellStyle, ...styles.todayRing };

            return (
              <div
                key={idx}
                className={cls}
                style={cellStyle}
                title={owner ? `Ocupado por ${owner.name}` : "Disponible"}
                onClick={() => (owner ? (isMine ? cancelMyDay(key) : null) : toggleDay(key))}
              >
                <span style={styles.dayNum}>{d}</span>
                {owner && <span style={styles.ownerTag}>{owner.name.split(" ")[0]}</span>}
              </div>
            );
          })}
        </div>
      </section>

      <section style={styles.footerBar}>
        <div style={styles.legend}>
          <span style={styles.legendItem}>
            <span style={{ ...styles.swatch, background: "#fff", border: "1px solid #D8CDBA" }} />
            Disponible
          </span>
          <span style={styles.legendItem}>
            <span style={{ ...styles.swatch, background: "#E8A94B" }} />
            Tu selección
          </span>
          <span style={styles.legendItem}>
            <span style={{ ...styles.swatch, background: "#C24444" }} />
            Ocupado
          </span>
        </div>

        <div style={styles.confirmArea}>
          {pending.length > 0 && (
            <span style={styles.pendingCount}>
              {pending.length} {pending.length === 1 ? "día seleccionado" : "días seleccionados"}
            </span>
          )}
          <button
            onClick={confirmarSeleccion}
            disabled={pending.length === 0 || saving}
            style={{
              ...styles.confirmBtn,
              opacity: pending.length === 0 || saving ? 0.5 : 1,
              cursor: pending.length === 0 || saving ? "default" : "pointer",
            }}
          >
            {saving ? "Guardando…" : "Confirmar mis días"}
          </button>
        </div>
      </section>

      {members.length > 0 && (
        <section style={styles.roster}>
          {members.map((m) => (
            <span key={m.id} style={{ ...styles.rosterChip, borderColor: m.color, color: m.color }}>
              ● {m.name}
              {isAdmin && (
                <button
                  onClick={() => askRemoveMember(m.id)}
                  style={styles.rosterRemoveBtn}
                  title={`Eliminar a ${m.name}`}
                  aria-label={`Eliminar a ${m.name}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </section>
      )}
    </div>
  );
}

const styles = {
  page: {
    fontFamily: "'Work Sans', sans-serif",
    background: "#FAF6EF",
    minHeight: "100vh",
    padding: "32px 20px 60px",
    color: "#2B2620",
    maxWidth: 760,
    margin: "0 auto",
  },
  loadingScreen: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#FAF6EF",
    fontFamily: "'Work Sans', sans-serif",
    color: "#8A7F6C",
  },
  loadingText: { fontSize: 15 },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    flexWrap: "wrap",
    gap: 12,
    borderBottom: "2px solid #1F6F6B",
    paddingBottom: 18,
    marginBottom: 20,
  },
  eyebrow: { fontSize: 11, letterSpacing: "0.14em", color: "#B4622C", fontWeight: 700, marginBottom: 4 },
  title: { fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 32, margin: 0, color: "#1F6F6B" },
  headerNote: { fontSize: 13, color: "#8A7F6C", maxWidth: 260, textAlign: "right" },
  adminBar: { marginBottom: 14, display: "flex", justifyContent: "flex-end" },
  adminLoginLink: { border: "none", background: "transparent", color: "#8A7F6C", fontSize: 12, textDecoration: "underline", cursor: "pointer", padding: 0 },
  adminLoginRow: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  adminErrorText: { fontSize: 12, color: "#9C3A2E" },
  adminActive: { display: "flex", alignItems: "center", gap: 10 },
  adminBadge: { fontSize: 12, fontWeight: 700, color: "#1F6F6B", background: "#E6F1EF", padding: "5px 10px", borderRadius: 999 },
  adminLogoutBtn: { border: "1px solid #D8CDBA", background: "#fff", color: "#5C5344", fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 999, cursor: "pointer" },
  identityBar: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 },
  identityLeft: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  identityRight: { display: "flex", gap: 8 },
  label: { fontSize: 13, fontWeight: 600, color: "#5C5344" },
  select: { padding: "8px 12px", borderRadius: 8, border: "1px solid #D8CDBA", background: "#fff", fontSize: 14, color: "#2B2620" },
  mePill: { fontSize: 12, fontWeight: 600, color: "#fff", padding: "5px 10px", borderRadius: 999 },
  input: { padding: "8px 12px", borderRadius: 8, border: "1px solid #D8CDBA", fontSize: 14, width: 170 },
  addBtn: { padding: "8px 14px", borderRadius: 8, border: "none", background: "#1F6F6B", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  errorBanner: { background: "#FBE4E1", color: "#9C3A2E", border: "1px solid #EFC1BA", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 },
  confirmBanner: { background: "#FFF6E6", border: "1px solid #E8CFA0", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, color: "#6B4E1F" },
  confirmBannerActions: { display: "flex", gap: 8 },
  confirmYesBtn: { padding: "6px 12px", borderRadius: 6, border: "none", background: "#C24444", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" },
  confirmNoBtn: { padding: "6px 12px", borderRadius: 6, border: "1px solid #D8CDBA", background: "#fff", color: "#5C5344", fontWeight: 600, fontSize: 12, cursor: "pointer" },
  calendarCard: { background: "#fff", borderRadius: 16, border: "1px solid #EEE4D2", padding: 20, boxShadow: "0 2px 10px rgba(43,38,32,0.04)" },
  monthNav: { display: "flex", alignItems: "center", justifyContent: "center", gap: 18, marginBottom: 14 },
  navBtn: { width: 32, height: 32, borderRadius: 8, border: "1px solid #E4D9C4", background: "#FAF6EF", fontSize: 18, lineHeight: "18px", cursor: "pointer", color: "#1F6F6B" },
  monthLabel: { fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: "#2B2620", minWidth: 170, textAlign: "center" },
  weekRow: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 6 },
  weekDay: { textAlign: "center", fontSize: 11, fontWeight: 700, color: "#B4A88E", letterSpacing: "0.06em", padding: "4px 0" },
  grid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 },
  blankCell: { minHeight: 56 },
  dayCell: { minHeight: 56, borderRadius: 10, border: "1px solid #EFE6D8", background: "#fff", padding: "6px 6px", display: "flex", flexDirection: "column", justifyContent: "space-between", transition: "background 0.12s ease" },
  pendingCell: { background: "#E8A94B", border: "1px solid #D18F32" },
  occupiedCell: { background: "#C24444", border: "1px solid #A83737" },
  todayRing: { boxShadow: "inset 0 0 0 2px #1F6F6B" },
  dayNum: { fontSize: 13, fontWeight: 600, color: "#2B2620" },
  ownerTag: { fontSize: 10, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  footerBar: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14, marginTop: 18 },
  legend: { display: "flex", gap: 16, flexWrap: "wrap" },
  legendItem: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#5C5344" },
  swatch: { width: 12, height: 12, borderRadius: 4, display: "inline-block" },
  confirmArea: { display: "flex", alignItems: "center", gap: 12 },
  pendingCount: { fontSize: 12, color: "#8A7F6C" },
  confirmBtn: { padding: "10px 20px", borderRadius: 10, border: "none", background: "#1F6F6B", color: "#fff", fontWeight: 700, fontSize: 13 },
  roster: { marginTop: 22, paddingTop: 16, borderTop: "1px dashed #E4D9C4", display: "flex", gap: 10, flexWrap: "wrap" },
  rosterChip: { fontSize: 12, fontWeight: 600, border: "1px solid", borderRadius: 999, padding: "4px 6px 4px 10px", display: "inline-flex", alignItems: "center", gap: 6 },
  rosterRemoveBtn: { border: "none", background: "transparent", color: "inherit", fontSize: 14, lineHeight: "14px", cursor: "pointer", padding: "0 2px", opacity: 0.6 },
};
