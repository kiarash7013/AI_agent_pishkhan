'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { calculateStatement, defaultRequest, DEMO_CUSTOMER, detectCustomer, fa, money, normalizeDigits, period, persianDate, requestSchema, type Conversation, type Message, type Statement, type StatementRequest } from '../lib/domain';
import { Button as DigButton } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { PromptInput, PromptInputTextarea } from '@/components/ui/prompt-input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { TextField } from '@/components/ui/text-field';
import { ControlSizeProvider } from '@/components/ui/control-size';
import { Card } from '@/components/ui/card';
import { getSupabase } from '../lib/supabase';
import { exportExcel, exportPdf } from '../lib/export';
import { AssistantScenario } from './assistant-scenarios';
import { BarChart } from './ui/chart-presets';
import { CasePage } from './case-page';
import { normalizeArabicChars } from '../lib/persian';
const menuSearchKey = (value: string) => normalizeArabicChars(value).replace(/[\u200c\s]+/g, ' ').trim();

function Button({className='',...props}:React.ComponentProps<typeof DigButton>){return <DigButton variant={className.includes('outline')?'outline':className.includes('primary')?'default':'ghost'} {...props} className={className}/>;}
const asset = (file: string) => `/assets/${file}`;
function Icon({file, className=''}:{file:string;className?:string}) { return <img className={className} src={asset(file)} alt="" draggable={false}/>; }
function HistoryIcon(){return <span className="history-icon"><Icon file="4422c.svg"/><Icon file="20411.svg" className="history-hand"/></span>;}
function IconButton({label,onClick,children,disabled=false}:{label:string;onClick:()=>void;children:React.ReactNode;disabled?:boolean}) { return <Button type="button" className="icon-button" aria-label={label} title={label} onClick={onClick} disabled={disabled}>{children}</Button>; }
function Identity() { return <div className="identity" dir="ltr"><Icon file="691cd.svg"/><span>دستیار هوشمند</span></div>; }
const nav = [ ['صفحه اصلی','1dfe5.svg'],['اطلاعات پایه','9de45.svg'],['پرونده دعاوی','09456.svg'],['نوع پرونده','771da.svg'],['پرونده اجرایی ثبتی','87bc4.svg'],['اشخاص مرتبط','d150d.svg'],['وکلا','b5f85.svg'],['برون‌سپاری','08fed.svg'],['اظهارنامه','b0a0f.svg'],['ارجاع گروهی','b4e70.svg'] ];
const suggestions = [
 {title:'اطلاعات مشتری',description:'مشاهده اطلاعات مجاز مشتری',icon:'84304.svg',color:'blue',prompt:'اطلاعات مشتری'},
 {title:'دریافت صورت‌حساب',description:'با شماره مشتری و بازه زمانی',icon:'b4668.svg',color:'violet',prompt:'صورت‌حساب شماره مشتری ۸۴۸۳۹۹۹۳ بهم بده'},
 {title:'راهنمای سامانه',description:'پیداکردن مسیر انجام کار',icon:'61029.svg',color:'amber',prompt:'راهنمای سامانه'},
 {title:'پیگیری درخواست',description:'بررسی آخرین وضعیت درخواست',icon:'c5418.svg',color:'green',prompt:'پیگیری درخواست'}
];
const newConversation = (): Conversation => ({id:crypto.randomUUID(),title:'گفتگوی جدید',messages:[],request:{...defaultRequest},result:null,updatedAt:new Date().toISOString()});
type View = 'chat' | 'history' | 'login';
const errorText = (e:unknown) => e instanceof Error ? e.message : 'خطایی رخ داد. دوباره تلاش کنید.';

export function Pishkhan(){
 const [open,setOpen] = useState(false), [view,setView] = useState<View>('chat');
 const [conversation,setConversation] = useState<Conversation|null>(null), [history,setHistory] = useState<Conversation[]>([]);
 const [text,setText] = useState(''), [busy,setBusy] = useState(false), [completing,setCompleting] = useState(false), [error,setError] = useState(''), [notice,setNotice] = useState('');
 const [custom,setCustom] = useState(false), [chart,setChart] = useState(false), [liked,setLiked] = useState(false), [exporting,setExporting] = useState(false);
 const [session,setSession] = useState<Session|null>(null), [email,setEmail] = useState(''), [otp,setOtp] = useState(''), [otpSent,setOtpSent] = useState(false), [authBusy,setAuthBusy] = useState(false);
 const [deleteId,setDeleteId]=useState<string|null>(null),[deleting,setDeleting]=useState(false);
 const [query,setQuery] = useState('');
 const trigger = useRef<HTMLButtonElement>(null), input=useRef<HTMLTextAreaElement>(null), output=useRef<HTMLDivElement>(null), scroll=useRef<HTMLDivElement>(null);
 const controller=useRef<AbortController|null>(null), operation=useRef(0), hydrated=useRef(false), cloudUser=useRef<string|null>(null);

 useEffect(()=>{
  try { const raw=localStorage.getItem('pishkhan-demo-history-v1'); if(raw){ const data=JSON.parse(raw); if(Array.isArray(data)) setHistory(data.filter(isConversation).slice(0,30)); } } catch { /* Private browser storage can be unavailable. */ }
  setConversation(newConversation()); hydrated.current=true;
  const db=getSupabase(); void db.auth.getSession().then(({data})=>setSession(data.session));
  const {data:{subscription}}=db.auth.onAuthStateChange((_event,s)=>setSession(s));
  return ()=>{subscription.unsubscribe();controller.current?.abort();};
 },[]);

 useEffect(()=>{
  if(!session?.user.id){cloudUser.current=null;return;}
  let active=true;
  void getSupabase().from('conversations').select('payload').order('updated_at',{ascending:false}).limit(30).then(({data,error:loadError})=>{
   if(!active)return;
   if(loadError){setError('دریافت تاریخچه حساب انجام نشد.');return;}
   cloudUser.current=session.user.id;
   setHistory((data||[]).map(r=>r.payload).filter(isConversation));
  });
  return ()=>{active=false;};
 },[session?.user.id]);

 const persist = useCallback(async (next:Conversation)=>{
  const stamped={...next,updatedAt:new Date().toISOString()};
  setConversation(stamped);
  setHistory(previous=>{
   const list=[stamped,...previous.filter(c=>c.id!==stamped.id)].slice(0,30);
   if(!session){try{localStorage.setItem('pishkhan-demo-history-v1',JSON.stringify(list));}catch{setNotice('ذخیره در این مرورگر ممکن نیست.');}}
   return list;
  });
  if(session){
   const {error:saveError}=await getSupabase().from('conversations').upsert({id:stamped.id,user_id:session.user.id,title:stamped.title,payload:stamped,updated_at:stamped.updatedAt});
   if(saveError)setNotice('گفتگو نمایش داده شد؛ ذخیره آنلاین انجام نشد.');
  }
 },[session]);

 const close = useCallback(()=>{setOpen(false);trigger.current?.focus();},[]);
 useEffect(()=>{if(scroll.current&&view==='chat')scroll.current.scrollTo({top:scroll.current.scrollHeight,behavior:'smooth'});},[conversation?.messages.length,conversation?.result,busy,view]);
 useEffect(()=>{if(notice){const id=setTimeout(()=>setNotice(''),5000);return()=>clearTimeout(id);}},[notice]);

 function startNew(){operation.current++;controller.current?.abort();setBusy(false);setCompleting(false);setConversation(newConversation());setView('chat');setError('');setText('');setChart(false);setCustom(false);setLiked(false);input.current?.focus();}
 async function deleteConversation(id:string){
  if(busy||deleting)return;
  setDeleting(true);setError('');
  try{
   if(session){const {data,error}=await getSupabase().from('conversations').delete().eq('id',id).eq('user_id',session.user.id).select('id');if(error||!data?.length)throw error||new Error('missing');}
   const remaining=history.filter(c=>c.id!==id);
   if(!session)localStorage.setItem('pishkhan-demo-history-v1',JSON.stringify(remaining));
   setHistory(remaining);if(conversation?.id===id){operation.current++;controller.current?.abort();setBusy(false);setCompleting(false);setConversation(newConversation());setChart(false);setText('');}
   setDeleteId(null);setNotice('گفتگو حذف شد.');
  }catch{setError('حذف گفتگو انجام نشد. دوباره تلاش کنید.');}finally{setDeleting(false);}
 }
 function cancel(){operation.current++;controller.current?.abort();setBusy(false);setCompleting(true);setNotice('دریافت متوقف شد؛ می‌توانید دوباره تلاش کنید.');}
 async function send(prompt=text){
  if(!prompt.trim()||busy||!conversation)return;
  const trimmed=prompt.trim().slice(0,2000), customer=detectCustomer(trimmed);
  const messages:Message[]=[...conversation.messages,{id:crypto.randomUUID(),role:'user',text:trimmed}];
  const next={...conversation,title:conversation.messages.length?conversation.title:trimmed.slice(0,60),messages,result:null};
  setText('');setError('');setView('chat');setChart(false);
  if(/صورت.?حساب|گردش|صورت حساب/.test(trimmed)||customer){
   next.request={...conversation.request,customerId:customer||conversation.request.customerId};
   if(next.request.customerId!==DEMO_CUSTOMER){next.messages.push({id:crypto.randomUUID(),role:'assistant',text:'در نسخه نمایشی فقط اطلاعات نمونه مشتری ۸۴۸۳۹۹۹۳ در دسترس است. هیچ اطلاعات واقعی بانکی متصل نشده است.'});setCompleting(false);}
   else {next.messages.push({id:crypto.randomUUID(),role:'assistant',text:'حتماً. برای تهیه صورت‌حساب، حساب و بازه زمانی را مشخص کنید.'});setCompleting(true);}
   await persist(next);return;
  }
  if(/اطلاعات مشتری/.test(trimmed)){next.messages.push({id:crypto.randomUUID(),role:'assistant',text:'مشتری نمونه ۸۴۸۳۹۹۹۳، سپرده کوتاه‌مدت با انتهای ۴۵۸۲. اطلاعات هویتی واقعی در این نسخه وجود ندارد. برای مشاهده گردش، «دریافت صورت‌حساب» را انتخاب کنید.'});await persist(next);setCompleting(false);return;}
  if(/راهنما/.test(trimmed)){next.messages.push({id:crypto.randomUUID(),role:'assistant',text:'برای دریافت صورت‌حساب، درخواست خود را همراه با شماره مشتری ۸۴۸۳۹۹۹۳ بنویسید، حساب و بازه زمانی را انتخاب کنید و روی دریافت صورت‌حساب بزنید. سپس می‌توانید فایل PDF یا Excel دریافت کنید.'});await persist(next);setCompleting(false);return;}
  if(/پیگیری/.test(trimmed)){next.messages.push({id:crypto.randomUUID(),role:'assistant',text:'درخواست‌های این نسخه در تاریخچه گفتگوهای شما قابل مشاهده‌اند. هنوز اتصال به سامانه پیگیری بانک برقرار نشده است.'});await persist(next);setCompleting(false);return;}
  setConversation(next);setBusy(true);setCompleting(false);const run=++operation.current;controller.current=new AbortController();
  try{
   const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json',...(session?{Authorization:`Bearer ${session.access_token}`}:{})},body:JSON.stringify({messages:messages.slice(-12).map(({role,text})=>({role,text}))}),signal:controller.current.signal});
   const data=await response.json();if(!response.ok)throw new Error(data.error);
   if(operation.current!==run)return;
   next.messages.push({id:crypto.randomUUID(),role:'assistant',text:data.text});await persist(next);
  }catch(e){if(operation.current===run){setError(errorText(e));await persist(next);}}
  finally{if(operation.current===run)setBusy(false);}
 }
 async function fetchStatement(){
  if(!conversation||busy)return;const parsed=requestSchema.safeParse(conversation.request);
  if(!parsed.success){setError('بازه زمانی معتبر و حداکثر یک سال را وارد کنید.');return;}
  const run=++operation.current;controller.current=new AbortController();setBusy(true);setCompleting(false);setError('');setChart(false);
  const next={...conversation,messages:[...conversation.messages,{id:crypto.randomUUID(),role:'user' as const,text:`صورت‌حساب مشتری ${fa(conversation.request.customerId)}\nسپرده •••• ۴۵۸۲، از ${period(conversation.request)}`}],result:null};setConversation(next);
  try {
   const [response]=await Promise.all([fetch('/api/statement',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(next.request),signal:controller.current.signal}),new Promise(resolve=>setTimeout(resolve,900))]);
   const result=await response.json();if(!response.ok)throw new Error(result.error);if(operation.current!==run)return;
   await persist({...next,result});
  } catch(e){if(operation.current===run){setError(errorText(e));setCompleting(true);}}
  finally{if(operation.current===run)setBusy(false);}
 }
 async function download(kind:'pdf'|'excel'){
  if(!conversation?.result||exporting)return;setExporting(true);setError('');
  try{if(kind==='excel')await exportExcel(conversation.result);else if(output.current)await exportPdf(output.current,conversation.result);}catch{setError('ساخت فایل انجام نشد. دوباره تلاش کنید.');}finally{setExporting(false);}
 }
 async function auth(){
  setAuthBusy(true);setError('');
  try{
   if(!otpSent){const {error:e}=await getSupabase().auth.signInWithOtp({email:email.trim(),options:{emailRedirectTo:window.location.origin}});if(e)throw e;setOtpSent(true);setNotice('لینک ورود به ایمیل شما ارسال شد.');}
   else{const {error:e}=await getSupabase().auth.verifyOtp({email:email.trim(),token:normalizeDigits(otp.trim()),type:'email'});if(e)throw e;setView('history');setOtpSent(false);setOtp('');}
  }catch{setError('ورود انجام نشد. ایمیل یا کد را بررسی کنید و کمی بعد تلاش کنید.');}finally{setAuthBusy(false);}
 }

 const result=conversation?.result;
 return <ControlSizeProvider size="default"><Sheet open={open} onOpenChange={setOpen}>
  <div className="workspace" inert={open}>
   <aside className="sidebar">
    <div className="brand"><span className="brand-mark"><Icon file="62df7.svg"/></span><Icon file="d4ab8.svg"/></div>
    <div className="menu-search"><Icon file="37099.svg"/><Input aria-label="جستجوی منو" placeholder="جستجو" value={query} autoComplete="off" onChange={e=>setQuery(e.target.value)}/></div>
    <nav aria-label="منوی اصلی">{nav.filter(([label])=>menuSearchKey(label).includes(menuSearchKey(query))).map(([label,icon])=><Button key={label} className={`menu-item ${label==='پرونده دعاوی'?'selected':''}`} aria-current={label==='پرونده دعاوی'?'page':undefined} onClick={()=>label==='پرونده دعاوی'?setQuery(''):setNotice('در این نسخه، فلو دستیار و صورت‌حساب قابل آزمایش است.')}><span className="nav-icon"><Icon file={icon}/></span><span className="menu-label">{label}</span></Button>)}{!nav.some(([label])=>menuSearchKey(label).includes(menuSearchKey(query)))&&<p className="menu-search-empty" role="status">موردی پیدا نشد</p>}</nav>
    <div className="sidebar-bottom"><div className="sidebar-emblem"><Icon file="da15e.svg"/><small>نسخه ۱.۰.۱</small></div><div className="datetime" dir="ltr"><span><Icon file="1787f.svg"/><bdi dir="rtl">۱۴۰۴/۰۶/۲۳</bdi></span><span><Icon file="3d6eb.svg"/><bdi dir="rtl">۵۸ : ۴۵ : ۱۴</bdi></span></div></div>
   </aside>
   <div className="main-shell">
    <header className="app-header" dir="ltr">
     <Button className="profile" onClick={()=>{setOpen(true);setView(session?'history':'login');}}><Icon file="e9aa7.svg" className="profile-chevron"/><span className="profile-details"><span className="profile-copy" dir="rtl"><strong>کیارش فرازی</strong><small>{session?'حساب متصل':'کارشناس پشتیبانی پرداخت'}</small></span><img src={asset('b7c55.png')} alt="تصویر پروفایل" width="38" height="38"/></span></Button>
     <div className="header-actions"><IconButton label="گفتگو" onClick={()=>{setOpen(true);setView('chat');}}><Icon file="0e21b.svg"/></IconButton><Button ref={trigger} className="icon-button assistant-trigger" aria-label="باز کردن دستیار هوشمند" aria-haspopup="dialog" aria-expanded={open} onClick={()=>{setOpen(true);setView('chat');}}><Icon file="c921e.svg"/></Button></div>
     <div className="system-name" dir="rtl"><Icon file="9b1dc.svg"/><strong>سامانه حقوقی</strong><Icon file="e9aa7.svg"/></div>
    </header>
    <CasePage onNotice={setNotice}/>
    <footer className="app-footer"><span>© کلیه حقوق برای بانک پاسارگاد محفوظ است.</span><Icon file="bd15f.svg"/><span>طراحی و پیاده سازی توسط داتیس آرین قشم (داتین)</span></footer>
   </div>
  </div>
  <SheetContent side="end" showCloseButton={false} className="assistant-sheet" dir="ltr">
   <header className="sheet-header"><div className="sheet-actions"><IconButton label="بستن دستیار" onClick={close}><Icon file="8b4ce.svg"/></IconButton><IconButton label="تاریخچه گفتگوها" onClick={()=>{setView(view==='history'?'chat':'history');setError('');}}><HistoryIcon/></IconButton><IconButton label="گفتگوی جدید" onClick={startNew}><Icon file="b5693.svg"/></IconButton></div><div className="assistant-title"><div dir="rtl"><SheetTitle>دستیار هوشمند</SheetTitle><SheetDescription>دستیار کاری شما در پیشخوان</SheetDescription></div><Icon file="5894c.svg"/></div></header>
   <div ref={scroll} className="chat-scroll" aria-busy={busy}>
    {view==='history'?<div className="history-view" dir="rtl"><h3>تاریخچه گفتگوها</h3><p className="muted">{session?'گفتگوهای ذخیره‌شده در حساب شما':'گفتگوهای نمونه در همین مرورگر ذخیره می‌شوند.'}</p>{!session?<Button className="outline full" onClick={()=>{setView('login');setError('');}}>ورود برای ذخیره در حساب</Button>:<Button className="outline full" onClick={async()=>{await getSupabase().auth.signOut();setHistory([]);startNew();setNotice('از حساب خارج شدید.');}}>خروج از حساب</Button>}{history.length===0?<p className="empty-history">هنوز گفتگویی ندارید.</p>:history.map(c=><div className="history-entry" key={c.id}><Button className="history-row" onClick={()=>{operation.current++;controller.current?.abort();setBusy(false);setConversation(c);setCompleting(!c.result&&c.messages.some(m=>/حساب و بازه زمانی/.test(m.text)));setView('chat');setError('');}}><strong>{c.title}</strong><small>{new Intl.DateTimeFormat('fa-IR',{dateStyle:'medium',timeZone:'Asia/Tehran'}).format(new Date(c.updatedAt))}</small></Button><small>شناسه درخواست: {c.id}</small><Button onClick={()=>{void navigator.clipboard.writeText(c.id).then(()=>setNotice('شناسه کپی شد.')).catch(()=>setError('کپی انجام نشد.'));}}>کپی شناسه</Button><Button disabled={busy||deleting} onClick={()=>setDeleteId(c.id)}>حذف گفتگو</Button>{deleteId===c.id&&<div role="group" aria-label="تأیید حذف گفتگو"><p>این گفتگو برای همیشه حذف شود؟</p><Button disabled={deleting} onClick={()=>void deleteConversation(c.id)}>تأیید حذف</Button><Button disabled={deleting} onClick={()=>setDeleteId(null)}>انصراف</Button></div>}</div>)}</div>:view==='login'?<form className="login-view" dir="rtl" onSubmit={e=>{e.preventDefault();void auth();}}><h3>ورود به حساب</h3><p className="muted">برای نگهداری گفتگوها در حساب، با ایمیل وارد شوید.</p><label>ایمیل<Input type="email" dir="ltr" required value={email} disabled={otpSent} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label>{otpSent&&<><p>لینک ورود را در ایمیل باز کنید؛ اگر ایمیل شامل کد است، آن را اینجا وارد کنید.</p><label>کد ورود<Input inputMode="numeric" dir="ltr" value={otp} required onChange={e=>setOtp(e.target.value)} autoComplete="one-time-code"/></label></>}<Button className="primary full" disabled={authBusy}>{authBusy?'در حال ارسال…':otpSent?'تأیید کد':'ارسال لینک ورود'}</Button>{otpSent&&<Button type="button" className="outline full" onClick={()=>setOtpSent(false)}>تغییر ایمیل</Button>}<Button type="button" className="text-button" onClick={()=>setView('chat')}>بازگشت به گفتگو</Button></form>:<>
     {!conversation?.messages.length?<><div className="welcome"><Icon file="d4728.svg"/><h3>سلام، خوش آمدید</h3><h4>امروز چه کمکی می‌خواهید؟</h4><p>از اطلاعات مشتری تا گزارش حساب،<br/>درخواستتان را همین‌جا بنویسید.</p></div><div className="suggestions">{suggestions.map(s=><Button key={s.title} className="suggestion" dir="rtl" onClick={()=>void send(s.prompt)}><span className={`suggestion-icon ${s.color}`}><Icon file={s.icon}/></span><strong>{s.title}</strong><p>{s.description}</p></Button>)}</div><p className="empty-note" dir="rtl">هنوز گفتگویی ندارید؛ با یک درخواست شروع کنید.</p></>:<>
      <div className="messages">{conversation.messages.map(m=>m.role==='user'?<p className="user-message" key={m.id} dir="rtl">{m.text}</p>:<div key={m.id} className="assistant-message"><Identity/><p dir="rtl">{m.text}</p></div>)}</div>
      {completing&&!busy&&<form className="request-card card" dir="rtl" onSubmit={e=>{e.preventDefault();void fetchStatement();}}><h3>مشتری {fa(conversation.request.customerId)}</h3><label>حساب<Select value={conversation.request.accountId} dir="rtl"><SelectTrigger className="account-select" aria-label="حساب"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="demo-4582">سپرده کوتاه‌مدت •••• ۴۵۸۲</SelectItem></SelectContent></Select></label><label>بازه زمانی<output className="period-output">{custom?period(conversation.request):'ماه گذشته: ۱ تا ۳۰ مهر ۱۴۰۵'}</output></label>{custom&&<div className="date-fields"><TextField label="از تاریخ" type="date" required value={conversation.request.start} onChange={e=>setConversation({...conversation,request:{...conversation.request,start:e.target.value}})}/><TextField label="تا تاریخ" type="date" required min={conversation.request.start} value={conversation.request.end} onChange={e=>setConversation({...conversation,request:{...conversation.request,end:e.target.value}})}/></div>}<div className="two-buttons" dir="ltr"><Button type="button" className={custom?'soft':'outline'} onClick={()=>setCustom(true)}>بازه دلخواه</Button><Button type="button" className={!custom?'soft':'outline'} onClick={()=>{setCustom(false);setConversation({...conversation,request:{...conversation.request,start:defaultRequest.start,end:defaultRequest.end}});}}>ماه گذشته</Button></div><Button className="primary full">دریافت صورت‌حساب</Button></form>}
      {busy&&<div className="loading-state" role="status"><Identity/><h3 dir="rtl">در حال {conversation.messages.at(-1)?.text.includes('سپرده')?'آماده‌سازی صورت‌حساب':'آماده‌سازی پاسخ'}…</h3><div className="card loading-card" dir="rtl"><p>✓ {conversation.messages.at(-1)?.text.includes('سپرده')?'اطلاعات درخواست بررسی شد':'درخواست دریافت شد'}</p><p>✓ حساب و بازه زمانی مشخص شد</p><p className="muted"><span className="spinner"/> در حال دریافت اطلاعات…</p><Button className="outline full" onClick={cancel}>توقف دریافت</Button></div><p className="muted" dir="rtl">می‌توانید پنل را ببندید؛ وضعیت درخواست حفظ می‌شود.</p></div>}
      {!result&&!completing&&!busy&&<AssistantScenario key={conversation?.id+String(conversation?.messages.length)} kind={(()=>{const m=[...(conversation?.messages||[])].reverse().find(m=>m.role==='user')?.text||'';return /اطلاعات مشتری/.test(m)?'customer':/راهنما/.test(m)?'guide':/پیگیری/.test(m)?'tracking':'';})()} history={history} onStatement={()=>void send('دریافت صورت‌حساب')} onHistory={()=>setView('history')}/>}{result&&!busy&&<div className="result"><Identity/><h3 dir="rtl">صورت‌حساب آماده است</h3><div className="statement-caption" dir="rtl">مشتری <strong>{fa(result.customerId)}</strong> · حساب •••• ۴۵۸۲<br/>{period(result)} · واحد مبالغ: ﷼</div><Card ref={output} className="card statement-card" dir="rtl"><div className="export-heading">صورت‌حساب نمونه · مشتری {fa(result.customerId)}<br/>{period(result)}</div><div className="summary">{[['مانده ابتدای دوره',result.opening],['جمع واریز',result.deposits],['جمع برداشت',result.withdrawals],['مانده پایان دوره',result.closing]].map(([label,value],i)=><div key={label} className={i===1?'deposit':i===3?'closing':''}><span>{label}</span><span>{money(Number(value))} ﷼</span></div>)}</div><strong>{fa(result.transactions.length)} تراکنش در این بازه</strong><table className="transactions"><thead><tr><th>تاریخ</th><th>شرح</th><th>مبلغ (﷼)</th></tr></thead><tbody>{result.transactions.map(t=><tr key={t.id}><td>{persianDate(t.posted_at)}</td><td>{t.description}</td><td>{money(Math.abs(t.amount))}</td></tr>)}</tbody></table>{result.transactions.length===0&&<p>در این بازه تراکنشی وجود ندارد.</p>}<div className="two-buttons export-buttons" dir="ltr"><Button className="outline" disabled={exporting} onClick={()=>void download('excel')}>دریافت Excel</Button><Button className="primary" disabled={exporting} onClick={()=>void download('pdf')}>دریافت PDF</Button></div><small className="statement-source">منبع: داده نمونه فیگما · به‌روزرسانی: {new Intl.DateTimeFormat('fa-IR',{timeStyle:'short',timeZone:'Asia/Tehran'}).format(new Date(result.generatedAt))}</small></Card><div className="response-actions"><IconButton label="گزینه‌های بیشتر" onClick={()=>setNotice('خروجی PDF و Excel از دکمه‌های بالای پاسخ در دسترس است.')}><Icon file="2b99d.svg"/></IconButton><IconButton label="کپی پاسخ" onClick={()=>{void navigator.clipboard.writeText(`صورت‌حساب نمونه مشتری ${fa(result.customerId)}\n${period(result)}\nمانده پایان دوره: ${money(result.closing)} ریال`).then(()=>setNotice('پاسخ کپی شد.')).catch(()=>setError('اجازه دسترسی به کلیپ‌بورد داده نشد.'));}}><Icon file="06fdd.svg"/></IconButton><IconButton label="دریافت مجدد" onClick={()=>void fetchStatement()}><Icon file="4e5c8.svg"/></IconButton><Button className={`icon-button ${liked?'liked':''}`} aria-label="مفید بود" aria-pressed={liked} onClick={()=>{setLiked(!liked);setNotice(liked?'بازخورد حذف شد.':'بازخورد شما ثبت شد.');}}><Icon file="4b14d.svg"/></Button></div><div className="follow-ups" dir="rtl"><Button onClick={()=>{setNotice('این نسخه به سامانه سپرده بانک متصل نیست. صورت‌حساب نمونه در همین پنل نمایش داده می‌شود.');}}>نمایش در سامانه سپرده</Button><Button onClick={()=>setChart(!chart)} aria-expanded={chart}>{chart?'بستن نمودار':'نموداری نمایش بده'}</Button></div>{chart&&<div className="card chart" dir="rtl"><h4>گردش حساب (ریال)</h4><BarChart data={[{kind:'واریز',amount:result.deposits},{kind:'برداشت',amount:result.withdrawals}]} categoryKey="kind" series={[{key:'amount',label:'مبلغ (ریال)'}]} className="h-64"/><p>واریز: {money(result.deposits)} ریال · برداشت: {money(result.withdrawals)} ریال</p></div>}</div>}
     </>}
    </>}
    {error&&<div className="error" role="alert" dir="rtl">{error}<Button onClick={()=>setError('')} aria-label="بستن خطا">×</Button></div>}
   </div>
   {view==='chat'&&<footer className="composer-footer"><PromptInput className="composer" value={text} onValueChange={setText} onSubmit={()=>void send()}><PromptInputTextarea ref={input} aria-label="درخواست شما" dir="rtl" placeholder="درخواستتان را بنویسید…" value={text} maxLength={2000} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send();}}}/><div className="composer-actions"><Button className="send-button" aria-label={busy?"توقف دریافت":"ارسال پیام"} disabled={!busy&&!text.trim()} type={busy?"button":"submit"} onClick={busy?cancel:undefined}>{busy?<span aria-hidden="true" className="stop-square"/>:<Icon file="bac9b.svg"/>}</Button><IconButton label="پیوست فایل" onClick={()=>setNotice('در سناریوی صورت‌حساب نیازی به پیوست نیست. بارگذاری فایل هنوز فعال نشده است.')}><Icon file="ccefb.svg"/></IconButton></div></PromptInput><p dir="rtl">اطلاعات فقط در محدوده دسترسی شما نمایش داده می‌شود.</p></footer>}
  </SheetContent>
  {notice&&<div className="toast" role="status" dir="rtl">{notice}</div>}
 </Sheet></ControlSizeProvider>;
}

function isConversation(value:unknown):value is Conversation {
 if(!value||typeof value!=='object')return false;
 const c=value as Conversation;
 return typeof c.id==='string' && typeof c.title==='string' && Array.isArray(c.messages) && c.messages.every(m=>m&&typeof m.text==='string'&&['user','assistant'].includes(m.role)) && requestSchema.safeParse(c.request).success && typeof c.updatedAt==='string' && Number.isFinite(Date.parse(c.updatedAt));
}
