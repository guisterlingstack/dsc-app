import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Não autorizado');

    // Verifica se quem chama é admin
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) throw new Error('Não autorizado');

    const role = user.user_metadata?.role;
    if (!['admin', 'admin_master'].includes(role)) throw new Error('Sem permissão');

    // Cria usuário com service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { nome, email, senha, senha_temporaria } = await req.json();
    if (!nome || !email || !senha) throw new Error('Nome, email e senha são obrigatórios');

    // Cria no Auth
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { full_name: nome, role: 'cliente' },
    });
    if (createError) throw new Error(createError.message);

    // Aguarda trigger criar o profile
    await new Promise(r => setTimeout(r, 500));

    // Atualiza profile
    const expira = new Date();
    expira.setDate(expira.getDate() + 30);

    await supabaseAdmin.from('profiles').update({
      full_name:          nome,
      has_main_mentorship: true,
      criado_pelo_admin:  true,
      senha_temporaria:   senha_temporaria ?? false,
      senha_expira_em:    senha_temporaria ? expira.toISOString() : null,
      updated_at:         new Date().toISOString(),
    }).eq('id', newUser.user.id);

    // Adiciona em clientes_autorizados
    await supabaseAdmin.from('clientes_autorizados').upsert({
      email:           email.toLowerCase(),
      nome,
      acesso_liberado: true,
      usuario_criado:  true,
    }, { onConflict: 'email' });

    return new Response(
      JSON.stringify({ success: true, user_id: newUser.user.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
