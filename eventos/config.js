// Conexión con el panel de eventos (Supabase). Ver supabase/LEEME.md.
// La clave "anon" es pública por diseño: la seguridad la dan las reglas (RLS)
// de la base de datos, no el secreto de esta clave. NUNCA pongas aquí la clave
// "service_role".
// Mientras url/anonKey estén vacíos, la web usa los eventos de ejemplo.
window.ROCE_BACKEND = {
  url: '',      // p. ej. https://abcdefgh.supabase.co
  anonKey: ''   // clave "anon public" del proyecto
};
