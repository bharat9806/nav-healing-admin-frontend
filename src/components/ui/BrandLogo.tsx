import Image from 'next/image';
import s from './BrandLogo.module.scss';

export default function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`${s.logo} ${compact ? s.compact : ''}`}>
      <Image src="/brand-logo.png" alt="Nav Healing Herbs — Roots. Remedy. Relief." width={582} height={429} priority sizes={compact ? '176px' : '196px'} />
    </span>
  );
}
