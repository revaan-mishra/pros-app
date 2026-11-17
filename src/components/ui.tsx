import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ArrowUpRight, Check, ChevronRight, X, type LucideIcon } from 'lucide-react';

export function Button({ children, variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  return <button className={`btn btn-${variant} ${className}`} {...props}>{children}</button>;
}
export function IconButton({ icon: Icon, label, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string }) {
  return <button className={`icon-btn ${className}`} aria-label={label} title={label} {...props}><Icon size={19}/></button>;
}
export function Progress({ value, label, color, className = '' }: { value: number; label: string; color?: string; className?: string }) {
  const percent = Math.min(100, Math.max(0, Number.isFinite(value) ? value * 100 : 0));
  return <div className={`progress ${className}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}><span style={{ width: `${percent}%`, background: color }}/></div>;
}
export function Empty({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={25}/></div><h3>{title}</h3><div className="empty-description">{children}</div>{action}</div>;
}
export function Tag({ children, tone = '' }: { children: ReactNode; tone?: string }) { return <span className={`tag ${tone}`}>{children}</span>; }
export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="section-title"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>;
}
export function PageHeading({ eyebrow, title, children, action }: { eyebrow: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return <header className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1 tabIndex={-1}>{title}</h1>{children && <p>{children}</p>}</div>{action}</header>;
}
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="field"><span className="field-label">{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
export function Dialog({ title, eyebrow, children, onClose, wide = false }: { title: string; eyebrow?: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useRef(`dialog-${crypto.randomUUID()}`).current;
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; const dialog = ref.current; dialog?.showModal(); return () => { dialog?.close(); previous?.focus?.(); }; }, []);
  return <dialog ref={ref} className={`dialog ${wide ? 'dialog-wide' : ''}`} aria-labelledby={headingId} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) { const b = e.currentTarget.getBoundingClientRect(); if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom) onClose(); } }}><div className="dialog-header"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h2 id={headingId}>{title}</h2></div><IconButton icon={X} label="Close dialog" onClick={onClose}/></div><div className="dialog-content">{children}</div></dialog>;
}
export function RowLink({ icon: Icon, title, description, onClick, badge }: { icon: LucideIcon; title: string; description?: string; onClick: () => void; badge?: string }) {
  return <button className="row-link" onClick={onClick}><span className="row-icon"><Icon size={20}/></span><span><strong>{title}</strong>{description && <small>{description}</small>}</span>{badge && <Tag>{badge}</Tag>}<ChevronRight size={17}/></button>;
}
export function CheckMark({ checked, label, onClick, disabled = false }: { checked: boolean; label: string; onClick: () => void; disabled?: boolean }) {
  return <button className={`check-mark ${checked ? 'checked' : ''}`} aria-label={label} aria-pressed={checked} onClick={onClick} disabled={disabled}>{checked && <Check size={14}/>}</button>;
}
export function TextLink({ children, onClick }: { children: ReactNode; onClick: () => void }) { return <button className="text-link" onClick={onClick}>{children}<ArrowUpRight size={15}/></button>; }
export const formatMinutes = (seconds: number) => { const m = Math.round(seconds / 60); return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`; };
export const formatNumber = (n: number) => new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(n);
