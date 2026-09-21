-- Visitas Provincias - Imagina - Sonriure
-- Ejecutar completo en Supabase > SQL Editor

create extension if not exists pgcrypto;

create table if not exists public.localidades (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.visitas (
  id uuid primary key default gen_random_uuid(),
  localidad_id uuid not null references public.localidades(id) on delete cascade,
  codigo text not null,
  nombre_completo text not null,
  numero text,
  tipo text not null check (tipo in ('Dentista','Técnico','Hospital','Farmacia')),
  descripcion_interes text,
  visitado_como text not null default 'Imagina' check (visitado_como in ('Sonriure','Imagina','Ambos')),
  estado text not null default 'No visitado' check (estado in (
    'Visitado','Visitado (interesado Imagina)','Visitado (interesado Sonriure)',
    'Visitado (interesado Ambos)','Cerrado por visitar','No visitado','Visitado (no interesado)'
  )),
  revisado_call_center boolean not null default false,
  fecha_visita date,
  ubicacion text,
  observaciones text,
  foto_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(localidad_id, codigo)
);

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  visita_id uuid references public.visitas(id) on delete set null,
  localidad_id uuid references public.localidades(id) on delete set null,
  descripcion text not null,
  cantidad numeric default 1,
  estado text default 'Pendiente',
  fecha date default current_date,
  observaciones text,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists visitas_updated_at on public.visitas;
create trigger visitas_updated_at before update on public.visitas
for each row execute function public.set_updated_at();

insert into public.localidades(nombre) values
('Camiri'),('Villamontes'),('Yacuiba'),('Monteagudo')
on conflict (nombre) do nothing;

alter table public.localidades enable row level security;
alter table public.visitas enable row level security;
alter table public.pedidos enable row level security;

-- Para una primera versión interna sin login.
-- IMPORTANTE: estas políticas permiten acceso desde el frontend con la anon key.
drop policy if exists localidades_select on public.localidades;
drop policy if exists localidades_insert on public.localidades;
drop policy if exists localidades_update on public.localidades;
drop policy if exists localidades_delete on public.localidades;
create policy localidades_select on public.localidades for select using (true);
create policy localidades_insert on public.localidades for insert with check (true);
create policy localidades_update on public.localidades for update using (true) with check (true);
create policy localidades_delete on public.localidades for delete using (true);

drop policy if exists visitas_select on public.visitas;
drop policy if exists visitas_insert on public.visitas;
drop policy if exists visitas_update on public.visitas;
drop policy if exists visitas_delete on public.visitas;
create policy visitas_select on public.visitas for select using (true);
create policy visitas_insert on public.visitas for insert with check (true);
create policy visitas_update on public.visitas for update using (true) with check (true);
create policy visitas_delete on public.visitas for delete using (true);

drop policy if exists pedidos_select on public.pedidos;
drop policy if exists pedidos_insert on public.pedidos;
drop policy if exists pedidos_update on public.pedidos;
drop policy if exists pedidos_delete on public.pedidos;
create policy pedidos_select on public.pedidos for select using (true);
create policy pedidos_insert on public.pedidos for insert with check (true);
create policy pedidos_update on public.pedidos for update using (true) with check (true);
create policy pedidos_delete on public.pedidos for delete using (true);

-- Storage para fotografías.
insert into storage.buckets (id, name, public)
values ('fotos','fotos',true)
on conflict (id) do update set public=true;

drop policy if exists fotos_public_read on storage.objects;
drop policy if exists fotos_public_insert on storage.objects;
drop policy if exists fotos_public_delete on storage.objects;

create policy fotos_public_read on storage.objects for select
using (bucket_id='fotos');

create policy fotos_public_insert on storage.objects for insert
with check (bucket_id='fotos');

create policy fotos_public_delete on storage.objects for delete
using (bucket_id='fotos');
