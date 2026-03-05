// Supabase Edge Function — omise-charge
// รับ token จาก frontend → สร้าง charge ผ่าน Omise API → อัปเดต band_plan

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OMISE_SECRET_KEY  = Deno.env.get('OMISE_SECRET_KEY')!;  // skey_test_...

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
    const { token, plan, months: rawMonths } = body;  // token = Omise token ID, plan = 'lite' | 'pro', months = 1|3|6|12
    const months = Number(rawMonths) || 1;

    if (!token || !['lite','pro'].includes(plan)) return err('Invalid token or plan');
    if (![1,3,6,12].includes(months)) return err('Invalid months value');

    // ── 3. ดึงราคาจาก plan_config (dynamic pricing) ─────────────────────────
    const { data: planRow } = await sb
      .from('plan_config')
      .select('price, active')
      .eq('id', plan)
      .single();
    if (!planRow || !planRow.active) return err('Plan not available');

    // ดึง discount จาก plan_durations ตาม months
    const { data: durRow } = await sb
      .from('plan_durations')
      .select('discount_percent, active')
      .eq('plan_id', plan)
      .eq('months', months)
      .single();
    const discount = (durRow && durRow.active) ? (durRow.discount_percent || 0) : 0;
    // คำนวณราคารวม: base * months * (1 - discount/100), ปัดเป็นจำนวนเต็ม satang
    const amount = Math.round(planRow.price * months * (1 - discount / 100));

    // ── 4. ดึง band_id จาก profile ─────────────────────────────────────────
    const { data: profile } = await sb
      .from('profiles')
      .select('band_id')
      .eq('id', user.id)
      .single();
    if (!profile?.band_id) return err('No band found');

    const bandId = profile.band_id;

    // ── 5. ตัดสินใจ scope ───────────────────────────────────────────────
    // วงยัง free → ชำระทั้งวง | วงมีแผนอยู่แล้ว → ชำระเฉพาะรายบุคคล
    const { data: bandRow } = await sb.from('bands').select('band_plan').eq('id', bandId).single();
    const bandCurrentPlan = bandRow?.band_plan || 'free';
    const scope = bandCurrentPlan === 'free' ? 'band' : 'user';

    // ── 6. สร้าง Charge ผ่าน Omise API ─────────────────────────────────────
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
        description: `BandFlow ${plan.toUpperCase()} Plan x${months}mo${discount>0?' (-'+discount+'%)':''} - Band ${bandId}`,
        metadata: { band_id: bandId, plan, months, discount_percent: discount, user_id: user.id },
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

    // ── 7. อัปเดต plan ตาม scope ────────────────────────────────────────────
    if (scope === 'band') {
      await sb.from('bands').update({ band_plan: plan }).eq('id', bandId);
    } else {
      await sb.from('profiles').update({ user_plan: plan }).eq('id', user.id);
    }

    // ── 8. บันทึก subscription record ─────────────────────────────────────
    const now     = new Date();
    const expires = new Date(now);
    expires.setMonth(expires.getMonth() + months);

    await sb.from('subscriptions').insert({
      band_id:     bandId,
      user_id:     user.id,
      plan:        plan,
      amount:      amount,
      currency:    'thb',
      omise_charge_id: charge.id,
      scope:       scope,
      status:      'active',
      started_at:  now.toISOString(),
      expires_at:  expires.toISOString(),
    });

    const scopeLabel = scope === 'band' ? 'ทั้งวง' : 'รายบุคคล';
    const durLabel   = durRow?.label || (months + ' เดือน');
    return new Response(JSON.stringify({
      success:          true,
      plan,
      scope,
      charge_id:        charge.id,
      months,
      discount_percent: discount,
      amount_thb:       Math.round(amount / 100),
      message:   `อัปเกรดเป็น ${plan.toUpperCase()} ${durLabel} (ชำระ${scopeLabel}) สำเร็จ`,
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
