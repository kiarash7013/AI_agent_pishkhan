import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateStatement, DEMO_CUSTOMER, requestSchema } from '../../../lib/domain';

export async function POST(request: Request) {
  if (Number(request.headers.get('content-length')) > 4096) return NextResponse.json({ error: 'درخواست بیش از حد طولانی است.' }, {status:413});
  const parsed = requestSchema.safeParse(await request.json().catch(()=>null));
  if (!parsed.success) return NextResponse.json({ error:'شماره مشتری، حساب و بازه زمانی را بررسی کنید.' }, {status:400});
  if (parsed.data.customerId !== DEMO_CUSTOMER) return NextResponse.json({ error:'در نسخه نمایشی فقط مشتری ۸۴۸۳۹۹۹۳ در دسترس است.' }, {status:404});
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.json({error:'سرویس دریافت اطلاعات آماده نیست.'},{status:503});
  const db = createClient(url, key, {auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error} = await db.from('demo_transactions').select('id,posted_at,description,amount').eq('account_id', parsed.data.accountId).order('posted_at');
  if (error) return NextResponse.json({error:'دریافت تراکنش‌ها انجام نشد. دوباره تلاش کنید.'},{status:503});
  return NextResponse.json(calculateStatement(parsed.data, data || []),{headers:{'Cache-Control':'no-store'}});
}
