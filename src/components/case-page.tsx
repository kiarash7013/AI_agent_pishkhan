import { Button } from './ui/button';
import { ChevronLeftIcon, MoreHorizontalIcon } from './icons';
import { fa } from '../lib/domain';

const titles = ['الزام خوانده به تنظیم سند رسمی ملک','مطالبه خسارت ناشی از نقض قرارداد','الزام به تحویل مورد معامله','استرداد وجه پرداختی بابت قرارداد','ابطال سند رسمی انتقال مالکیت','رفع تصرف عدوانی از ملک','تقسیم و فروش ترکه متوفی','تخلیه فوری ملک تجاری','فسخ قرارداد فروش ملک','مطالبه وجه قرارداد'];
const numbers = [83174629,59420871,72691538,41837065,96554173,63719682,28576314,75148620,39642751,81493567];
const classifications = [472918,815364,296741,638502,951276,374819,720465,186937,543281,869154];
const categories = ['حقوقی','حقوقی','کیفری','تعزیرات','کیفری','تعزیرات','اداره کار','اداره کار','اداره کار','اداره کار'];
const types = ['حقوقی','کیفری','اداره کار','تعزیرات','کیفری','حقوقی','تعزیرات','اداره کار','حقوقی','کیفری'];
const statuses = ['مختومه','فعال','فعال','فعال','فعال','حذف شده','حذف شده','مختومه','حذف شده','حذف شده'];
const columns = ['#','عنوان پرونده','شماره پرونده','پرونده دعاوی','کلاسه داخلی','نوع پرونده','وضعیت','مطروحه توسط','عملیات'];
const image=(name:string)=><img src={`/assets/${name}`} alt="" draggable={false}/>;

export function CasePage({onNotice}:{onNotice:(message:string)=>void}){
 const demo=()=>onNotice('این بخش نمونه نمایشی است؛ فلو دستیار و دریافت صورت‌حساب قابل آزمایش است.');
 return <main className="case-page" aria-label="پرونده دعاوی">
  <div className="page-title"><h1>پرونده دعاوی</h1><Button variant="ghost" className="back-button" onClick={demo}><ChevronLeftIcon className="size-5" width={20} height={20}/><span>بازگشت</span></Button><span className="sr-only">نسخه نمایشی، داده‌ها نمونه‌اند.</span></div>
  <div className="breadcrumb">صفحه اصلی <span>‹</span> پرونده دعاوی</div>
  <div className="toolbar" dir="ltr"><Button className="primary add-case" onClick={demo} dir="rtl">{image('09c89.svg')}<span>افزودن پرونده جدید</span></Button><div className="search-case"><Button variant="outline" className="outline" onClick={demo} dir="rtl">{image('48dc2.svg')}<span>جستجو پرونده</span></Button><span className="filter-indicator" aria-hidden="true"/></div></div>
  <div className="filters">{image('d7ebc.svg')}{['پرونده دعاوی: همه','شماره پرونده: ۳۱','کلاسه داخلی: ۱۱','وضعیت: همه'].map(s=><span key={s}>{s}</span>)}</div>
  <div className="table-card"><div className="table-overflow"><table className="cases"><colgroup><col className="col-index"/><col className="col-title"/>{Array.from({length:6},(_,i)=><col key={i} className="col-data"/>)}<col className="col-actions"/></colgroup><thead><tr>{columns.map((label,i)=><th key={label}><span className="column-heading">{label}{i>0&&i<8&&image('06771.svg')}</span></th>)}</tr></thead><tbody>{titles.map((title,i)=><tr key={title}><td>{fa(i+1)}</td><td>{title}</td><td>{fa(numbers[i])}</td><td>{categories[i]}</td><td>{fa(classifications[i])}</td><td>{types[i]}</td><td><span className={`status-pill ${statuses[i]==='فعال'?'status-active':statuses[i]==='مختومه'?'status-closed':i===6?'status-removed-blue':'status-removed'}`}>{statuses[i]}</span></td><td>له</td><td><Button variant="ghost" className="case-more" aria-label={`عملیات پرونده ${i+1}`} onClick={demo}><MoreHorizontalIcon className="size-6" width={24} height={24}/></Button></td></tr>)}</tbody></table></div>
   <div className="pagination"><Button variant="ghost" className="page-size" onClick={demo}>نمایش ۱۰ تایی {image('b8e62.svg')}</Button><div className="pagination-start" dir="ltr"><div className="pagination-pages"><Button variant="ghost" aria-label="صفحه قبل" onClick={demo}>{image('8b882.svg')}</Button><Button variant="ghost" onClick={demo}>۱۰</Button><span className="page-ellipsis">{image('dd55f.svg')}</span>{[5,4,3,2,1].map(n=><Button variant="ghost" key={n} className={n===1?'current':''} aria-current={n===1?'page':undefined} onClick={n===1?undefined:demo}>{fa(n)}</Button>)}<Button variant="ghost" aria-label="صفحه بعد" onClick={demo}>{image('118e4.svg')}</Button></div><span className="record-count" dir="rtl">تعداد رکوردها : <strong>۱۹۲</strong></span></div></div>
  </div>
 </main>;
}
