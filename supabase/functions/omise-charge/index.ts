// Supabase Edge Function — omise-charge
// รับ token จาก frontend → สร้าง charge ผ่าน Omise API → อัปเดต band_plan

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OMISE_SECRET_KEY  = Deno.env.get('OMISE_SECRET_KEY')!;  // skey_test_...

const PLANS: Record<string, number> = {
  lite: 9900,   // 99 บาท (หน่วย satang)
  pro:  19900,  // 199 บาท
};

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── 1. Auth ────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return err('Unauthorized', 401);

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: { user }, error: authErr } = await sb.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authErr || !user) return err('Unauthorized', 401);

    // ── 2. Parse body ───────────────────────────────────────────────────────
    const body = await req.json();
    const { token, plan } = body;  // token = Omise token ID, plan = 'lite' | 'pro'

    if (!token || !PLANS[plan]) return err('Invalid token or plan');

    // ── 3. ดึง band_id จาก profile ─────────────────────────────────────────
    const { data: profile } = await sb
      .from('profiles')
      .select('band_id')
      .eq('id', user.id)
      .single();
    if (!profile?.band_id) return err('No band found');

    const bandId = profile.band_id;
    const amount = PLANS[plan];

    // ── 4. สร้าง Charge ผ่าน Omise API ─────────────────────────────────────
    const omiseRes = await fetch('https://api.omise.co/charges', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(OMISE_SECRET_KEY + ':'),
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        amount:      amount,
        currency:    'thb',
        card:        token,
        description: `BandFlow ${plan.toUpperCase()} Plan - Band ${bandId}`,
        metadata: { band_id: bandId, plan, user_id: user.id },
      }),
    });

    const charge = await omiseRes.json();

    if (!omiseRes.ok || charge.failure_code) {
      const msg = charge.failure_message || charge.message || 'Payment failed';
      return err('Payment failed: ' + msg);
    }

    if (charge.status !== 'successful') {
      return err('Payment not successful: ' + charge.status);
    }

    // ── 5. อัปเดต band_plan ────────────────────────────────────────────────
    await sb.from('bands').update({ band_plan: plan }).eq('id', bandId);

    // ── 6. บันทึก subscription record ─────────────────────────────────────
    const now     = new Date();
    const expires = new Date(now);
    expires.setMonth(expires.getMonth() + 1);

    await sb.from('subscriptions').insert({
      band_id:     bandId,
      user_id:     user.id,
      plan:        plan,
      amount:      amount,
      currency:    'thb',
      omise_charge_id: charge.id,
      status:      'active',
      started_at:  now.toISOString(),
      expires_at:  expires.toISOString(),
    });

    return new Response(JSON.stringify({
      success:   true,
      plan,
      charge_id: charge.id,
      message:   `อัปเกรดเป็น ${plan.toUpperCase()} สำเร็จ`,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    return err('Server error: ' + (e as Error).message, 500);
  }
});

function err(message: string, status = 400) {
  return new Response(
    JSON.stringify({ success: false, message }),
    { status, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } }
  );
}
