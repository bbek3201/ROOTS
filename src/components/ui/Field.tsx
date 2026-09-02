'use client';

import { cn } from '@/lib/cn';
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

const CONTROL =
  'w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-base text-ink ' +
  'placeholder:text-muted/70 transition-colors focus:border-ember focus:outline-none ' +
  // 16px minimum font size: anything smaller makes iOS Safari zoom on focus.
  'text-[16px]';

function Wrapper({
  label, hint, error, id, children, required,
}: {
  label: string; hint?: string; error?: string; id: string; children: ReactNode; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink-soft">
        {label}
        {required ? <span className="ml-1 text-ember" aria-hidden="true">*</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextField({
  label, hint, error, required, className, ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const generatedId = useId();
  const id = props.id ?? generatedId;
  return (
    <Wrapper label={label} hint={hint} error={error} id={id} required={required}>
      <input
        {...props}
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(CONTROL, error && 'border-danger', className)}
      />
    </Wrapper>
  );
}

export function TextAreaField({
  label, hint, error, required, className, ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string; error?: string }) {
  const generatedId = useId();
  const id = props.id ?? generatedId;
  return (
    <Wrapper label={label} hint={hint} error={error} id={id} required={required}>
      <textarea
        {...props}
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(CONTROL, 'min-h-32 resize-y leading-relaxed', error && 'border-danger', className)}
      />
    </Wrapper>
  );
}

export function SelectField({
  label, hint, error, required, className, children, ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string; error?: string }) {
  const generatedId = useId();
  const id = props.id ?? generatedId;
  return (
    <Wrapper label={label} hint={hint} error={error} id={id} required={required}>
      <select
        {...props}
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(CONTROL, 'appearance-none pr-9', error && 'border-danger', className)}
      >
        {children}
      </select>
    </Wrapper>
  );
}
