import { z } from 'zod';

export const normalizeDigits = (text: string) => text.replace(/[۰-۹٠-٩]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d) < 0 ? '٠١٢٣٤٥٦٧٨٩'.indexOf(d) : '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
export const fa = (value: number | string) => String(value).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
export const money = (value: number) => new Intl.NumberFormat('fa-IR').format(value);
export const DEMO_CUSTOMER = '84839993';
export const DEMO_ACCOUNT = 'demo-4582';
export const requestSchema = z.object({ customerId: z.string().regex(/^\d{8}$/), accountId: z.literal(DEMO_ACCOUNT), start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).refine(v => Number.isFinite(Date.parse(v.start)) && Number.isFinite(Date.parse(v.end)) && v.start <= v.end && (Date.parse(v.end) - Date.parse(v.start)) / 86400000 <= 366, 'بازه زمانی معتبر و حداکثر یک سال باشد.');
export type StatementRequest = z.infer<typeof requestSchema>;
export type Transaction = { id: string; posted_at: string; description: string; amount: number };
export type Statement = StatementRequest & { opening: number; deposits: number; withdrawals: number; closing: number; transactions: Transaction[]; generatedAt: string; source: 'demo' };
export const defaultRequest: StatementRequest = { customerId: DEMO_CUSTOMER, accountId: DEMO_ACCOUNT, start: '2026-09-23', end: '2026-10-22' };
export const persianDate = (date: string) => new Intl.DateTimeFormat('fa-IR', { year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Tehran' }).format(new Date(date + 'T12:00:00Z'));
export const period = (req: StatementRequest) => req.start === defaultRequest.start && req.end === defaultRequest.end ? '۱ تا ۳۰ مهر ۱۴۰۵' : `${persianDate(req.start)} تا ${persianDate(req.end)}`;
export function detectCustomer(text: string) { return normalizeDigits(text).match(/\b\d{8}\b/)?.[0]; }
export function calculateStatement(request: StatementRequest, all: Transaction[]): Statement {
  const opening = 250000000 + all.filter(t=>t.posted_at < request.start).reduce((sum,t)=>sum+t.amount,0);
  const transactions = all.filter(t=>t.posted_at >= request.start && t.posted_at <= request.end);
  const deposits = transactions.reduce((sum,t)=>sum+Math.max(t.amount,0),0);
  const withdrawals = transactions.reduce((sum,t)=>sum+Math.max(-t.amount,0),0);
  return {...request, opening, deposits, withdrawals, closing:opening+deposits-withdrawals, transactions, generatedAt:new Date().toISOString(), source:'demo'};
}
export type Message = { id: string; role: 'user' | 'assistant'; text: string };
export type Conversation = { id: string; title: string; messages: Message[]; request: StatementRequest; result: Statement | null; updatedAt: string };
