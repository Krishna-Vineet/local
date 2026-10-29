import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon } from './Icon'

export function PrimaryButton({ children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`button button--primary ${className}`} {...props}>{children}</button>
}

export function SecondaryButton({ children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`button button--secondary ${className}`} {...props}>{children}</button>
}

export function NextButton({ children = 'Next', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <PrimaryButton {...props}>{children}<Icon name="arrow-right" size={20}/></PrimaryButton>
}

export function BackButton({ onClick, label = 'Back', disabled }: { onClick: () => void; label?: string; disabled?: boolean }) {
  return <SecondaryButton onClick={onClick} disabled={disabled}><Icon name="arrow-left" size={20}/>{label}</SecondaryButton>
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'danger' | 'pink' }) {
  return <span className={`pill pill--${tone}`}>{children}</span>
}
