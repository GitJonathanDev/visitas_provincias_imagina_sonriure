import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import {
  Search, Plus, MapPin, MessageCircle, Camera, Eye, Pencil, Trash2,
  BarChart3, ClipboardList, Map, Menu, X, Check, Users, CalendarDays,
  RefreshCw, Filter, ExternalLink, Image as ImageIcon, Package, CalendarRange
} from "lucide-react";
import "./styles.css";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

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

const emptyVisit = {
  id: null, localidad_id: "", codigo: "", nombre_completo: "", numero: "", tipo: "Dentista",
  descripcion_interes: "", visitado_como: "Imagina", estado: "No visitado", revisado_call_center: false,
  fecha_visita: "", ubicacion: "", observaciones: "", foto_url: ""
};
const emptyPedido = {
  id: null, visita_id: "", localidad_id: "", descripcion: "", cantidad: 1,
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

function App() {
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

  const configured = !!supabase;

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    if (!supabase) { setLoading(false); return; }
    setLoading(true); setError("");
    const [lr, vr, pr] = await Promise.all([
      supabase.from("localidades").select("*").eq("activo", true).order("nombre"),
      supabase.from("visitas").select("*").order("codigo"),
      supabase.from("pedidos").select("*").order("fecha", { ascending: false })
    ]);
    if (lr.error) setError(lr.error.message);
    if (vr.error) setError(vr.error.message);
    if (pr.error) setError(pr.error.message);
    const ls = lr.data || [];
    setLocalidades(ls);
    setVisitas(vr.data || []);
    setPedidos(pr.data || []);
    setLocalidad(prev => prev && ls.some(l => l.id === prev.id) ? prev : (ls[0] || null));
    setLoading(false);
  }

  async function saveVisit(v) {
    if (!supabase) return;
    const payload = { ...v }; delete payload.id;
    const result = v.id
      ? await supabase.from("visitas").update(payload).eq("id", v.id)
      : await supabase.from("visitas").insert(payload);
    if (result.error) return setError(result.error.message);
    setModal(null); await loadAll();
  }

  async function removeVisit(id) {
    if (!supabase || !confirm("¿Eliminar este registro? Esta acción no se puede deshacer.")) return;
    const { error } = await supabase.from("visitas").delete().eq("id", id);
    if (error) setError(error.message); else await loadAll();
  }

  async function quickVisit(id, field, value) {
    if (!supabase) return;
    const { error } = await supabase.from("visitas").update({ [field]: value }).eq("id", id);
    if (error) setError(error.message); else setVisitas(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v));
  }

  async function savePedido(p) {
    if (!supabase) return;
    const payload = { ...p, cantidad: Number(p.cantidad) || 1 };
    delete payload.id;
    const result = p.id
      ? await supabase.from("pedidos").update(payload).eq("id", p.id)
      : await supabase.from("pedidos").insert(payload);
    if (result.error) return setError(result.error.message);
    setModal(null); await loadAll();
  }

  async function removePedido(id) {
    if (!supabase || !confirm("¿Eliminar este pedido? Esta acción no se puede deshacer.")) return;
    const { error } = await supabase.from("pedidos").delete().eq("id", id);
    if (error) setError(error.message); else await loadAll();
  }

  async function addLocalidad() {
    const nombre = prompt("Nombre de la nueva localidad:");
    if (!nombre?.trim() || !supabase) return;
    const { data, error } = await supabase.from("localidades").insert({ nombre: nombre.trim() }).select().single();
    if (error) setError(error.message);
    else { setLocalidades(prev => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre))); setLocalidad(data); }
  }

  const currentVisits = useMemo(() => visitas.filter(v => v.localidad_id === localidad?.id), [visitas, localidad]);
  const filteredVisits = useMemo(() => currentVisits.filter(v => {
    const q = search.toLowerCase().trim();
    if (q && !`${v.codigo} ${v.nombre_completo} ${v.numero} ${v.tipo} ${v.estado} ${v.visitado_como}`.toLowerCase().includes(q)) return false;
    if (visitFilters.call === "si" && !v.revisado_call_center) return false;
    if (visitFilters.call === "no" && v.revisado_call_center) return false;
    if (visitFilters.tipo !== "todos" && v.tipo !== visitFilters.tipo) return false;
    if (visitFilters.visitado !== "todos" && v.visitado_como !== visitFilters.visitado) return false;
    if (visitFilters.estado !== "todos" && v.estado !== visitFilters.estado) return false;
    return true;
  }), [currentVisits, search, visitFilters]);

  const counts = useMemo(() => ({
    total: currentVisits.length,
    visitados: currentVisits.filter(v => v.estado?.startsWith("Visitado")).length,
    no: currentVisits.filter(v => v.estado === "No visitado").length,
    call: currentVisits.filter(v => v.revisado_call_center).length
  }), [currentVisits]);

  if (!configured) return <SetupGuide />;

  return <div className="app">
    <aside className={`sidebar ${mobileMenu ? "open" : ""}`}>
      <div className="brand">
        <div className="brandmark">I</div>
        <div><b>Visitas Provincias</b><small>Imagina · Sonriure</small></div>
        <button className="iconbtn mobileClose" onClick={() => setMobileMenu(false)}><X /></button>
      </div>
      <nav>
        <button className={tab === "visitas" ? "active" : ""} onClick={() => { setTab("visitas"); setMobileMenu(false); }}><Users /> Visitas</button>
        <button className={tab === "pedidos" ? "active" : ""} onClick={() => { setTab("pedidos"); setMobileMenu(false); }}><ClipboardList /> Pedidos</button>
        <button className={tab === "estadisticas" ? "active" : ""} onClick={() => { setTab("estadisticas"); setMobileMenu(false); }}><BarChart3 /> Estadísticas</button>
        <button className={tab === "localidades" ? "active" : ""} onClick={() => { setTab("localidades"); setMobileMenu(false); }}><Map /> Localidades</button>
      </nav>
      <div className="sidebarFoot">Sistema de gestión de visitas</div>
    </aside>
    <main>
      <header>
        <button className="iconbtn mobileOpen" onClick={() => setMobileMenu(true)}><Menu /></button>
        <div><h1>{tab === "visitas" ? "Visitas" : tab === "pedidos" ? "Pedidos" : tab === "estadisticas" ? "Estadísticas" : "Localidades"}</h1><p>Gestión de visitas provinciales</p></div>
        <button className="iconbtn" title="Actualizar" onClick={loadAll}><RefreshCw /></button>
      </header>
      {error && <div className="alert">{error}<button onClick={() => setError("")}>×</button></div>}
      {loading && <div className="loading">Cargando información...</div>}

      {!loading && tab === "visitas" && <section>
        <div className="localityTabs">
          {localidades.map(l => <button key={l.id} className={localidad?.id === l.id ? "selected" : ""} onClick={() => setLocalidad(l)}>{l.nombre}</button>)}
          <button className="addTab" onClick={addLocalidad}><Plus /> Agregar</button>
        </div>
        <VisitFilters search={search} setSearch={setSearch} filters={visitFilters} setFilters={setVisitFilters} />
        <div className="toolbarActions"><button className="primary" onClick={() => setModal({ type: "visit", data: { ...emptyVisit, localidad_id: localidad?.id } })}><Plus /> Nueva visita</button></div>
        <div className="statsMini"><Stat icon={<Users />} label="Total" value={counts.total} /><Stat icon={<Check />} label="Visitados" value={counts.visitados} /><Stat icon={<CalendarDays />} label="No visitados" value={counts.no} /><Stat icon={<PhoneIcon />} label="Call center" value={counts.call} /></div>
        <div className="tableWrap"><table><thead><tr><th>COD</th><th>Nombre completo</th><th>Número</th><th>Tipo</th><th>Estado</th><th>Call Center</th><th></th></tr></thead><tbody>
          {filteredVisits.map(v => <tr key={v.id}>
            <td className="code">{v.codigo}</td>
            <td><div className="person"><button className="avatar avatarButton" onClick={() => v.foto_url && setLightbox(v.foto_url)} title={v.foto_url ? "Ver fotografía" : "Sin fotografía"}>{v.foto_url ? <img src={v.foto_url} /> : <Users />}</button><span>{v.nombre_completo}</span></div></td>
            <td><div className="phone"><span>{v.numero}</span>{v.numero && <a title="WhatsApp" href={wa(v.numero)} target="_blank" rel="noreferrer"><MessageCircle /></a>}</div></td>
            <td>{v.tipo}</td>
            <td><select className={`status ${estadoClass(v.estado)}`} value={v.estado} onChange={e => quickVisit(v.id, "estado", e.target.value)}>{ESTADOS.map(x => <option key={x}>{x}</option>)}</select></td>
            <td><button className={`toggle ${v.revisado_call_center ? "yes" : ""}`} onClick={() => quickVisit(v.id, "revisado_call_center", !v.revisado_call_center)}>{v.revisado_call_center ? "Sí" : "No"}</button></td>
            <td><div className="actions"><button className="iconbtn" title="Ver detalles" onClick={() => setModal({ type: "detail", data: v })}><Eye /></button><button className="iconbtn" title="Editar" onClick={() => setModal({ type: "visit", data: v })}><Pencil /></button><button className="iconbtn danger" title="Eliminar" onClick={() => removeVisit(v.id)}><Trash2 /></button></div></td>
          </tr>)}
          {!filteredVisits.length && <tr><td colSpan="7" className="empty">No hay registros para los filtros seleccionados.</td></tr>}
        </tbody></table></div>
      </section>}

      {!loading && tab === "estadisticas" && <Stats visits={visitas} localidades={localidades} pedidos={pedidos} />}
      {!loading && tab === "pedidos" && <Orders pedidos={pedidos} localidades={localidades} visitas={visitas} onSave={savePedido} onDelete={removePedido} onEdit={p => setModal({ type: "pedido", data: p })} onNew={() => setModal({ type: "pedido", data: { ...emptyPedido, localidad_id: localidad?.id || localidades[0]?.id || "" } })} />}
      {!loading && tab === "localidades" && <Localidades ls={localidades} onAdd={addLocalidad} />}
    </main>
    {modal?.type === "visit" && <VisitModal data={modal.data} localidades={localidades} onClose={() => setModal(null)} onSave={saveVisit} onImage={setLightbox} />}
    {modal?.type === "detail" && <DetailModal data={modal.data} onClose={() => setModal(null)} onImage={setLightbox} />}
    {modal?.type === "pedido" && <PedidoModal data={modal.data} localidades={localidades} visitas={visitas} onClose={() => setModal(null)} onSave={savePedido} />}
    {lightbox && <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />}
  </div>;
}

function PhoneIcon() { return <MessageCircle />; }
function Stat({ icon, label, value }) { return <div className="stat"><span>{icon}</span><div><b>{value}</b><small>{label}</small></div></div>; }

function VisitFilters({ search, setSearch, filters, setFilters }) {
  const clear = () => setFilters({ call: "todos", tipo: "todos", visitado: "todos", estado: "todos" });
  return <div className="filtersCard">
    <div className="filterHeader"><div><Filter /><b>Filtros de visitas</b></div><button className="clearBtn" onClick={clear}>Limpiar filtros</button></div>
    <div className="filterGrid">
      <div className="search filterSearch"><Search /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, código, número..." /></div>
      <label>Call Center<select value={filters.call} onChange={e => setFilters({ ...filters, call: e.target.value })}><option value="todos">Todos</option><option value="si">Sí</option><option value="no">No</option></select></label>
      <label>Tipo<select value={filters.tipo} onChange={e => setFilters({ ...filters, tipo: e.target.value })}><option value="todos">Todos</option>{TIPOS.map(t => <option key={t}>{t}</option>)}</select></label>
      <label>Visitado como<select value={filters.visitado} onChange={e => setFilters({ ...filters, visitado: e.target.value })}><option value="todos">Todos</option>{VISITADO.map(t => <option key={t}>{t}</option>)}</select></label>
      <label>Estado<select value={filters.estado} onChange={e => setFilters({ ...filters, estado: e.target.value })}><option value="todos">Todos</option>{ESTADOS.map(t => <option key={t}>{t}</option>)}</select></label>
    </div>
  </div>;
}

function VisitModal({ data, localidades, onClose, onSave, onImage }) {
  const [v, setV] = useState(data); const fileRef = useRef();
  const set = (k, x) => setV(prev => ({ ...prev, [k]: x }));
  async function photo(e) {
    const f = e.target.files?.[0]; if (!f || !supabase) return;
    const ext = f.name.split(".").pop() || "jpg"; const path = `visitas/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("fotos").upload(path, f, { upsert: false });
    if (error) return alert(error.message);
    const { data: u } = supabase.storage.from("fotos").getPublicUrl(path); set("foto_url", u.publicUrl);
  }
  return <div className="overlay"><div className="modal largeModal"><div className="modalHead"><h2>{v.id ? "Editar visita" : "Nueva visita"}</h2><button className="iconbtn" onClick={onClose}><X /></button></div>
    <div className="formGrid">
      <label>Localidad<select value={v.localidad_id} onChange={e => set("localidad_id", e.target.value)}>{localidades.map(l => <option value={l.id} key={l.id}>{l.nombre}</option>)}</select></label>
      <label>COD<input value={v.codigo} onChange={e => set("codigo", e.target.value)} placeholder="Ej. CAM-001" /></label>
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

function DetailModal({ data: v, onClose, onImage }) {
  return <div className="overlay"><div className="modal"><div className="modalHead"><h2>Detalle de visita</h2><button className="iconbtn" onClick={onClose}><X /></button></div>
    <div className="detailTop"><button className="detailPhotoButton" onClick={() => v.foto_url && onImage(v.foto_url)}>{v.foto_url ? <img src={v.foto_url} className="detailPhoto" /> : <div className="detailPhoto placeholder"><Camera /></div>}</button><div><h3>{v.nombre_completo}</h3><p>{v.codigo} · {v.tipo}</p><span className={`pill ${estadoClass(v.estado)}`}>{v.estado}</span></div></div>
    <div className="detailGrid"><Info k="Número" v={v.numero || "—"} link={v.numero ? wa(v.numero) : null} /><Info k="Visitado como" v={v.visitado_como} /><Info k="Fecha de visita" v={formatDate(v.fecha_visita)} /><Info k="Call Center" v={v.revisado_call_center ? "Sí" : "No"} /><Info k="Descripción / interés" v={v.descripcion_interes || "—"} /><Info k="Observaciones" v={v.observaciones || "—"} /><Info k="Ubicación" v={v.ubicacion || "—"} link={v.ubicacion ? maps(v.ubicacion) : null} /></div>
  </div></div>;
}
function Info({ k, v, link }) { return <div className="info"><small>{k}</small>{link ? <a href={link} target="_blank" rel="noreferrer">{v} <ExternalLink /></a> : <span>{v}</span>}</div>; }

function ImageLightbox({ src, onClose }) {
  return <div className="imageOverlay" onClick={onClose}><div className="imageLightbox" onClick={e => e.stopPropagation()}><button className="lightboxClose" onClick={onClose}><X /></button><img src={src} alt="Fotografía ampliada" /></div></div>;
}

function Stats({ visits, localidades, pedidos }) {
  const states = Object.fromEntries(ESTADOS.map(e => [e, visits.filter(v => v.estado === e).length]));
  return <section className="page">
    <div className="pageTitle"><div><h2>Estadísticas</h2><p>Resumen general de todas las localidades.</p></div></div>
    <div className="bigStats"><Stat label="Registros" value={visits.length} icon={<Users />} /><Stat label="Visitados" value={visits.filter(v => v.estado?.startsWith("Visitado")).length} icon={<Check />} /><Stat label="Pedidos" value={pedidos.length} icon={<Package />} /><Stat label="Call Center" value={visits.filter(v => v.revisado_call_center).length} icon={<MessageCircle />} /></div>
    <div className="statsColumns">
      <div className="card"><h3>Estados</h3>{ESTADOS.map(e => { const n = states[e] || 0; return <div className="barrow" key={e}><span>{e}</span><div className="bar"><i style={{ width: `${visits.length ? Math.round(n / visits.length * 100) : 0}%` }} /></div><b>{n}</b></div>; })}</div>
      <div className="card"><h3>Registros por localidad</h3>{localidades.map(l => { const n = visits.filter(v => v.localidad_id === l.id).length; return <div className="barrow" key={l.id}><span>{l.nombre}</span><div className="bar"><i style={{ width: `${visits.length ? Math.round(n / visits.length * 100) : 0}%` }} /></div><b>{n}</b></div>; })}</div>
    </div>
  </section>;
}

function Orders({ pedidos, localidades, visitas, onSave, onDelete, onEdit, onNew }) {
  const [localidadId, setLocalidadId] = useState("todos");
  const [period, setPeriod] = useState("general");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [visitFilters, setVisitFilters] = useState({ call: "todos", tipo: "todos", visitado: "todos", estado: "todos" });
  const filtered = useMemo(() => pedidos.filter(p => {
    if (localidadId !== "todos" && p.localidad_id !== localidadId) return false;
    const d = p.fecha || "";
    if (period === "mes" && !d.startsWith(month)) return false;
    if (period === "rango" && ((from && d < from) || (to && d > to))) return false;
    const q = search.toLowerCase().trim();
    if (q && !`${p.descripcion} ${p.estado} ${p.observaciones || ""}`.toLowerCase().includes(q)) return false;
    return true;
  }), [pedidos, localidadId, period, month, from, to, search]);
  return <section className="page">
    <div className="pageTitle"><div><h2>Pedidos</h2><p>Agrega, edita, elimina y filtra pedidos por localidad y fecha.</p></div><button className="primary" onClick={onNew}><Plus /> Nuevo pedido</button></div>
    <div className="localityTabs orderLocalityTabs">
      <button className={localidadId === "todos" ? "selected" : ""} onClick={() => setLocalidadId("todos")}>Todas</button>
      {localidades.map(l => <button key={l.id} className={localidadId === l.id ? "selected" : ""} onClick={() => setLocalidadId(l.id)}>{l.nombre}</button>)}
    </div>
    <div className="orderFilters filtersCard"><div className="filterHeader"><div><Filter /><b>Filtros de pedidos</b></div><button className="clearBtn" onClick={() => { setLocalidadId("todos"); setPeriod("general"); setMonth(new Date().toISOString().slice(0, 7)); setFrom(""); setTo(""); setSearch(""); }}>Limpiar filtros</button></div>
      <div className="filterGrid orderGrid"><label>Localidad<select value={localidadId} onChange={e => setLocalidadId(e.target.value)}><option value="todos">Todas</option>{localidades.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}</select></label><label>Periodo<select value={period} onChange={e => setPeriod(e.target.value)}><option value="general">General</option><option value="mes">Mes</option><option value="rango">Rango de fechas</option></select></label>{period === "mes" && <label>Mes<input type="month" value={month} onChange={e => setMonth(e.target.value)} /></label>}{period === "rango" && <><label>Desde<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label>Hasta<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label></>}<div className="search filterSearch"><Search /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar pedido..." /></div></div>
    </div>
    <div className="statsMini"><Stat icon={<Package />} label="Resultados" value={filtered.length} /><Stat icon={<CalendarRange />} label="Pendientes" value={filtered.filter(p => p.estado === "Pendiente").length} /><Stat icon={<Check />} label="Entregados" value={filtered.filter(p => p.estado === "Entregado").length} /></div>
    <div className="tableWrap"><table><thead><tr><th>Fecha</th><th>Localidad</th><th>Pedido</th><th>Cantidad</th><th>Estado</th><th>Observaciones</th><th></th></tr></thead><tbody>{filtered.map(p => { const l = localidades.find(x => x.id === p.localidad_id); return <tr key={p.id}><td>{formatDate(p.fecha)}</td><td>{l?.nombre || "—"}</td><td><b>{p.descripcion}</b></td><td>{p.cantidad}</td><td><span className={`orderStatus ${p.estado?.toLowerCase().replaceAll(" ", "-")}`}>{p.estado}</span></td><td>{p.observaciones || "—"}</td><td><div className="actions"><button className="iconbtn" title="Editar" onClick={() => onEdit(p)}><Pencil /></button><button className="iconbtn danger" title="Eliminar" onClick={() => onDelete(p.id)}><Trash2 /></button></div></td></tr>; })}{!filtered.length && <tr><td colSpan="7" className="empty">No hay pedidos para los filtros seleccionados.</td></tr>}</tbody></table></div>
  </section>;
}

function PedidoModal({ data, localidades, visitas, onClose, onSave }) {
  const [p, setP] = useState(data);
  const set = (k, x) => setP(prev => ({ ...prev, [k]: x }));
  const localVisits = visitas.filter(v => v.localidad_id === p.localidad_id);
  return <div className="overlay"><div className="modal"><div className="modalHead"><h2>{p.id ? "Editar pedido" : "Nuevo pedido"}</h2><button className="iconbtn" onClick={onClose}><X /></button></div><div className="formGrid">
    <label>Localidad<select value={p.localidad_id || ""} onChange={e => { set("localidad_id", e.target.value); set("visita_id", ""); }}>{localidades.map(l => <option value={l.id} key={l.id}>{l.nombre}</option>)}</select></label>
    <label>Visita relacionada<select value={p.visita_id || ""} onChange={e => set("visita_id", e.target.value)}><option value="">Sin visita específica</option>{localVisits.map(v => <option value={v.id} key={v.id}>{v.codigo} · {v.nombre_completo}</option>)}</select></label>
    <label className="wide">Pedido / descripción<input value={p.descripcion || ""} onChange={e => set("descripcion", e.target.value)} placeholder="Ej. 10 kits, 5 cajas, material promocional..." /></label>
    <label>Cantidad<input type="number" min="1" value={p.cantidad ?? 1} onChange={e => set("cantidad", e.target.value)} /></label>
    <label>Estado<select value={p.estado || "Pendiente"} onChange={e => set("estado", e.target.value)}>{PEDIDO_ESTADOS.map(x => <option key={x}>{x}</option>)}</select></label>
    <label>Fecha<input type="date" value={p.fecha || ""} onChange={e => set("fecha", e.target.value)} /></label>
    <label className="wide">Observaciones<textarea value={p.observaciones || ""} onChange={e => set("observaciones", e.target.value)} /></label>
  </div><div className="modalFoot"><button className="secondary" onClick={onClose}>Cancelar</button><button className="primary" onClick={() => onSave(p)}><Check /> Guardar pedido</button></div></div></div>;
}

function Localidades({ ls, onAdd }) { return <section className="page"><div className="pageTitle"><div><h2>Localidades</h2><p>Administra las localidades disponibles.</p></div><button className="primary" onClick={onAdd}><Plus /> Nueva localidad</button></div><div className="cards">{ls.map(l => <div className="localCard" key={l.id}><MapPin /><div><b>{l.nombre}</b><small>Activa</small></div></div>)}</div></section>; }
function SetupGuide() { return <div className="setup"><div className="setupCard"><div className="brandmark">I</div><h1>Visitas Provincias</h1><p>Imagina · Sonriure</p><h2>Configura Supabase</h2><p>Configura las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en GitHub Actions y ejecuta supabase/schema.sql en Supabase.</p></div></div>; }

createRoot(document.getElementById("root")).render(<App />);
