// Conexión con el panel de eventos (Supabase). Ver supabase/LEEME.md.
// La clave "anon" es pública por diseño: la seguridad la dan las reglas (RLS)
// de la base de datos, no el secreto de esta clave. NUNCA pongas aquí la clave
// "service_role".
// Mientras url/anonKey estén vacíos, la web usa los eventos de ejemplo.
window.ROCE_BACKEND = {
  url: 'https://lhwmtknmjmhktpkcngyz.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxod210a25tam1oa3Rwa2NuZ3l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2NTYwMjQsImV4cCI6MjEwOTIzMjAyNH0.IEY1VxVWeuVYUbW8xvBQWHzPT7xdYsI97t3xvBjiMyc'   // clave "anon public" (pública por diseño)
};
