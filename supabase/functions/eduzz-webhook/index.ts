import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    let payload: Record<string, unknown> = {};

    if (contentType.includes('application/json')) {
      payload = await req.json();
    } else {
      const text = await req.text();
      try { payload = JSON.parse(text); } catch {
        const params = new URLSearchParams(text);
        params.forEach((v, k) => { payload[k] = v; });
      }
    }

    // Loga payload completo para descobrir o formato da Eduzz
    console.log('PAYLOAD COMPLETO:', JSON.stringify(payload, null, 2));

    // Tenta extrair email de todos os campos possíveis
    const emailRaw =
      payload.email ||
      payload.cli_mail ||
      payload.customer_email ||
      payload.buyer_email ||
      (payload.customer as Record<string,unknown>)?.email ||
      (payload.buyer as Record<string,unknown>)?.email ||
      '';
    const email = String(emailRaw).toLowerCase().trim();

    const nameRaw =
      payload.name ||
      payload.cli_name ||
      payload.customer_name ||
      (payload.customer as Record<string,unknown>)?.name ||
      '';
    const name = String(nameRaw);

    const transactionId = String(
      payload.transaction_id || payload.trans_cod ||
      payload.id || payload.invoice_id || ''
    );

    const rawStatus =
      payload.status || payload.trans_status ||
      payload.invoice_status || payload.payment_status || '';

    console.log('Extraido:', { email, name, transactionId, rawStatus });

    if (!email) {
      console.log('Email nao encontrado no payload');
      return new Response(JSON.stringify({ received: true, warning: 'email not found' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Mapeia status
    const s = String(rawStatus).toLowerCase();
    const statusMapped =
      s === '3' || s === 'paid' || s === 'aprovado' || s === 'invoice_paid' ? 'aprovado' :
      s === '6' || s === 'refunded' || s === 'reembolsado' || s === 'invoice_refunded' ? 'reembolsado' :
      s === '7' || s === 'chargeback' || s === 'invoice_chargeback' ? 'chargeback' : null;

    const acessoLiberado = statusMapped === 'aprovado';

    await supabase.from('clientes_autorizados').upsert({
      email,
      nome: name,
      id_transacao: transactionId,
      status_pagamento: statusMapped || String(rawStatus),
      acesso_liberado: acessoLiberado,
      data_compra: new Date().toISOString(),
    }, { onConflict: 'email' });

    if (!acessoLiberado && statusMapped) {
      const { data: profile } = await supabase
        .from('profiles').select('id').eq('email', email).maybeSingle();
      if (profile?.id) {
        await supabase.from('profiles')
          .update({ status_conta: 'bloqueada', has_main_mentorship: false })
          .eq('id', profile.id);
      }
    } else if (acessoLiberado) {
      const { data: profile } = await supabase
        .from('profiles').select('id').eq('email', email).maybeSingle();
      if (profile?.id) {
        await supabase.from('profiles')
          .update({ status_conta: 'ativa', has_main_mentorship: true })
          .eq('id', profile.id);
      }
    }

    return new Response(JSON.stringify({ received: true, processed: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro:', error);
    return new Response(JSON.stringify({ received: true, error: 'internal' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});