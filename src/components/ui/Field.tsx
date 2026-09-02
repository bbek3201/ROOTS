'use client';

import { cn } from '@/lib/cn';
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

const CONTROL =
  'w-full rounded-2xl border border-line bg-surface px-4 py-3.5 text-base text-ink ' +
  'placeholder:text-muted transition-colors focus:border-sage focus:outline-none ' +
  // 16px minimum font size: anything smaller makes iOS Safari zoom on focus.
  'text-[16px]';

function Wrapper({
  label, hint, error, id, children, required,
}: {
  label: string; hint?: string; error?: string; id: string; children: ReactNode; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm text-ink-soft">
        {label}
        {required ? <span className="ml-1 text-forest" aria-hidden="true">*</span> : null}
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
  label, hint, error, required, className, trailing, ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
  /** A control inside the field's right edge — a password reveal, a unit. */
  trailing?: ReactNode;
}) {
  const generatedId = useId();
  const id = props.id ?? generatedId;
  const input = (
    <input
      {...props}
      id={id}
      required={required}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      className={cn(CONTROL, error && 'border-danger', trailing ? 'pr-12' : undefined, className)}
    />
  );
  return (
    <Wrapper label={label} hint={hint} error={error} id={id} required={required}>
      {trailing ? (
        <div className="relative">
          {input}
          <div className="absolute inset-y-0 right-1.5 flex items-center">{trailing}</div>
        </div>
      ) : (
        input
      )}
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
