import { money, period, persianDate, type Statement } from './domain';

function save(blob:Blob,filename:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function exportExcel(statement:Statement){
 const ExcelJS=await import('exceljs');const workbook=new ExcelJS.Workbook();
 const sheet=workbook.addWorksheet('صورت‌حساب نمونه',{views:[{rightToLeft:true}]});
 sheet.addRow(['صورت‌حساب نمونه',statement.customerId]);sheet.addRow(['بازه زمانی',period(statement)]);
 sheet.addRow(['مانده ابتدای دوره',statement.opening]);sheet.addRow(['جمع واریز',statement.deposits]);sheet.addRow(['جمع برداشت',statement.withdrawals]);sheet.addRow(['مانده پایان دوره',statement.closing]);sheet.addRow([]);sheet.addRow(['تاریخ','شرح','مبلغ (ریال)']);
 statement.transactions.forEach(t=>sheet.addRow([persianDate(t.posted_at),t.description,t.amount]));
 sheet.columns=[{width:28},{width:35},{width:24}];sheet.getRow(8).font={bold:true};
 const buffer=await workbook.xlsx.writeBuffer();save(new Blob([buffer as ArrayBuffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),`statement-${statement.customerId}.xlsx`);
}
export async function exportPdf(element:HTMLElement,statement:Statement){
 const [{default:html2canvas},{jsPDF}]=await Promise.all([import('html2canvas'),import('jspdf')]);
 await document.fonts.ready;
 const clone=element.cloneNode(true) as HTMLElement;clone.classList.add('exporting');clone.style.cssText='position:fixed;left:-10000px;top:0;width:372px;background:white;color:#0f172b;';
 document.body.appendChild(clone);
 try{
  const canvas=await html2canvas(clone,{scale:2,backgroundColor:'#ffffff',logging:false});const pdf=new jsPDF({unit:'mm',format:'a4'});const width=180,height=canvas.height*width/canvas.width;
  pdf.setProperties({title:`Demo statement ${statement.customerId}`,subject:`Closing balance ${money(statement.closing)}`});
  // Page slices preserve complete output for long custom periods.
  const pageHeight=267;for(let offset=0;offset<height;offset+=pageHeight){if(offset)pdf.addPage();pdf.addImage(canvas.toDataURL('image/png'),'PNG',15,15-offset,width,height);}
  pdf.save(`statement-${statement.customerId}.pdf`);
 } finally{clone.remove();}
}
