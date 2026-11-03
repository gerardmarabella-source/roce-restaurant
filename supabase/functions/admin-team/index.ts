// Gestión del equipo del panel: crear cuentas, cambiar contraseñas y quitar accesos.
// Solo responde a administradores (admins.role = 'admin'). La clave de servicio la inyecta
// Supabase en la función; nunca llega al navegador.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: isAdmin } = await caller.rpc('can_manage_team');
  if (isAdmin !== true) return json({ error: 'forbidden' }, 403);
  const { data: me } = await caller.auth.getUser();
  const myEmail = (me.user?.email ?? '').toLowerCase();

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  let body: { action?: string; email?: string; password?: string; role?: string };
  try { body = await req.json(); } catch { return json({ error: 'bad_request' }, 400); }
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const role = body.role === 'admin' ? 'admin' : 'staff';
  if (!EMAIL.test(email)) return json({ error: 'bad_email' }, 400);

  async function findUser() {
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    return data?.users.find((u) => (u.email ?? '').toLowerCase() === email);
  }

  if (body.action === 'create') {
    if (password.length < 10) return json({ error: 'weak_password' }, 400);
    const existing = await findUser();
    if (!existing) {
      const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) return json({ error: 'create_failed', detail: error.message }, 400);
    }
    const { error } = await admin.from('admins').upsert({ email, role }, { onConflict: 'email', ignoreDuplicates: true });
    if (error) return json({ error: 'admins_failed', detail: error.message }, 500);
    return json({ ok: true, existed: !!existing });
  }

  if (body.action === 'set_password') {
    if (password.length < 10) return json({ error: 'weak_password' }, 400);
    const { data: row } = await admin.from('admins').select('email').eq('email', email).maybeSingle();
    if (!row) return json({ error: 'not_admin' }, 404);
    const user = await findUser();
    if (!user) return json({ error: 'no_account' }, 404);
    const { error } = await admin.auth.admin.updateUserById(user.id, { password });
    if (error) return json({ error: 'update_failed', detail: error.message }, 400);
    return json({ ok: true });
  }

  if (body.action === 'set_role') {
    if (email === myEmail) return json({ error: 'self' }, 400);
    const { error } = await admin.from('admins').update({ role }).eq('email', email);
    if (error) return json({ error: 'admins_failed', detail: error.message }, 500);
    return json({ ok: true });
  }

  if (body.action === 'remove') {
    if (email === myEmail) return json({ error: 'self' }, 400);
    const { error } = await admin.from('admins').delete().eq('email', email);
    if (error) return json({ error: 'admins_failed', detail: error.message }, 500);
    const user = await findUser();
    if (user) await admin.auth.admin.deleteUser(user.id);
    return json({ ok: true });
  }

  return json({ error: 'bad_action' }, 400);
});
