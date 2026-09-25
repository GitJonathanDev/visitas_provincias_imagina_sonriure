import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import {
  Search, Plus, MapPin, MessageCircle, Camera, Eye, Pencil, Trash2,
  BarChart3, ClipboardList, Map, Menu, X, Check, Users, CalendarDays,
  RefreshCw, Filter, ExternalLink, Package, CalendarRange, ChevronRight,
  ArrowLeft, Phone, Building2, Stethoscope, Pill, Wrench, Settings2,
  LogOut, Mail, LockKeyhole, UserCircle2, ShieldCheck, PanelLeftClose, PanelLeftOpen, ScrollText, KeyRound, LocateFixed, Navigation, MapPinned
} from "lucide-react";
import "./styles.css";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const LOGO_URL = `${import.meta.env.BASE_URL}logo-imagina.png`;

const TIPOS = ["Dentista", "Técnico", "Hospital", "Farmacia"];
const VISITADO = ["Sonriure", "Imagina", "Ambos"];
const ESTADOS = [
  "Visitado", "Visitado (interesado Imagina)", "Visitado (interesado Sonriure)",
  "Visitado (interesado Ambos)", "Cerrado por visitar", "No visitado", "Visitado (no interesado)"
];
const PEDIDO_ESTADOS = ["Pendiente", "En proceso", "Entregado", "Cancelado"];

const estadoClass = e => ({
  "Visitado": "visited", "Visitado (interesado Imagina)": "imagine",
  "Visitado (interesado Sonriure)": "sonriure", "Visitado (interesado Ambos)": "both",
  "Cerrado por visitar": "closed", "No visitado": "notvisited", "Visitado (no interesado)": "uninterested"
}[e] || "");

const tipoClass = t => ({ Dentista: "dentista", Técnico: "tecnico", Hospital: "hospital", Farmacia: "farmacia" }[t] || "");
const tipoIcon = t => ({ Dentista: <Stethoscope />, Técnico: <Wrench />, Hospital: <Building2 />, Farmacia: <Pill /> }[t] || <Users />);

const emptyVisit = {
  id: null, localidad_id: "", cod: null, nombre_completo: "", numero: "", tipo: "Dentista",
  descripcion_interes: "", visitado_como: "Imagina", estado: "No visitado", revisado_call_center: false,
  fecha_visita: "", ubicacion: "", observaciones: "", foto_url: ""
};
const emptyPedido = {
  id: null, cod: null, visita_id: "", localidad_id: "", descripcion: "", cantidad: 1,
  estado: "Pendiente", fecha: new Date().toISOString().slice(0, 10), observaciones: ""
};

function wa(n) {
  const d = (n || "").replace(/\D/g, "");
  return d ? `https://wa.me/${d.startsWith("591") ? d : "591" + d}` : "#";
}
function maps(u) { return u?.trim() || "#"; }
function formatDate(d) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return y && m && day ? `${day}/${m}/${y}` : d;
}
function numericCod(v) { return Number(v?.cod || 0); }
function effectiveLocalityId(p, visitas) { return p.localidad_id || visitas.find(v => v.id === p.visita_id)?.localidad_id || ""; }

function App({ session, onSignOut }) {
  const [tab, setTab] = useState("visitas");
  const [localidades, setLocalidades] = useState([]);
  const [localidad, setLocalidad] = useState(null);
  const [visitas, setVisitas] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [search, setSearch] = useState("");
  const [visitFilters, setVisitFilters] = useState({ call: "todos", tipo: "todos", visitado: "todos", estado: "todos" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("imagine_sidebar_collapsed") === "1");
  const [logsUnlocked, setLogsUnlocked] = useState(false);
  const [logsCode, setLogsCode] = useState("");
  const [deleteRequest, setDeleteRequest] = useState(null);
  const loadAttemptRef = useRef(0);

  const configured = !!supabase;
  useEffect(() => { localStorage.setItem("imagine_sidebar_collapsed", sidebarCollapsed ? "1" : "0"); }, [sidebarCollapsed]);
  useEffect(() => { loadAll(); }, []);
  useEffect(() => { const fn = e => setModal({ type: "detail", data: e.detail }); window.addEventListener("open-visit-detail", fn); return () => window.removeEventListener("open-visit-detail", fn); }, []);

  async function loadAll(attempt = 0) {
    if (!supabase) { setLoading(false); return; }
    const requestId = ++loadAttemptRef.current;
    setLoading(true);
    if (attempt === 0) setError("");

    // A veces Supabase puede responder momentáneamente antes de que la sesión
    // termine de estar disponible o por una conexión intermitente. Reintentamos
    // automáticamente y nunca sustituimos datos válidos por arrays vacíos.
    const [lr, vr, pr] = await Promise.all([
      supabase.from("localidades").select("*").eq("activo", true).order("nombre"),
      supabase.from("visitas").select("*").order("cod", { ascending: true }),
      supabase.from("pedidos").select("*").order("fecha", { ascending: false }).order("cod", { ascending: true })
    ]);

    if (requestId !== loadAttemptRef.current) return;

    const errors = [lr.error, vr.error, pr.error].filter(Boolean);
    if (errors.length) {
      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        return loadAll(attempt + 1);
      }
      setError(errors.map(e => e.message).join(" · "));
      setLoading(false);
      return;
    }

    const ls = lr.data || [];
    setLocalidades(ls);
    setVisitas(vr.data || []);
    setPedidos(pr.data || []);
    setLocalidad(prev => prev && ls.some(l => l.id === prev.id) ? prev : (ls[0] || null));
    setLoading(false);
  }

  async function saveVisit(v) {
    if (!supabase) return;
    const payload = { ...v };
    delete payload.id;
    delete payload.cod;
    delete payload.codigo;
    const result = v.id
      ? await supabase.from("visitas").update(payload).eq("id", v.id)
      : await supabase.from("visitas").insert(payload);
    if (result.error) return setError(result.error.message);
    setModal(null); await loadAll();
  }

  async function quickVisit(id, field, value) {
    if (!supabase) return;
    const { error: updateError } = await supabase.from("visitas").update({ [field]: value }).eq("id", id);
    if (updateError) { setError(updateError.message); return; }
    setVisitas(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v));
  }

  async function savePedido(p) {
    if (!supabase) return;
    const payload = { ...p };
    delete payload.id;
    delete payload.cod;
    if (payload.cantidad !== "") payload.cantidad = Number(payload.cantidad || 1);
    const result = p.id
      ? await supabase.from("pedidos").update(payload).eq("id", p.id)
      : await supabase.from("pedidos").insert(payload);
    if (result.error) { setError(result.error.message); return; }
    setModal(null);
    await loadAll();
  }

  async function addLocalidad() {
    if (!supabase) return;
    const nombre = window.prompt("Nombre de la nueva localidad:", "");
    if (nombre === null) return;
    const clean = nombre.trim();
    if (!clean) return;
    const { error: insertError } = await supabase.from("localidades").insert({ nombre: clean, activo: true });
    if (insertError) { setError(insertError.message); return; }
    await loadAll();
  }

  async function editLocalidad(l) {
    if (!supabase) return;
    const nombre = window.prompt("Editar nombre de la localidad:", l.nombre || "");
    if (nombre === null) return;
    const clean = nombre.trim();
    if (!clean || clean === l.nombre) return;
    const { error: updateError } = await supabase.from("localidades").update({ nombre: clean }).eq("id", l.id);
    if (updateError) { setError(updateError.message); return; }
    await loadAll();
  }

  async function verifyCode(code) {
    if (!supabase || !code) return false;
    const { data, error: rpcError } = await supabase.rpc("verify_logs_access", { p_code: code });
    if (rpcError) { setError(rpcError.message); return false; }
    return data === true;
  }

  function requestDelete(kind, item) {
    setDeleteRequest({ kind, item });
  }

  async function performDelete(kind, item, code) {
    if (!supabase) return;
    const fn = kind === "visita" ? "delete_visit_with_code" : kind === "pedido" ? "delete_pedido_with_code" : "delete_localidad_with_code";
    const arg = kind === "localidad" ? { p_id: item.id, p_code: code } : { p_id: item.id, p_code: code };
    const { error: rpcError } = await supabase.rpc(fn, arg);
    if (rpcError) { setError(rpcError.message); return; }
    setDeleteRequest(null);
    await loadAll();
  }

  async function deleteLocalidad(l) {
    if (!supabase) return;
    const visitCount = visitas.filter(v => v.localidad_id === l.id).length;
    const orderCount = pedidos.filter(p => effectiveLocalityId(p, visitas) === l.id).length;
    if (visitCount || orderCount) {
      return setError(`No se puede eliminar ${l.nombre}: tiene ${visitCount} visita(s) y ${orderCount} pedido(s).`);
    }
    requestDelete("localidad", l);
  }

  const pedidosCountByVisita = useMemo(() => {
    const map = {};
    pedidos.forEach(p => { if (p.visita_id) map[p.visita_id] = (map[p.visita_id] || 0) + 1; });
    return map;
  }, [pedidos]);

  const currentVisits = useMemo(() => visitas.filter(v => v.localidad_id === localidad?.id), [visitas, localidad]);
  const visitIndexMap = useMemo(() => Object.fromEntries([...currentVisits].sort((a,b)=>numericCod(a)-numericCod(b)).map((v,i)=>[v.id,i+1])), [currentVisits]);
  const filteredVisits = useMemo(() => currentVisits.filter(v => {
    const q = search.toLowerCase().trim();
    if (q && !`${v.cod} ${v.codigo || ""} ${v.nombre_completo} ${v.numero} ${v.tipo} ${v.estado} ${v.visitado_como}`.toLowerCase().includes(q)) return false;
    if (visitFilters.call === "si" && !v.revisado_call_center) return false;
    if (visitFilters.call === "no" && v.revisado_call_center) return false;
    if (visitFilters.tipo !== "todos" && v.tipo !== visitFilters.tipo) return false;
    if (visitFilters.visitado !== "todos" && v.visitado_como !== visitFilters.visitado) return false;
    if (visitFilters.estado !== "todos" && v.estado !== visitFilters.estado) return false;
    return true;
  }).sort((a, b) => numericCod(a) - numericCod(b)), [currentVisits, search, visitFilters]);

  const counts = useMemo(() => ({
    total: currentVisits.length,
    visitados: currentVisits.filter(v => v.estado?.startsWith("Visitado")).length,
    no: currentVisits.filter(v => v.estado === "No visitado" || v.estado === "Cerrado por visitar").length,
    call: currentVisits.filter(v => v.revisado_call_center).length,
    pedidos: currentVisits.reduce((n, v) => n + (pedidosCountByVisita[v.id] || 0), 0)
  }), [currentVisits, pedidosCountByVisita]);

  function openVisitOrders(v) {
    setModal({ type: "visitOrders", data: v });
  }

  if (!configured) return <SetupGuide />;

  return <div className={`app ${sidebarCollapsed ? "sidebarCollapsed" : ""}`}>
    <aside className={`sidebar ${mobileMenu ? "open" : ""}`}>
      <div className="brand">
        <img className="brandLogo" src={LOGO_URL} alt="Clínica Dental Imagina" />
        <div className="brandText"><b>Visitas Provincias</b><small>Imagina · Sonriure</small></div>
        <button className="iconbtn mobileClose" onClick={() => setMobileMenu(false)}><X /></button>
      </div>
      <nav>
        <button className={tab === "visitas" ? "active" : ""} onClick={() => { setTab("visitas"); setMobileMenu(false); }}><Users /><span>Visitas</span></button>
        <button className={tab === "pedidos" ? "active" : ""} onClick={() => { setTab("pedidos"); setMobileMenu(false); }}><ClipboardList /><span>Pedidos</span></button>
        <button className={tab === "estadisticas" ? "active" : ""} onClick={() => { setTab("estadisticas"); setMobileMenu(false); }}><BarChart3 /><span>Estadísticas</span></button>
        <button className={tab === "localidades" ? "active" : ""} onClick={() => { setTab("localidades"); setMobileMenu(false); }}><Map /><span>Localidades</span></button>
        <button className={tab === "logs" ? "active" : ""} onClick={() => { if (logsUnlocked) { setTab("logs"); setMobileMenu(false); } else { setModal({ type: "logsGate" }); } }}><ScrollText /><span>Logs</span></button>
      </nav>
      <div className="sidebarFoot">
        <div className="userMini"><UserCircle2 /><div><b>{session?.user?.email || "Usuario"}</b><small>Sesión activa</small></div></div>
        <button className="logoutBtn" onClick={onSignOut}><LogOut /><span>Cerrar sesión</span></button>
        <span>Sistema de gestión de visitas</span>
      </div>
    </aside>

    <main>
      <header>
        <div className="headerLeft">
          <button className="iconbtn mobileOpen" onClick={() => setMobileMenu(true)}><Menu /></button>
          <button className="iconbtn desktopSidebarToggle" title={sidebarCollapsed ? "Mostrar barra lateral" : "Ocultar barra lateral"} onClick={() => setSidebarCollapsed(v => !v)}>{sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</button>
        </div>
        <div className="headerTitle"><h1>{tab === "visitas" ? "Visitas" : tab === "pedidos" ? "Pedidos" : tab === "estadisticas" ? "Estadísticas" : tab === "localidades" ? "Localidades" : "Logs"}</h1><p>{tab === "logs" ? "Registro de actividad del sistema" : "Gestión de visitas provinciales"}</p></div>
        <div className="headerActions">
          <div className="headerUser"><UserCircle2 /><span>{session?.user?.email || "Usuario"}</span></div>
          <button className="iconbtn" title="Actualizar" onClick={loadAll}><RefreshCw /></button>
          <button className="iconbtn logoutIcon" title="Cerrar sesión" onClick={onSignOut}><LogOut /></button>
        </div>
      </header>
      {error && <div className="alert">{error}<button onClick={() => setError("")}><X /></button></div>}
      {loading && <div className="loading">Cargando información...</div>}

      {!loading && tab === "visitas" && <section>
        <div className="localityTabs">
          {localidades.map(l => <button key={l.id} className={localidad?.id === l.id ? "selected" : ""} onClick={() => setLocalidad(l)}>{l.nombre}<span className="tabCounts">{visitas.filter(v => v.localidad_id === l.id).length} visitas · {pedidos.filter(p => effectiveLocalityId(p, visitas) === l.id).length} pedidos</span></button>)}
          <button className="addTab" onClick={addLocalidad}><Plus /> Agregar</button>
        </div>
        <VisitFilters search={search} setSearch={setSearch} filters={visitFilters} setFilters={setVisitFilters} />
        <div className="toolbarActions"><button className="primary" onClick={() => setModal({ type: "visit", data: { ...emptyVisit, localidad_id: localidad?.id } })}><Plus /> Nueva visita</button></div>
        <div className="statsMini statsFive"><Stat icon={<Users />} label="Visitas" value={counts.total} /><Stat icon={<Check />} label="Visitados" value={counts.visitados} /><Stat icon={<CalendarDays />} label="No visitados / Cerrados" value={counts.no} /><Stat icon={<Phone />} label="Call Center" value={counts.call} /><Stat icon={<Package />} label="Pedidos" value={counts.pedidos} /></div>
        <div className="tableWrap"><table><thead><tr><th>#</th><th>Nombre completo</th><th>Número</th><th>Tipo</th><th>Estado</th><th>Call Center</th><th>Pedidos</th><th></th></tr></thead><tbody>
          {filteredVisits.map(v => <tr key={v.id} className={`visitRow ${tipoClass(v.tipo)}`}>
            <td className="indexCell">{visitIndexMap[v.id]}</td>
            <td><div className="person"><button className="avatar avatarButton" onClick={() => v.foto_url && setLightbox(v.foto_url)} title={v.foto_url ? "Ver fotografía" : "Sin fotografía"}>{v.foto_url ? <img src={v.foto_url} /> : <Users />}</button><span>{v.nombre_completo}</span></div></td>
            <td><div className="phone"><span>{v.numero || "—"}</span>{v.numero && <a title="WhatsApp" href={wa(v.numero)} target="_blank" rel="noreferrer"><MessageCircle /></a>}</div></td>
            <td><span className={`typeBadge ${tipoClass(v.tipo)}`}>{tipoIcon(v.tipo)}{v.tipo}</span></td>
            <td><select className={`status ${estadoClass(v.estado)}`} value={v.estado} onChange={e => quickVisit(v.id, "estado", e.target.value)}>{ESTADOS.map(x => <option key={x}>{x}</option>)}</select></td>
            <td><button className={`toggle callToggle ${v.revisado_call_center ? "yes" : "no"}`} onClick={() => quickVisit(v.id, "revisado_call_center", !v.revisado_call_center)}>{v.revisado_call_center ? "Sí" : "No"}</button></td>
            <td><button className="orderCountBtn" onClick={() => openVisitOrders(v)} title="Ver pedidos de esta visita"><Package /> <b>{pedidosCountByVisita[v.id] || 0}</b><ChevronRight /></button></td>
            <td><div className="actions"><button className="iconbtn" title="Ver detalles" onClick={() => setModal({ type: "detail", data: v })}><Eye /></button><button className="iconbtn" title="Editar" onClick={() => setModal({ type: "visit", data: v })}><Pencil /></button><button className="iconbtn danger" title="Eliminar" onClick={() => requestDelete("visita", v)}><Trash2 /></button></div></td>
          </tr>)}
          {!filteredVisits.length && <tr><td colSpan="8" className="empty">No hay registros para los filtros seleccionados.</td></tr>}
        </tbody></table></div>
      </section>}

      {!loading && tab === "estadisticas" && <Stats visits={visitas} localidades={localidades} pedidos={pedidos} />}
      {!loading && tab === "pedidos" && <Orders pedidos={pedidos} localidades={localidades} visitas={visitas} onSave={savePedido} onDelete={(id) => { const p = pedidos.find(x => x.id === id); if (p) requestDelete("pedido", p); }} onEdit={p => setModal({ type: "pedido", data: p })} onNew={() => setModal({ type: "pedido", data: { ...emptyPedido, localidad_id: localidad?.id || localidades[0]?.id || "" } })} />}
      {!loading && tab === "localidades" && <Localidades ls={localidades} visitas={visitas} pedidos={pedidos} onAdd={addLocalidad} onEdit={editLocalidad} onDelete={deleteLocalidad} onSelect={(l) => { setLocalidad(l); setTab("localidades"); }} />}
      {!loading && tab === "logs" && <Logs accessCode={logsCode} />}
    </main>

    {modal?.type === "visit" && <VisitModal data={modal.data} localidades={localidades} onClose={() => setModal(null)} onSave={saveVisit} onImage={setLightbox} />}
    {modal?.type === "detail" && <DetailModal data={modal.data} pedidosCount={pedidosCountByVisita[modal.data.id] || 0} onClose={() => setModal(null)} onImage={setLightbox} onOrders={() => openVisitOrders(modal.data)} />}
    {modal?.type === "pedido" && <PedidoModal data={modal.data} localidades={localidades} visitas={visitas} onClose={() => setModal(null)} onSave={savePedido} />}
    {modal?.type === "visitOrders" && <VisitOrdersModal visita={modal.data} pedidos={pedidos.filter(p => p.visita_id === modal.data.id)} localidades={localidades} onClose={() => setModal(null)} onEdit={p => setModal({ type: "pedido", data: p })} onNew={() => setModal({ type: "pedido", data: { ...emptyPedido, visita_id: modal.data.id, localidad_id: modal.data.localidad_id } })} />}
    {modal?.type === "logsGate" && <LogsGate onClose={() => setModal(null)} onUnlock={(code) => { setLogsCode(code); setLogsUnlocked(true); setModal(null); setTab("logs"); setMobileMenu(false); }} />}
    {deleteRequest && <DeleteGate item={deleteRequest.item} kind={deleteRequest.kind} onClose={() => setDeleteRequest(null)} onConfirm={(code) => performDelete(deleteRequest.kind, deleteRequest.item, code)} />}
    {lightbox && <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />}
  </div>;
}

function Stat({ icon, label, value }) { return <div className="stat"><span>{icon}</span><div><b>{value}</b><small>{label}</small></div></div>; }

function VisitFilters({ search, setSearch, filters, setFilters }) {
  const clear = () => { setSearch(""); setFilters({ call: "todos", tipo: "todos", visitado: "todos", estado: "todos" }); };
  return <div className="filtersCard"><div className="filterHeader"><div><Filter /><b>Filtros de visitas</b></div><button className="clearBtn" onClick={clear}>Limpiar filtros</button></div>
    <div className="filterGrid"><div className="search filterSearch"><Search /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, COD, número..." /></div>
      <label>Call Center<select value={filters.call} onChange={e => setFilters({ ...filters, call: e.target.value })}><option value="todos">Todos</option><option value="si">Sí</option><option value="no">No</option></select></label>
      <label>Tipo<select value={filters.tipo} onChange={e => setFilters({ ...filters, tipo: e.target.value })}><option value="todos">Todos</option>{TIPOS.map(t => <option key={t}>{t}</option>)}</select></label>
      <label>Visitado como<select value={filters.visitado} onChange={e => setFilters({ ...filters, visitado: e.target.value })}><option value="todos">Todos</option>{VISITADO.map(t => <option key={t}>{t}</option>)}</select></label>
      <label>Estado<select value={filters.estado} onChange={e => setFilters({ ...filters, estado: e.target.value })}><option value="todos">Todos</option>{ESTADOS.map(t => <option key={t}>{t}</option>)}</select></label>
    </div></div>;
}

function VisitModal({ data, localidades, onClose, onSave, onImage }) {
  const [v, setV] = useState({ ...data }); const fileRef = useRef();
  const set = (k, x) => setV(prev => ({ ...prev, [k]: x }));
  async function photo(e) {
    const f = e.target.files?.[0]; if (!f || !supabase) return;
    const ext = f.name.split(".").pop() || "jpg"; const path = `visitas/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("fotos").upload(path, f, { upsert: false });
    if (error) return alert(error.message);
    const { data: u } = supabase.storage.from("fotos").getPublicUrl(path); set("foto_url", u.publicUrl);
  }
  return <div className="overlay"><div className="modal largeModal"><div className="modalHead"><div><h2>{v.id ? "Editar visita" : "Nueva visita"}</h2><p>{v.id ? `COD ${v.cod}` : "El COD se asignará automáticamente al guardar."}</p></div><button className="iconbtn" onClick={onClose}><X /></button></div>
    <div className="formGrid">
      <label>Localidad<select value={v.localidad_id || ""} onChange={e => set("localidad_id", e.target.value)}>{localidades.map(l => <option value={l.id} key={l.id}>{l.nombre}</option>)}</select></label>
      <label>COD<input value={v.cod ?? "Automático"} readOnly className="readonlyInput" /></label>
      <label className="wide">Nombre completo<input value={v.nombre_completo} onChange={e => set("nombre_completo", e.target.value)} /></label>
      <label>Número<input value={v.numero || ""} onChange={e => set("numero", e.target.value)} placeholder="7XXXXXXXX" /></label>
      <label>Tipo<select value={v.tipo} onChange={e => set("tipo", e.target.value)}>{TIPOS.map(x => <option key={x}>{x}</option>)}</select></label>
      <label>Visitado como<select value={v.visitado_como} onChange={e => set("visitado_como", e.target.value)}>{VISITADO.map(x => <option key={x}>{x}</option>)}</select></label>
      <label>Estado<select value={v.estado} onChange={e => set("estado", e.target.value)}>{ESTADOS.map(x => <option key={x}>{x}</option>)}</select></label>
      <label>Fecha de visita<input type="date" value={v.fecha_visita || ""} onChange={e => set("fecha_visita", e.target.value)} /></label>
      <label className="wide">Descripción / interés<textarea value={v.descripcion_interes || ""} onChange={e => set("descripcion_interes", e.target.value)} /></label>
      <label className="wide">Ubicación / enlace Google Maps<input value={v.ubicacion || ""} onChange={e => set("ubicacion", e.target.value)} placeholder="Pegar enlace de Google Maps" /></label>
      <label className="wide">Observaciones<textarea value={v.observaciones || ""} onChange={e => set("observaciones", e.target.value)} /></label>
      <div className="photoField wide"><button type="button" className="photoPreview photoButton" onClick={() => v.foto_url && onImage(v.foto_url)}>{v.foto_url ? <img src={v.foto_url} /> : <Camera />}</button><div><b>Fotografía</b><p>En móvil permite usar la cámara. Haz clic en la miniatura para verla grande.</p><input ref={fileRef} className="hiddenInput" type="file" accept="image/*" capture="environment" onChange={photo} /><button type="button" className="secondary" onClick={() => fileRef.current?.click()}><Camera /> Tomar / seleccionar foto</button></div></div>
      <label className="check wide"><input type="checkbox" checked={!!v.revisado_call_center} onChange={e => set("revisado_call_center", e.target.checked)} /> Revisado por Call Center</label>
    </div><div className="modalFoot"><button className="secondary" onClick={onClose}>Cancelar</button><button className="primary" onClick={() => onSave(v)}><Check /> Guardar</button></div></div></div>;
}

function DetailModal({ data: v, pedidosCount, onClose, onImage, onOrders }) {
  return <div className="overlay"><div className="modal"><div className="modalHead"><h2>Detalle de visita</h2><button className="iconbtn" onClick={onClose}><X /></button></div>
    <div className="detailTop"><button className="detailPhotoButton" onClick={() => v.foto_url && onImage(v.foto_url)}>{v.foto_url ? <img src={v.foto_url} className="detailPhoto" /> : <div className="detailPhoto placeholder"><Camera /></div>}</button><div><h3>{v.nombre_completo}</h3><p>COD {v.cod ?? "—"} · {v.tipo}</p><span className={`pill ${estadoClass(v.estado)}`}>{v.estado}</span></div></div>
    <div className="detailGrid"><Info k="Número" v={v.numero || "—"} link={v.numero ? wa(v.numero) : null} /><Info k="Tipo" v={v.tipo} /><Info k="Visitado como" v={v.visitado_como} /><Info k="Fecha de visita" v={formatDate(v.fecha_visita)} /><Info k="Call Center" v={v.revisado_call_center ? "Sí" : "No"} /><Info k="Descripción / interés" v={v.descripcion_interes || "—"} /><Info k="Observaciones" v={v.observaciones || "—"} /><Info k="Ubicación" v={v.ubicacion || "—"} link={v.ubicacion ? maps(v.ubicacion) : null} /></div>
    <div className="detailOrderBox"><div><small>Pedidos realizados</small><b>{pedidosCount}</b></div><button className="secondary" onClick={onOrders}><Package /> Ver pedidos</button></div>
  </div></div>;
}
function Info({ k, v, link }) { return <div className="info"><small>{k}</small>{link ? <a href={link} target="_blank" rel="noreferrer">{v} <ExternalLink /></a> : <span>{v}</span>}</div>; }

function VisitOrdersModal({ visita, pedidos, localidades, onClose, onEdit, onNew }) {
  const localidad = localidades.find(l => l.id === visita.localidad_id);
  return <div className="overlay"><div className="modal wideOrdersModal"><div className="modalHead"><div><h2>Pedidos de {visita.nombre_completo}</h2><p>COD {visita.cod ?? "—"} · {localidad?.nombre || "—"}</p></div><button className="iconbtn" onClick={onClose}><X /></button></div>
    <div className="ordersSummary"><Stat icon={<Package />} label="Pedidos" value={pedidos.length} /><button className="primary" onClick={onNew}><Plus /> Nuevo pedido</button></div>
    <div className="tableWrap"><table><thead><tr><th>COD</th><th>Fecha</th><th>Pedido</th><th>Cantidad</th><th>Estado</th><th></th></tr></thead><tbody>{pedidos.map(p => <tr key={p.id}><td className="code">{p.cod ?? "—"}</td><td>{formatDate(p.fecha)}</td><td><b>{p.descripcion}</b></td><td>{p.cantidad}</td><td><span className={`orderStatus ${p.estado?.toLowerCase().replaceAll(" ", "-")}`}>{p.estado}</span></td><td><button className="iconbtn" title="Editar" onClick={() => onEdit(p)}><Pencil /></button></td></tr>)}{!pedidos.length && <tr><td colSpan="6" className="empty">Este profesional todavía no tiene pedidos.</td></tr>}</tbody></table></div>
  </div></div>;
}

function ImageLightbox({ src, onClose }) { return <div className="imageOverlay" onClick={onClose}><div className="imageLightbox" onClick={e => e.stopPropagation()}><button className="lightboxClose" onClick={onClose}><X /></button><img src={src} alt="Fotografía ampliada" /></div></div>; }

function Stats({ visits, localidades, pedidos }) {
  const states = Object.fromEntries(ESTADOS.map(e => [e, visits.filter(v => v.estado === e).length]));
  const types = Object.fromEntries(TIPOS.map(t => [t, visits.filter(v => v.tipo === t).length]));
  const totalQuantity = pedidos.reduce((n, p) => n + Number(p.cantidad || 0), 0);
  const visitados = visits.filter(v => v.estado?.startsWith("Visitado")).length;
  const closed = visits.filter(v => v.estado === "Cerrado por visitar").length;
  return <section className="page"><div className="pageTitle"><div><h2>Estadísticas</h2><p>Resumen general y distribución por localidad, tipo, estado y pedidos.</p></div></div>
    <div className="bigStats"><Stat label="Visitas" value={visits.length} icon={<Users />} /><Stat label="Visitados" value={visitados} icon={<Check />} /><Stat label="No visitados" value={visits.filter(v => v.estado === "No visitado").length} icon={<CalendarDays />} /><Stat label="Cerrado por visitar" value={closed} icon={<CalendarRange />} /><Stat label="Pedidos" value={pedidos.length} icon={<Package />} /><Stat label="Unidades pedidas" value={totalQuantity} icon={<ClipboardList />} /><Stat label="Call Center" value={visits.filter(v => v.revisado_call_center).length} icon={<Phone />} /></div>
    <div className="statsColumns"><div className="card"><h3>Visitas por tipo</h3>{TIPOS.map(t => { const n = types[t] || 0; return <div className="barrow" key={t}><span className={`barLabel ${tipoClass(t)}`}>{tipoIcon(t)}{t}</span><div className="bar"><i style={{ width: `${visits.length ? Math.round(n / visits.length * 100) : 0}%` }} /></div><b>{n}</b></div>; })}</div>
      <div className="card"><h3>Visitas por localidad</h3>{localidades.map(l => { const n = visits.filter(v => v.localidad_id === l.id).length; return <div className="barrow" key={l.id}><span>{l.nombre}</span><div className="bar"><i style={{ width: `${visits.length ? Math.round(n / visits.length * 100) : 0}%` }} /></div><b>{n}</b></div>; })}</div></div>
    <div className="statsColumns"><div className="card"><h3>Estados</h3>{ESTADOS.map(e => { const n = states[e] || 0; return <div className="barrow" key={e}><span>{e}</span><div className="bar"><i style={{ width: `${visits.length ? Math.round(n / visits.length * 100) : 0}%` }} /></div><b>{n}</b></div>; })}</div>
      <div className="card"><h3>Resumen de pedidos</h3>{PEDIDO_ESTADOS.map(e => { const n = pedidos.filter(p => p.estado === e).length; return <div className="barrow" key={e}><span>{e}</span><div className="bar"><i style={{ width: `${pedidos.length ? Math.round(n / pedidos.length * 100) : 0}%` }} /></div><b>{n}</b></div>; })}</div></div>
    <div className="card"><h3>Detalle por localidad</h3><div className="tableWrap compact"><table><thead><tr><th>Localidad</th><th>Visitas</th><th>Dentistas</th><th>Técnicos</th><th>Hospitales</th><th>Farmacias</th><th>Cerrado por visitar</th><th>Pedidos</th></tr></thead><tbody>{localidades.map(l => { const lv = visits.filter(v => v.localidad_id === l.id); const lp = pedidos.filter(p => effectiveLocalityId(p, visits) === l.id); return <tr key={l.id}><td><b>{l.nombre}</b></td><td>{lv.length}</td><td>{lv.filter(v => v.tipo === "Dentista").length}</td><td>{lv.filter(v => v.tipo === "Técnico").length}</td><td>{lv.filter(v => v.tipo === "Hospital").length}</td><td>{lv.filter(v => v.tipo === "Farmacia").length}</td><td>{lv.filter(v => v.estado === "Cerrado por visitar").length}</td><td>{lp.length}</td></tr>; })}</tbody></table></div></div>
  </section>;
}

function Orders({ pedidos, localidades, visitas, onSave, onDelete, onEdit, onNew }) {
  const [localidadId, setLocalidadId] = useState("todos");
  const [period, setPeriod] = useState("general");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [search, setSearch] = useState(""); const [status, setStatus] = useState("todos");
  const visitMap = useMemo(() => Object.fromEntries(visitas.map(v => [v.id, v])), [visitas]);
  const filtered = useMemo(() => pedidos.filter(p => {
    const pLocalidad = effectiveLocalityId(p, visitas);
    if (localidadId !== "todos" && pLocalidad !== localidadId) return false;
    const d = p.fecha || "";
    if (period === "mes" && !d.startsWith(month)) return false;
    if (period === "rango" && ((from && d < from) || (to && d > to))) return false;
    if (status !== "todos" && p.estado !== status) return false;
    const v = visitMap[p.visita_id];
    const doctor = v?.nombre_completo || "";
    const q = search.toLowerCase().trim();
    if (q && !`${p.cod} ${p.descripcion} ${p.estado} ${p.observaciones || ""} ${doctor} ${v?.numero || ""}`.toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")) || numericCod(a) - numericCod(b)), [pedidos, visitas, localidadId, period, month, from, to, search, status, visitMap]);
  const clear = () => { setLocalidadId("todos"); setPeriod("general"); setMonth(new Date().toISOString().slice(0, 7)); setFrom(""); setTo(""); setSearch(""); setStatus("todos"); };
  return <section className="page"><div className="pageTitle"><div><h2>Pedidos</h2><p>Busca por profesional, localidad, estado y fecha.</p></div><button className="primary" onClick={onNew}><Plus /> Nuevo pedido</button></div>
    <div className="localityTabs orderLocalityTabs"><button className={localidadId === "todos" ? "selected" : ""} onClick={() => setLocalidadId("todos")}>Todas</button>{localidades.map(l => <button key={l.id} className={localidadId === l.id ? "selected" : ""} onClick={() => setLocalidadId(l.id)}>{l.nombre}</button>)}</div>
    <div className="orderFilters filtersCard"><div className="filterHeader"><div><Filter /><b>Filtros de pedidos</b></div><button className="clearBtn" onClick={clear}>Limpiar filtros</button></div><div className="filterGrid orderGrid"><div className="search filterSearch"><Search /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar COD, doctor, pedido..." /></div><label>Localidad<select value={localidadId} onChange={e => setLocalidadId(e.target.value)}><option value="todos">Todas</option>{localidades.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}</select></label><label>Estado<select value={status} onChange={e => setStatus(e.target.value)}><option value="todos">Todos</option>{PEDIDO_ESTADOS.map(x => <option key={x}>{x}</option>)}</select></label><label>Periodo<select value={period} onChange={e => setPeriod(e.target.value)}><option value="general">General</option><option value="mes">Mes</option><option value="rango">Rango de fechas</option></select></label>{period === "mes" && <label>Mes<input type="month" value={month} onChange={e => setMonth(e.target.value)} /></label>}{period === "rango" && <><label>Desde<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label>Hasta<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label></>}</div></div>
    <div className="statsMini statsFive"><Stat icon={<Package />} label="Resultados" value={filtered.length} /><Stat icon={<CalendarRange />} label="Pendientes" value={filtered.filter(p => p.estado === "Pendiente").length} /><Stat icon={<Check />} label="Entregados" value={filtered.filter(p => p.estado === "Entregado").length} /><Stat icon={<ClipboardList />} label="Unidades" value={filtered.reduce((n,p)=>n+Number(p.cantidad||0),0)} /><Stat icon={<Users />} label="Profesionales" value={new Set(filtered.map(p=>p.visita_id).filter(Boolean)).size} /></div>
    <div className="tableWrap"><table><thead><tr><th>COD</th><th>Fecha</th><th>Localidad</th><th>Doctor / profesional</th><th>Pedido</th><th>Cantidad</th><th>Estado</th><th></th></tr></thead><tbody>{filtered.map(p => { const l = localidades.find(x => x.id === effectiveLocalityId(p, visitas)); const v = visitMap[p.visita_id]; return <tr key={p.id}><td className="code">{p.cod ?? "—"}</td><td>{formatDate(p.fecha)}</td><td>{l?.nombre || "—"}</td><td>{v ? <div><b>{v.nombre_completo}</b><small className="tableSub">COD {v.cod ?? "—"} · {v.tipo}</small></div> : "Sin visita relacionada"}</td><td><b>{p.descripcion}</b></td><td>{p.cantidad}</td><td><span className={`orderStatus ${p.estado?.toLowerCase().replaceAll(" ", "-")}`}>{p.estado}</span></td><td><div className="actions"><button className="iconbtn" title="Editar" onClick={() => onEdit(p)}><Pencil /></button><button className="iconbtn danger" title="Eliminar" onClick={() => onDelete(p.id)}><Trash2 /></button></div></td></tr>; })}{!filtered.length && <tr><td colSpan="8" className="empty">No hay pedidos para los filtros seleccionados.</td></tr>}</tbody></table></div>
  </section>;
}

function PedidoModal({ data, localidades, visitas, onClose, onSave }) {
  const [p, setP] = useState({ ...data }); const [query, setQuery] = useState("");
  const set = (k, x) => setP(prev => ({ ...prev, [k]: x }));
  const selectedVisit = visitas.find(v => v.id === p.visita_id);
  useEffect(() => { if (selectedVisit) setQuery(selectedVisit.nombre_completo); }, []);
  const matches = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return visitas.filter(v => !p.localidad_id || v.localidad_id === p.localidad_id).slice(0, 8);
    return visitas.filter(v => (!p.localidad_id || v.localidad_id === p.localidad_id) && `${v.nombre_completo} ${v.cod} ${v.numero} ${v.tipo}`.toLowerCase().includes(q)).slice(0, 10);
  }, [query, visitas, p.localidad_id]);
  function choose(v) { set("visita_id", v.id); set("localidad_id", v.localidad_id); setQuery(v.nombre_completo); }
  return <div className="overlay"><div className="modal"><div className="modalHead"><div><h2>{p.id ? "Editar pedido" : "Nuevo pedido"}</h2><p>{p.id ? `COD ${p.cod}` : "El COD se asignará automáticamente al guardar."}</p></div><button className="iconbtn" onClick={onClose}><X /></button></div><div className="formGrid">
    <label>Localidad<select value={p.localidad_id || ""} onChange={e => { set("localidad_id", e.target.value); set("visita_id", ""); setQuery(""); }}>{localidades.map(l => <option value={l.id} key={l.id}>{l.nombre}</option>)}</select></label>
    <label>COD<input value={p.cod ?? "Automático"} readOnly className="readonlyInput" /></label>
    <div className="wide searchRelation"><label>Buscar doctor / profesional</label><div className="search"><Search /><input value={query} onChange={e => { setQuery(e.target.value); set("visita_id", ""); }} placeholder="Escribe el nombre del doctor o profesional..." /></div>{query && !selectedVisit && <div className="searchResults">{matches.map(v => <button type="button" key={v.id} onClick={() => choose(v)}><span className="resultAvatar">{tipoIcon(v.tipo)}</span><span><b>{v.nombre_completo}</b><small>COD {v.cod ?? "—"} · {v.tipo}</small></span><ChevronRight /></button>)}{!matches.length && <div className="noResults">No se encontraron profesionales.</div>}</div>}{selectedVisit && <div className="selectedRelation"><Check /><span><b>{selectedVisit.nombre_completo}</b><small>COD {selectedVisit.cod ?? "—"} · {selectedVisit.tipo}</small></span><button type="button" onClick={() => { set("visita_id", ""); setQuery(""); }}><X /></button></div>}</div>
    <label className="wide">Pedido / descripción<input value={p.descripcion || ""} onChange={e => set("descripcion", e.target.value)} placeholder="Ej. 10 kits, 5 cajas, material promocional..." /></label>
    <label>Cantidad<input type="number" min="1" value={p.cantidad ?? 1} onChange={e => set("cantidad", e.target.value)} /></label>
    <label>Estado<select value={p.estado || "Pendiente"} onChange={e => set("estado", e.target.value)}>{PEDIDO_ESTADOS.map(x => <option key={x}>{x}</option>)}</select></label>
    <label>Fecha<input type="date" value={p.fecha || ""} onChange={e => set("fecha", e.target.value)} /></label>
    <label className="wide">Observaciones<textarea value={p.observaciones || ""} onChange={e => set("observaciones", e.target.value)} /></label>
  </div><div className="modalFoot"><button className="secondary" onClick={onClose}>Cancelar</button><button className="primary" onClick={() => onSave(p)} disabled={!p.visita_id || !p.descripcion?.trim()}><Check /> Guardar pedido</button></div></div></div>;
}

function Localidades({ ls, visitas, pedidos, onAdd, onEdit, onDelete, onSelect }) {
  const [selected, setSelected] = useState(ls[0] || null);
  useEffect(() => { if (selected && !ls.some(x => x.id === selected.id)) setSelected(ls[0] || null); }, [ls, selected]);
  const active = selected || ls[0] || null;
  return <section className="page localityPage"><div className="pageTitle"><div><h2>Localidades</h2><p>Administra localidades y consulta sus registros sobre el mapa.</p></div><button className="primary" onClick={onAdd}><Plus /> Nueva localidad</button></div>
    <div className="cards localityCards">{ls.map(l => { const v = visitas.filter(x => x.localidad_id === l.id); const p = pedidos.filter(x => effectiveLocalityId(x, visitas) === l.id); return <div className={`localCard ${active?.id === l.id ? "selectedLocalCard" : ""}`} key={l.id} onClick={() => { setSelected(l); onSelect(l); }}>
      <div className="localCardIcon"><MapPin /></div><div className="localCardBody"><b>{l.nombre}</b><small>{v.length} visitas · {p.length} pedidos</small><div className="localTypeCounts"><span>{v.filter(x=>x.tipo === "Dentista").length} Dentistas</span><span>{v.filter(x=>x.tipo === "Hospital").length} Hospitales</span><span>{v.filter(x=>x.tipo === "Farmacia").length} Farmacias</span><span>{v.filter(x=>x.tipo === "Técnico").length} Técnicos</span></div></div>
      <div className="actions" onClick={e => e.stopPropagation()}><button className="iconbtn" title="Ver en mapa" onClick={() => { setSelected(l); onSelect(l); }}><MapPinned /></button><button className="iconbtn" title="Editar localidad" onClick={() => onEdit(l)}><Pencil /></button><button className="iconbtn danger" title="Eliminar localidad" onClick={() => onDelete(l)}><Trash2 /></button></div>
    </div>; })}</div>
    {active && <LocalityMapPanel locality={active} visits={visitas.filter(v => v.localidad_id === active.id)} onDetail={(v) => window.dispatchEvent(new CustomEvent("open-visit-detail", { detail: v }))} />}
  </section>;
}

function LogsGate({ onClose, onUnlock }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    if (!supabase || !code) return;
    setError("");
    const { data, error: rpcError } = await supabase.rpc("verify_logs_access", { p_code: code });
    if (rpcError || data !== true) {
      setError("Contraseña incorrecta");
      setCode("");
      return;
    }
    onUnlock(code);
  }
  return <div className="overlay"><div className="modal logsGateModal">
    <div className="modalHead"><div><h2>Acceso a Logs</h2><p>Introduce el código para consultar el registro de actividad.</p></div><button className="iconbtn" onClick={onClose}><X /></button></div>
    <form onSubmit={submit} className="logsGateForm">
      <div className="logsKeyIcon"><KeyRound /></div>
      <label>Código de acceso<div className="authInput"><LockKeyhole /><input autoFocus type="password" value={code} onChange={e => { setCode(e.target.value); setError(""); }} placeholder="Introduce el código" /></div></label>
      {error && <div className="logsGateError">{error}</div>}
      <div className="modalFoot"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button type="submit" className="primary">Ingresar a Logs</button></div>
    </form>
  </div></div>;
}

function Logs({ accessCode }) {
  const [logs, setLogs] = useState([]);
  const [operation, setOperation] = useState("todos");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadLogs() {
    if (!supabase) return;
    setLoading(true); setError("");
    const { data, error } = await supabase.rpc("get_logs", {
      p_code: accessCode,
      p_operacion: operation === "todos" ? null : operation,
      p_desde: from || null,
      p_hasta: to || null,
      p_busqueda: search.trim() || null
    });
    if (error) setError(error.message); else setLogs(data || []);
    setLoading(false);
  }
  useEffect(() => { loadLogs(); }, [operation, from, to]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return logs;
    return logs.filter(l => `${l.usuario_email || ""} ${l.entidad || ""} ${l.descripcion || ""} ${l.operacion || ""}`.toLowerCase().includes(q));
  }, [logs, search]);

  const operationLabel = op => ({ registro: "Registro", edicion: "Edición", eliminacion: "Eliminación" }[op] || op || "—");
  const operationClass = op => ({ registro: "logRegistro", edicion: "logEdicion", eliminacion: "logEliminacion" }[op] || "");
  const entityLabel = e => ({ visitas: "Visita", pedidos: "Pedido", localidades: "Localidad" }[e] || e || "—");
  const dateTime = value => value ? new Date(value).toLocaleString("es-BO", { dateStyle: "short", timeStyle: "medium" }) : "—";
  const clear = () => { setOperation("todos"); setFrom(""); setTo(""); setSearch(""); };

  return <section className="page logsPage">
    <div className="pageTitle"><div><h2>Logs</h2><p>Registro de las operaciones realizadas dentro del sistema.</p></div><button className="secondary" onClick={loadLogs}><RefreshCw /> Actualizar</button></div>
    <div className="filtersCard"><div className="filterHeader"><div><ScrollText /><b>Filtros de actividad</b></div><button className="clearBtn" onClick={clear}>Limpiar filtros</button></div>
      <div className="filterGrid logsFilterGrid">
        <div className="search filterSearch"><Search /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar usuario, operación o descripción..." /></div>
        <label>Operación<select value={operation} onChange={e => setOperation(e.target.value)}><option value="todos">Todas</option><option value="registro">Registro</option><option value="edicion">Edición</option><option value="eliminacion">Eliminación</option></select></label>
        <label>Desde<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label>Hasta<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
      </div>
    </div>
    {error && <div className="alert">{error}<button onClick={() => setError("")}><X /></button></div>}
    <div className="statsMini statsFive"><Stat icon={<ScrollText />} label="Registros mostrados" value={filtered.length} /><Stat icon={<Plus />} label="Registros" value={filtered.filter(x => x.operacion === "registro").length} /><Stat icon={<Pencil />} label="Ediciones" value={filtered.filter(x => x.operacion === "edicion").length} /><Stat icon={<Trash2 />} label="Eliminaciones" value={filtered.filter(x => x.operacion === "eliminacion").length} /><Stat icon={<Users />} label="Usuarios" value={new Set(filtered.map(x => x.usuario_id).filter(Boolean)).size} /></div>
    <div className="tableWrap logsTableWrap"><table><thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Operación</th><th>Elemento</th><th>Qué hizo</th></tr></thead><tbody>
      {loading && <tr><td colSpan="5" className="empty">Cargando logs...</td></tr>}
      {!loading && filtered.map(l => <tr key={l.id}><td className="logDate">{dateTime(l.created_at)}</td><td><div className="logUser"><UserCircle2 /><span>{l.usuario_email || "Usuario no identificado"}</span></div></td><td><span className={`logOperation ${operationClass(l.operacion)}`}>{operationLabel(l.operacion)}</span></td><td><span className="logEntity">{entityLabel(l.entidad)}</span></td><td><b>{l.descripcion || "—"}</b></td></tr>)}
      {!loading && !filtered.length && <tr><td colSpan="5" className="empty">No hay registros para los filtros seleccionados.</td></tr>}
    </tbody></table></div>
  </section>;
}


function DeleteGate({ item, kind, onClose, onConfirm }) {
  const [code, setCode] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const title = kind === "visita" ? "Eliminar visita" : kind === "pedido" ? "Eliminar pedido" : "Eliminar localidad";
  const name = item?.nombre_completo || item?.descripcion || item?.nombre || "este registro";
  async function submit(e) { e.preventDefault(); if (!code || busy) return; setBusy(true); setError(""); const { data, error: rpcError } = await supabase.rpc("verify_logs_access", { p_code: code }); if (rpcError || data !== true) { setError("Contraseña incorrecta"); setCode(""); setBusy(false); return; } await onConfirm(code); setBusy(false); }
  return <div className="overlay"><div className="modal logsGateModal"><div className="modalHead"><div><h2>{title}</h2><p>Para eliminar {name}, introduce el código de seguridad.</p></div><button className="iconbtn" onClick={onClose}><X /></button></div><form onSubmit={submit} className="logsGateForm"><div className="logsKeyIcon dangerKey"><Trash2 /></div><label>Código de eliminación<div className="authInput"><LockKeyhole /><input autoFocus type="password" value={code} onChange={e => { setCode(e.target.value); setError(""); }} placeholder="Introduce el código" /></div></label>{error && <div className="logsGateError">{error}</div>}<div className="modalFoot"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button type="submit" className="dangerPrimary" disabled={busy}>{busy ? "Verificando..." : "Eliminar"}</button></div></form></div></div>;
}

let leafletPromise;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-leaflet]')) { const link=document.createElement("link"); link.rel="stylesheet"; link.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; link.dataset.leaflet="1"; document.head.appendChild(link); }
    const script=document.createElement("script"); script.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; script.onload=()=>resolve(window.L); script.onerror=reject; document.head.appendChild(script);
  });
  return leafletPromise;
}
function getLocalityCenter(name) {
  const key = String(name || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const centers = {
    camiri: [-20.0392, -63.5183],
    villamontes: [-21.2553, -63.4059],
    yacuiba: [-22.0164, -63.6775],
    monteagudo: [-19.8163, -63.9636],
    "santa cruz": [-17.7833, -63.1821],
    "santa cruz de la sierra": [-17.7833, -63.1821],
    tarija: [-21.5355, -64.7296],
    sucre: [-19.0333, -65.2627],
    potosi: [-19.5836, -65.7531],
    oruro: [-17.9833, -67.1500],
    "la paz": [-16.4897, -68.1193],
    cochabamba: [-17.3895, -66.1568],
    trinidad: [-14.8333, -64.9000],
    cobija: [-11.0267, -68.7692]
  };
  return centers[key] || centers["santa cruz"] || [-17.7833, -63.1821];
}
function extractCoords(value) {
  const s = String(value || "");
  let m = s.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (m) return [Number(m[1]), Number(m[2])];
  m = s.match(/[?&](?:q|query|ll|destination|origin)=(-?\d+(?:\.\d+)?)[,%20]+(-?\d+(?:\.\d+)?)/i);
  if (m) return [Number(m[1]), Number(m[2])];
  m = s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i);
  if (m) return [Number(m[1]), Number(m[2])];
  m = s.match(/(-?\d{1,3}\.\d{4,})\s*[, ]\s*(-?\d{1,3}\.\d{4,})/);
  if (m) return [Number(m[1]), Number(m[2])];
  return null;
}
function isGoogleShortMapUrl(value) {
  try {
    const host = new URL(String(value || "")).hostname.toLowerCase();
    return host === "maps.app.goo.gl" || host === "goo.gl";
  } catch { return false; }
}
async function resolveMapCoords(value) {
  const direct = extractCoords(value);
  if (direct) return direct;
  if (!isGoogleShortMapUrl(value)) return null;
  const key = `mapcoords:${String(value).trim()}`;
  try { const cached = localStorage.getItem(key); if (cached) return JSON.parse(cached); } catch {}
  try {
    const r = await fetch(`/api/resolve-map?url=${encodeURIComponent(String(value))}`);
    if (!r.ok) return null;
    const data = await r.json();
    if (Array.isArray(data?.coords) && data.coords.length === 2) {
      const c = [Number(data.coords[0]), Number(data.coords[1])];
      try { localStorage.setItem(key, JSON.stringify(c)); } catch {}
      return c;
    }
  } catch {}
  return null;
}
function typeMarkerIcon(L, tipo, estado, selected = false) {
  const symbol={Dentista:"D",Técnico:"T",Hospital:"H",Farmacia:"F"}[tipo]||"•";
  const type={Dentista:"dentista",Técnico:"tecnico",Hospital:"hospital",Farmacia:"farmacia"}[tipo]||"default";
  const red=!String(estado||"").startsWith("Visitado");
  return L.divIcon({className:"customMapMarker", html:`<div class="mapPinMarker ${type} ${red?"red":"green"} ${selected?"selected":""}"><span>${symbol}</span></div>`, iconSize:[38,46], iconAnchor:[19,46], popupAnchor:[0,-42]});
}
function LocalityMapPanel({ locality, visits, onDetail }) {
  const mapRef=useRef(null), instanceRef=useRef(null), markersRef=useRef({});
  const [ready,setReady]=useState(false), [coords,setCoords]=useState(null), [recordCoords,setRecordCoords]=useState({}), [search,setSearch]=useState(""), [locStatus,setLocStatus]=useState("Comprobando ubicación…"), [selectedMapVisit,setSelectedMapVisit]=useState(null), [selectedMapPos,setSelectedMapPos]=useState(null);
  const located=useMemo(()=>visits.filter(v=>!!v.ubicacion),[visits]);
  const without=useMemo(()=>visits.filter(v=>!v.ubicacion),[visits]);
  const visibleList=useMemo(()=>visits.filter(v=>`${v.nombre_completo} ${v.tipo}`.toLowerCase().includes(search.toLowerCase().trim())),[visits,search]);

  useEffect(()=>{ let cancelled=false; (async()=>{await loadLeaflet(); if(cancelled||!mapRef.current)return; setReady(true); setCoords(getLocalityCenter(locality.nombre));})(); return()=>{cancelled=true;};},[locality.id,locality.nombre]);

  useEffect(()=>{ if(!ready||!coords||!window.L||!mapRef.current)return; const L=window.L; if(instanceRef.current) instanceRef.current.remove(); const map=L.map(mapRef.current,{zoomControl:true});
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OpenStreetMap contributors",maxZoom:19}).addTo(map);
    map.setView(coords,13); instanceRef.current=map;
    const localMarker=L.marker(coords,{icon:L.divIcon({className:"localityMarker",html:`<div class="localityDot"></div>`,iconSize:[20,20],iconAnchor:[10,10]})}).addTo(map).bindTooltip(locality.nombre,{permanent:false});
    return()=>{localMarker.remove(); map.remove();instanceRef.current=null;};
  },[ready,coords,locality.id,locality.nombre]);

  useEffect(()=>{ let cancelled=false; (async()=>{const out={}; for(const v of located){ const c=await resolveMapCoords(v.ubicacion); if(c&&!cancelled) out[v.id]=c; } if(!cancelled)setRecordCoords(out);})(); return()=>{cancelled=true;}; },[locality.id,located.map(v=>`${v.id}:${v.ubicacion}`).join("|")]);

  const updateSelectedPosition = () => {
    if (!instanceRef.current || !selectedMapVisit) { setSelectedMapPos(null); return; }
    const c=recordCoords[selectedMapVisit.id];
    if(!c){ setSelectedMapPos(null); return; }
    const pt=instanceRef.current.latLngToContainerPoint(c);
    const w=mapRef.current?.clientWidth || 600;
    const h=mapRef.current?.clientHeight || 390;
    setSelectedMapPos({left:Math.max(125,Math.min(w-125,pt.x)),top:Math.max(82,pt.y)});
  };

  useEffect(()=>{ if(!instanceRef.current||!window.L)return; const L=window.L; Object.values(markersRef.current).forEach(m=>m.remove()); markersRef.current={};
    Object.entries(recordCoords).forEach(([id,c])=>{const v=visits.find(x=>x.id===id); if(!v)return; const marker=L.marker(c,{icon:typeMarkerIcon(L,v.tipo,v.estado,selectedMapVisit?.id===v.id),zIndexOffset:selectedMapVisit?.id===v.id?500:0}).addTo(instanceRef.current); marker.on("click",()=>{setSelectedMapVisit(v); instanceRef.current?.setView(c,Math.max(instanceRef.current.getZoom(),16),{animate:true});}); markersRef.current[id]=marker; });
    updateSelectedPosition();
  },[recordCoords,visits,selectedMapVisit]);

  useEffect(()=>{ const map=instanceRef.current; if(!map)return; const fn=()=>updateSelectedPosition(); map.on("move zoom resize",fn); updateSelectedPosition(); return()=>map.off("move zoom resize",fn); },[selectedMapVisit,recordCoords]);

  useEffect(()=>{ if(!navigator.geolocation){setLocStatus("Este navegador no permite conocer tu ubicación.");return;} navigator.geolocation.getCurrentPosition(async pos=>{ if(!instanceRef.current)return; const L=window.L; const here=[pos.coords.latitude,pos.coords.longitude]; L.circleMarker(here,{radius:7,color:"#4f3a78",fillColor:"#8a68b5",fillOpacity:.9,weight:3}).addTo(instanceRef.current).bindTooltip("Tu ubicación"); const target=coords; const distanceKm=target?distanceBetween(here,target):999; setLocStatus(distanceKm<35?"Estás en esta localidad":"No estás en esta localidad"); },()=>setLocStatus("No se pudo obtener tu ubicación."),{enableHighAccuracy:true,timeout:10000}); },[ready,coords,locality.id]);

  function focus(v){const c=recordCoords[v.id]; if(c&&instanceRef.current){setSelectedMapVisit(v); instanceRef.current.setView(c,16,{animate:true}); setTimeout(updateSelectedPosition,220);} else {onDetail(v);} }
  const selectedHasLocation=selectedMapVisit && recordCoords[selectedMapVisit.id];
  return <div className="mapSection"><div className="mapSectionHead"><div><h3><MapPinned /> Mapa de {locality.nombre}</h3><p>{located.length} registros con ubicación · {without.length} sin ubicación</p></div><span className={`locationStatus ${locStatus.startsWith("Estás")?"inside":"outside"}`}><LocateFixed /> {locStatus}</span></div><div className="mapLayout"><div className="mapRecordsPanel"><div className="search filterSearch mapSearch"><Search /><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nombre..." /></div><div className="mapRecordList">{visibleList.map(v=>{const has=!!recordCoords[v.id];const selected=selectedMapVisit?.id===v.id;return <button key={v.id} className={`mapRecordItem ${selected?"selected":""}`} onClick={()=>has?focus(v):onDetail(v)}><span className={`miniType ${tipoClass(v.tipo)}`}>{tipoIcon(v.tipo)}</span><span><b>{v.nombre_completo}</b><small>{v.tipo}{has?"":" · Sin ubicación"}</small></span><ChevronRight /></button>})}{!visibleList.length&&<div className="empty mapEmpty">No hay registros.</div>}</div></div><div className="mapCanvasWrap"><div ref={mapRef} className="mapCanvas"></div>{!ready&&<div className="mapLoading">Cargando mapa…</div>}{selectedMapVisit && <div className={`mapSelectedCard ${selectedHasLocation?"withLocation":"corner"}`} style={selectedHasLocation&&selectedMapPos?{left:selectedMapPos.left,top:selectedMapPos.top}:{}}><button className="mapSelectedClose" onClick={()=>setSelectedMapVisit(null)}><X /></button><div className="mapPopupPhoto">{selectedMapVisit.foto_url?<img src={selectedMapVisit.foto_url} alt="" />:<div className="mapNoPhoto">{selectedMapVisit.tipo}</div>}</div><b>{selectedMapVisit.nombre_completo||"Sin nombre"}</b><small>{selectedMapVisit.tipo} · {selectedMapVisit.estado||""}</small><button className="mapDetailBtn" onClick={()=>onDetail(selectedMapVisit)}>Ver más detalles</button></div>}</div></div></div>;
}
function escapeHtml(value){return String(value||"").replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function distanceBetween(a,b){const R=6371,rad=x=>x*Math.PI/180;const dLat=rad(b[0]-a[0]),dLon=rad(b[1]-a[1]);const x=Math.sin(dLat/2)**2+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(dLon/2)**2;return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));}

function SetupGuide() { return <div className="setup"><div className="setupCard"><div className="brandmark">I</div><h1>Visitas Provincias</h1><p>Imagina · Sonriure</p><h2>Configura Supabase</h2><p>Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en GitHub Actions y ejecuta la migración SQL indicada.</p></div></div>; }

function SplashScreen() {
  return <div className="splash">
    <div className="splashContent">
      <img src={LOGO_URL} alt="Clínica Dental Imagina" className="splashLogo" />
      <div className="splashLoader" aria-label="Cargando"><span></span><span></span><span></span></div>
      <p>Visitas Provincias · Imagina · Sonriure</p>
    </div>
  </div>;
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function login(e) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });
    if (authError) {
      const message = authError.message || "";
      setError(message.toLowerCase().includes("jwt issued at future")
        ? "La fecha y hora de este equipo parecen estar adelantadas. Activa la fecha y hora automáticas del sistema y vuelve a intentar. Este aviso no es un error de contraseña."
        : message === "Invalid login credentials"
          ? "Correo o contraseña incorrectos."
          : message);
    }
    setBusy(false);
  }

  return <div className="authPage">
    <div className="authCard">
      <div className="authLogoWrap"><img src={LOGO_URL} alt="Clínica Dental Imagina" className="authLogo" /></div>
      <div className="authHeading"><ShieldCheck /><div><h1>Visitas Provincias</h1><p>Acceso seguro al sistema</p></div></div>
      <form onSubmit={login} className="authForm">
        <label><span>Correo electrónico</span><div className="authInput"><Mail /><input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" placeholder="correo@ejemplo.com" required /></div></label>
        <label><span>Contraseña</span><div className="authInput"><LockKeyhole /><input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" placeholder="••••••••" required /></div></label>
        {error && <div className="authError"><span>{error}</span><button type="button" className="authErrorClose" onClick={() => setError("")} title="Cerrar aviso"><X /></button></div>}
        <button className="primary authSubmit" type="submit" disabled={busy}>{busy ? "Iniciando sesión..." : "Iniciar sesión"}</button>
      </form>
      <div className="authSecurity"><ShieldCheck /><span>Acceso protegido mediante Supabase Auth</span></div>
    </div>
  </div>;
}

function AuthApp() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(!!supabase);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setBooting(false), 1200);
    if (!supabase) {
      setAuthLoading(false);
      return () => window.clearTimeout(timer);
    }
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setAuthLoading(false);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });
    return () => {
      mounted = false;
      window.clearTimeout(timer);
      listener?.subscription?.unsubscribe();
    };
  }, []);

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) window.alert(error.message);
  }

  if (booting) return <SplashScreen />;
  if (!supabase) return <SetupGuide />;
  if (authLoading) return <div className="authLoading"><div className="authLoadingCard"><img src={LOGO_URL} alt="Clínica Dental Imagina" /><span>Verificando sesión...</span></div></div>;
  if (!session) return <LoginScreen />;
  return <App session={session} onSignOut={signOut} />;
}

createRoot(document.getElementById("root")).render(<AuthApp />);
