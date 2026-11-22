// Conexión con el panel de eventos (Supabase). Ver supabase/LEEME.md.
// La clave "anon" es pública por diseño: la seguridad la dan las reglas (RLS)
// de la base de datos, no el secreto de esta clave. NUNCA pongas aquí la clave
// "service_role".
// Mientras url/anonKey estén vacíos, la web usa los eventos de ejemplo.
window.ROCE_BACKEND = {
  url: 'https://lhwmtknmjmhktpkcngyz.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxod210a25tam1oa3Rwa2NuZ3l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2NTYwMjQsImV4cCI6MjEwOTIzMjAyNH0.IEY1VxVWeuVYUbW8xvBQWHzPT7xdYsI97t3xvBjiMyc'   // clave "anon public" (pública por diseño)
};

// Eventos cuya entrada va incluida si se reserva cena en Restaurant & Cocktails ese mismo día. Se usa en la ficha del evento
// (dos botones: reservar cena o solo fiesta) y en las horas de cena del calendario de reservas.
//   clave = id del evento · date = día de la fiesta · drink = la entrada suelta incluye una copa
window.ROCE_DINNER_ACCESS = {
  'roce-urban-party-1211': { date: '2026-12-11', drink: true, name: { es: 'ROCE Opening Friday', en: 'ROCE Opening Friday' } }
};
