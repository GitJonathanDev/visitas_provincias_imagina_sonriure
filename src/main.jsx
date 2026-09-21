import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import { Search, Plus, MapPin, Phone, MessageCircle, Camera, Eye, Pencil, Trash2, BarChart3, ClipboardList, Map, Menu, X, Check, ChevronDown, Upload, Building2, Users, CalendarDays, RefreshCw } from "lucide-react";
import "./styles.css";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const TIPOS = ["Dentista","Técnico","Hospital","Farmacia"];
const VISITADO = ["Sonriure","Imagina","Ambos"];
const ESTADOS = ["Visitado","Visitado (interesado Imagina)","Visitado (interesado Sonriure)","Visitado (interesado Ambos)","Cerrado por visitar","No visitado","Visitado (no interesado)"];
const estadoClass = e => ({ "Visitado":"visited","Visitado (interesado Imagina)":"imagine","Visitado (interesado Sonriure)":"sonriure","Visitado (interesado Ambos)":"both","Cerrado por visitar":"closed","No visitado":"notvisited","Visitado (no interesado)":"uninterested" }[e] || "");

const emptyVisit = { id:null, localidad_id:"", codigo:"", nombre_completo:"", numero:"", tipo:"Dentista", descripcion_interes:"", visitado_como:"Imagina", estado:"No visitado", revisado_call_center:false, fecha_visita:"", ubicacion:"", observaciones:"", foto_url:"" };

function wa(n){ const d=(n||"").replace(/\D/g,""); return d ? `https://wa.me/${d.startsWith("591")?d:"591"+d}` : "#"; }
function maps(u){ return u?.trim() || "#"; }

function App(){
  const [tab,setTab]=useState("visitas"), [localidades,setLocalidades]=useState([]), [localidad,setLocalidad]=useState(null);
  const [visitas,setVisitas]=useState([]), [pedidos,setPedidos]=useState([]), [stats,setStats]=useState({});
  const [search,setSearch]=useState(""), [loading,setLoading]=useState(true), [error,setError]=useState("");
  const [modal,setModal]=useState(null), [mobileMenu,setMobileMenu]=useState(false);

  const configured=!!supabase;
  useEffect(()=>{ loadAll(); },[]);
  useEffect(()=>{ if(localidad) loadVisitas(localidad.id); },[localidad]);

  async function loadAll(){
    if(!supabase){ setLoading(false); return; }
    setLoading(true); setError("");
    const {data:ls,error:le}=await supabase.from("localidades").select("*").eq("activo",true).order("nombre");
    if(le){setError(le.message);setLoading(false);return;}
    setLocalidades(ls||[]); setLocalidad(ls?.[0]||null);
    const {data:ps}=await supabase.from("pedidos").select("*").order("fecha",{ascending:false});
    setPedidos(ps||[]); setLoading(false);
  }
  async function loadVisitas(id){
    if(!supabase||!id)return;
    const {data,error}=await supabase.from("visitas").select("*").eq("localidad_id",id).order("codigo");
    if(error)setError(error.message); else setVisitas(data||[]);
  }
  async function saveVisit(v){
    if(!supabase)return;
    const payload={...v}; delete payload.id;
    if(v.id){
      const {error}=await supabase.from("visitas").update(payload).eq("id",v.id);
      if(error)return setError(error.message);
    }else{
      const {error}=await supabase.from("visitas").insert(payload);
      if(error)return setError(error.message);
    }
    setModal(null); await loadVisitas(localidad.id);
  }
  async function removeVisit(id){
    if(!supabase || !confirm("¿Eliminar este registro? Esta acción no se puede deshacer."))return;
    const {error}=await supabase.from("visitas").delete().eq("id",id);
    if(error)setError(error.message); else loadVisitas(localidad.id);
  }
  async function quick(id,field,value){
    if(!supabase)return;
    const {error}=await supabase.from("visitas").update({[field]:value}).eq("id",id);
    if(error)setError(error.message); else loadVisitas(localidad.id);
  }
  async function addLocalidad(){
    const nombre=prompt("Nombre de la nueva localidad:");
    if(!nombre?.trim()||!supabase)return;
    const {data,error}=await supabase.from("localidades").insert({nombre:nombre.trim()}).select().single();
    if(error)setError(error.message); else {setLocalidades([...localidades,data].sort((a,b)=>a.nombre.localeCompare(b.nombre)));setLocalidad(data);}
  }
  const filtered=useMemo(()=>visitas.filter(v=>`${v.codigo} ${v.nombre_completo} ${v.numero} ${v.tipo} ${v.estado}`.toLowerCase().includes(search.toLowerCase())),[visitas,search]);
  const counts=useMemo(()=>({total:visitas.length,visitados:visitas.filter(v=>v.estado?.startsWith("Visitado")).length,no:visitas.filter(v=>v.estado==="No visitado").length,call:visitas.filter(v=>v.revisado_call_center).length,imagine:visitas.filter(v=>v.estado==="Visitado (interesado Imagina)").length,sonriure:visitas.filter(v=>v.estado==="Visitado (interesado Sonriure)").length,both:visitas.filter(v=>v.estado==="Visitado (interesado Ambos)").length}),[visitas]);

  if(!configured) return <SetupGuide/>;

  return <div className="app">
    <aside className={`sidebar ${mobileMenu?"open":""}`}>
      <div className="brand"><div className="brandmark">I</div><div><b>Visitas Provincias</b><small>Imagina · Sonriure</small></div><button className="iconbtn mobileClose" onClick={()=>setMobileMenu(false)}><X/></button></div>
      <nav>
        <button className={tab==="visitas"?"active":""} onClick={()=>{setTab("visitas");setMobileMenu(false)}}><Users/> Visitas</button>
        <button className={tab==="pedidos"?"active":""} onClick={()=>{setTab("pedidos");setMobileMenu(false)}}><ClipboardList/> Pedidos</button>
        <button className={tab==="estadisticas"?"active":""} onClick={()=>{setTab("estadisticas");setMobileMenu(false)}}><BarChart3/> Estadísticas</button>
        <button className={tab==="localidades"?"active":""} onClick={()=>{setTab("localidades");setMobileMenu(false)}}><Map/> Localidades</button>
      </nav>
      <div className="sidebarFoot">Sistema de gestión de visitas</div>
    </aside>
    <main>
      <header><button className="iconbtn mobileOpen" onClick={()=>setMobileMenu(true)}><Menu/></button><div><h1>{tab==="visitas"?"Visitas":tab==="pedidos"?"Pedidos":tab==="estadisticas"?"Estadísticas":"Localidades"}</h1><p>Gestión de visitas provinciales</p></div><button className="iconbtn" onClick={loadAll}><RefreshCw/></button></header>
      {error&&<div className="alert">{error}<button onClick={()=>setError("")}>×</button></div>}
      {tab==="visitas"&&<section>
        <div className="localityTabs">{localidades.map(l=><button key={l.id} className={localidad?.id===l.id?"selected":""} onClick={()=>setLocalidad(l)}>{l.nombre}</button>)}<button className="addTab" onClick={addLocalidad}><Plus/> Agregar</button></div>
        <div className="toolbar"><div className="search"><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nombre, código, número..." /></div><button className="primary" onClick={()=>setModal({type:"visit",data:{...emptyVisit,localidad_id:localidad?.id}})}><Plus/> Nueva visita</button></div>
        <div className="statsMini"><Stat icon={<Users/>} label="Total" value={counts.total}/><Stat icon={<Check/>} label="Visitados" value={counts.visitados}/><Stat icon={<CalendarDays/>} label="No visitados" value={counts.no}/><Stat icon={<Phone/>} label="Call center" value={counts.call}/></div>
        <div className="tableWrap"><table><thead><tr><th>COD</th><th>Nombre completo</th><th>Número</th><th>Tipo</th><th>Estado</th><th>Call Center</th><th></th></tr></thead><tbody>
          {filtered.map(v=><tr key={v.id}><td className="code">{v.codigo}</td><td><div className="person"><div className="avatar">{v.foto_url?<img src={v.foto_url}/>:<Users/>}</div><span>{v.nombre_completo}</span></div></td><td><div className="phone"><span>{v.numero}</span><a title="WhatsApp" href={wa(v.numero)} target="_blank" rel="noreferrer"><MessageCircle/></a></div></td><td>{v.tipo}</td><td><select className={`status ${estadoClass(v.estado)}`} value={v.estado} onChange={e=>quick(v.id,"estado",e.target.value)}>{ESTADOS.map(x=><option key={x}>{x}</option>)}</select></td><td><button className={`toggle ${v.revisado_call_center?"yes":""}`} onClick={()=>quick(v.id,"revisado_call_center",!v.revisado_call_center)}>{v.revisado_call_center?"Sí":"No"}</button></td><td><div className="actions"><button className="iconbtn" title="Ver detalles" onClick={()=>setModal({type:"detail",data:v})}><Eye/></button><button className="iconbtn" title="Editar" onClick={()=>setModal({type:"visit",data:v})}><Pencil/></button><button className="iconbtn danger" title="Eliminar" onClick={()=>removeVisit(v.id)}><Trash2/></button></div></td></tr>)}
          {!filtered.length&&<tr><td colSpan="7" className="empty">No hay registros para mostrar.</td></tr>}
        </tbody></table></div>
      </section>}
      {tab==="estadisticas"&&<Stats visits={visitas} localidades={localidades}/>}
      {tab==="pedidos"&&<Orders pedidos={pedidos}/>}
      {tab==="localidades"&&<Localidades ls={localidades} onAdd={addLocalidad}/>}
    </main>
    {modal?.type==="visit"&&<VisitModal data={modal.data} localidades={localidades} onClose={()=>setModal(null)} onSave={saveVisit}/>}
    {modal?.type==="detail"&&<DetailModal data={modal.data} onClose={()=>setModal(null)}/>}
  </div>
}

function Stat({icon,label,value}){return <div className="stat"><span>{icon}</span><div><b>{value}</b><small>{label}</small></div></div>}

function VisitModal({data,localidades,onClose,onSave}){
 const [v,setV]=useState(data); const fileRef=useRef();
 const set=(k,x)=>setV({...v,[k]:x});
 async function photo(e){
   const f=e.target.files?.[0]; if(!f)return;
   if(!supabase)return;
   const ext=f.name.split(".").pop(); const path=`visitas/${crypto.randomUUID()}.${ext}`;
   const {error}=await supabase.storage.from("fotos").upload(path,f,{upsert:false});
   if(error)return alert(error.message);
   const {data:u}=supabase.storage.from("fotos").getPublicUrl(path); set("foto_url",u.publicUrl);
 }
 return <div className="overlay"><div className="modal"><div className="modalHead"><h2>{v.id?"Editar visita":"Nueva visita"}</h2><button className="iconbtn" onClick={onClose}><X/></button></div>
 <div className="formGrid">
  <label>Localidad<select value={v.localidad_id} onChange={e=>set("localidad_id",e.target.value)}>{localidades.map(l=><option value={l.id} key={l.id}>{l.nombre}</option>)}</select></label>
  <label>COD<input value={v.codigo} onChange={e=>set("codigo",e.target.value)} placeholder="Ej. CAM-001"/></label>
  <label className="wide">Nombre completo<input value={v.nombre_completo} onChange={e=>set("nombre_completo",e.target.value)}/></label>
  <label>Número<input value={v.numero} onChange={e=>set("numero",e.target.value)} placeholder="7XXXXXXXX"/></label>
  <label>Tipo<select value={v.tipo} onChange={e=>set("tipo",e.target.value)}>{TIPOS.map(x=><option key={x}>{x}</option>)}</select></label>
  <label>Visitado como<select value={v.visitado_como} onChange={e=>set("visitado_como",e.target.value)}>{VISITADO.map(x=><option key={x}>{x}</option>)}</select></label>
  <label>Estado<select value={v.estado} onChange={e=>set("estado",e.target.value)}>{ESTADOS.map(x=><option key={x}>{x}</option>)}</select></label>
  <label>Fecha de visita<input type="date" value={v.fecha_visita||""} onChange={e=>set("fecha_visita",e.target.value)}/></label>
  <label className="wide">Descripción / interés<textarea value={v.descripcion_interes||""} onChange={e=>set("descripcion_interes",e.target.value)}/></label>
  <label className="wide">Ubicación / enlace Google Maps<input value={v.ubicacion||""} onChange={e=>set("ubicacion",e.target.value)} placeholder="Pegar enlace de Google Maps"/></label>
  <label className="wide">Observaciones<textarea value={v.observaciones||""} onChange={e=>set("observaciones",e.target.value)}/></label>
  <div className="photoField wide"><div className="photoPreview">{v.foto_url?<img src={v.foto_url}/>:<Camera/>}</div><div><b>Fotografía</b><p>Se guarda en Supabase Storage.</p><input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={photo}/><button className="secondary" onClick={()=>fileRef.current?.click()}><Camera/> Tomar / seleccionar foto</button></div></div>
  <label className="check wide"><input type="checkbox" checked={!!v.revisado_call_center} onChange={e=>set("revisado_call_center",e.target.checked)}/> Revisado por Call Center</label>
 </div><div className="modalFoot"><button className="secondary" onClick={onClose}>Cancelar</button><button className="primary" onClick={()=>onSave(v)}><Check/> Guardar</button></div></div></div>
}

function DetailModal({data:v,onClose}){return <div className="overlay"><div className="modal"><div className="modalHead"><h2>Detalle de visita</h2><button className="iconbtn" onClick={onClose}><X/></button></div><div className="detailTop">{v.foto_url?<img src={v.foto_url} className="detailPhoto"/>:<div className="detailPhoto placeholder"><Camera/></div>}<div><h3>{v.nombre_completo}</h3><p>{v.codigo} · {v.tipo}</p><span className={`pill ${estadoClass(v.estado)}`}>{v.estado}</span></div></div><div className="detailGrid"><Info k="Número" v={v.numero} link={wa(v.numero)}/><Info k="Visitado como" v={v.visitado_como}/><Info k="Fecha de visita" v={v.fecha_visita||"—"}/><Info k="Call Center" v={v.revisado_call_center?"Sí":"No"}/><Info k="Descripción / interés" v={v.descripcion_interes||"—"}/><Info k="Observaciones" v={v.observaciones||"—"}/><Info k="Ubicación" v={v.ubicacion||"—"} link={maps(v.ubicacion)}/></div></div></div>}
function Info({k,v,link}){return <div className="info"><small>{k}</small>{link&&v!=="—"?<a href={link} target="_blank" rel="noreferrer">{v}</a>:<span>{v}</span>}</div>}

function Stats({visits,localidades}){const all=visits;const states=Object.fromEntries(ESTADOS.map(e=>[e,all.filter(v=>v.estado===e).length]));return <section className="page"><h2>Resumen</h2><div className="bigStats"><Stat label="Registros" value={all.length} icon={<Users/>}/><Stat label="Visitados" value={all.filter(v=>v.estado?.startsWith("Visitado")).length} icon={<Check/>}/><Stat label="Interesados Imagina" value={states["Visitado (interesado Imagina)"]||0} icon={<BarChart3/>}/><Stat label="Interesados Sonriure" value={states["Visitado (interesado Sonriure)"]||0} icon={<BarChart3/>}/></div><div className="card"><h3>Estados</h3>{ESTADOS.map(e=><div className="barrow" key={e}><span>{e}</span><div className="bar"><i style={{width:`${all.length?Math.round(states[e]/all.length*100):0}%`}}/></div><b>{states[e]||0}</b></div>)}</div><div className="card"><h3>Localidades</h3>{localidades.map(l=><div className="barrow" key={l.id}><span>{l.nombre}</span><div className="bar"><i style={{width:"0%"}}/></div><b>—</b></div>)}</div></section>}
function Orders({pedidos}){return <section className="page"><div className="pageTitle"><div><h2>Pedidos</h2><p>Registro de pedidos realizados durante las visitas.</p></div></div><div className="card"><div className="empty"><ClipboardList/><h3>Módulo preparado</h3><p>La tabla de pedidos está creada en Supabase. Aquí puedes ampliar el CRUD según el flujo de pedidos que utilicen.</p></div></div></section>}
function Localidades({ls,onAdd}){return <section className="page"><div className="pageTitle"><div><h2>Localidades</h2><p>Administra las localidades disponibles.</p></div><button className="primary" onClick={onAdd}><Plus/> Nueva localidad</button></div><div className="cards">{ls.map(l=><div className="localCard" key={l.id}><MapPin/><div><b>{l.nombre}</b><small>Activa</small></div></div>)}</div></section>}
function SetupGuide(){return <div className="setup"><div className="setupCard"><div className="brandmark">I</div><h1>Visitas Provincias</h1><p>Imagina · Sonriure</p><h2>Configura Supabase</h2><p>Este proyecto está listo para GitHub Pages. Crea un archivo <code>.env</code> local o configura las variables de entorno del build:</p><pre>VITE_SUPABASE_URL=tu_url_de_supabase{"\n"}VITE_SUPABASE_ANON_KEY=tu_anon_key</pre><p>Luego ejecuta <code>npm install</code> y <code>npm run build</code>.</p><p>Antes de usar la aplicación, ejecuta <code>supabase/schema.sql</code> en el SQL Editor de Supabase.</p></div></div>}

createRoot(document.getElementById("root")).render(<App/>);
