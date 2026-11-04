'use client';
import {useState} from 'react';
import {Button} from './ui/button';
import {TextField} from './ui/text-field';
import {Card} from './ui/card';
import {type Conversation,normalizeDigits,fa} from '../lib/domain';
export function AssistantScenario({kind,history,onStatement,onHistory}:{kind:string;history:Conversation[];onStatement:()=>void;onHistory:()=>void}){
 const [customer,setCustomer]=useState(''),[checked,setChecked]=useState(false),[tracking,setTracking]=useState(''),[searched,setSearched]=useState(false);
 if(kind==='customer')return <Card className="scenario-card" dir="rtl"><h4>اطلاعات مشتری نمونه</h4><form onSubmit={e=>{e.preventDefault();setChecked(true);}}><TextField label="شماره مشتری" value={customer} onChange={e=>{setCustomer(e.target.value);setChecked(false);}} required inputMode="numeric" description="برای آزمایش: ۸۴۸۳۹۹۹۳"/><Button type="submit">بررسی مشتری</Button></form>{checked&&(normalizeDigits(customer.trim())==='84839993'?<div role="status"><p>شماره مشتری: ۸۴۸۳۹۹۹۳</p><p>سپرده کوتاه‌مدت •••• ۴۵۸۲</p><p>این اطلاعات نمونه است؛ اطلاعات هویتی واقعی متصل نیست.</p><Button onClick={onStatement}>دریافت صورت‌حساب این مشتری</Button></div>:<p role="alert">مشتری یافت نشد؛ فقط مشتری نمونه در دسترس است.</p>)}</Card>;
 if(kind==='guide')return <Card className="scenario-card" dir="rtl"><h4>برای کدام بخش راهنمایی می‌خواهید؟</h4><details><summary>دریافت و دانلود صورت‌حساب</summary><p>مشتری، حساب و بازه را انتخاب کنید؛ پس از دریافت، خروجی PDF، Excel و نمودار در دسترس است.</p><Button onClick={onStatement}>شروع دریافت صورت‌حساب</Button></details><details><summary>مدیریت گفتگوها</summary><p>از تاریخچه، گفتگو را باز کنید یا پس از تأیید حذف کنید.</p><Button onClick={onHistory}>باز کردن تاریخچه</Button></details></Card>;
 if(kind==='tracking'){const found=history.find(c=>c.id===tracking.trim());return <Card className="scenario-card" dir="rtl"><h4>پیگیری درخواست نمونه</h4><p>شناسه گفتگو را از تاریخچه کپی کنید. این بخش فقط درخواست‌های ذخیره‌شده شما را بررسی می‌کند.</p><form onSubmit={e=>{e.preventDefault();setSearched(true);}}><TextField label="شناسه درخواست" value={tracking} onChange={e=>{setTracking(e.target.value);setSearched(false);}} required/><Button type="submit">بررسی وضعیت</Button></form>{searched&&<p role="status">{found?(found.result?`صورت‌حساب آماده است؛ ${fa(found.result.transactions.length)} تراکنش.`:'این گفتگو هنوز صورت‌حساب آماده ندارد. برای ادامه از تاریخچه بازش کنید.'):'درخواستی با این شناسه در تاریخچه شما پیدا نشد.'}</p>}<Button variant="outline" onClick={onHistory}>مشاهده تاریخچه درخواست‌ها</Button></Card>;}
 return null;
}
