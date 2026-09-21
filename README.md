# Visitas Provincias - Imagina - Sonriure

Sistema web responsive para gestionar visitas por localidad con Supabase y GitHub Pages.

## 1. Supabase

1. Crea un proyecto en Supabase.
2. Abre **SQL Editor**.
3. Ejecuta todo el contenido de `supabase/schema.sql`.
4. En Project Settings > API copia:
   - Project URL
   - anon public key

## 2. Configuración local

Copia `.env.example` como `.env`:

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_ANON_PUBLIC_KEY
```

Luego:

```bash
npm install
npm run dev
```

## 3. GitHub Pages

Este proyecto usa Vite. En GitHub:

- Sube el repositorio.
- Configura un workflow de GitHub Actions para ejecutar `npm ci` y `npm run build`.
- Publica la carpeta `dist` con GitHub Pages.

### Variables

En GitHub > Settings > Secrets and variables > Actions agrega:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Nota de seguridad

La versión incluida está pensada para una primera instalación interna y las políticas RLS permiten acceso público a las tablas mediante la anon key. Para uso real con datos sensibles, añade autenticación de Supabase y políticas RLS por usuario/rol antes de publicar.

## Funciones incluidas

- Localidades: Camiri, Villamontes, Yacuiba y Monteagudo.
- Agregar localidades.
- CRUD de visitas.
- Estados con colores.
- Cambio rápido de estado y Call Center.
- WhatsApp.
- Google Maps mediante enlace pegado.
- Fotos en Supabase Storage.
- Fecha de visita.
- Estadísticas.
- Módulo base de pedidos.
- Responsive móvil/PC.
