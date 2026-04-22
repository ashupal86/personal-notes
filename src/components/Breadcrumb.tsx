import Link from 'next/link';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export default function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 mb-4 flex-wrap">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && (
              <span className="mi text-[13px] text-[var(--color-outline)]">chevron_right</span>
            )}
            {isLast || !item.href ? (
              <span className={`text-[12.5px] font-medium ${isLast ? 'text-[var(--color-on-surface)]' : 'text-[var(--color-on-surface-var)] hover:text-[var(--color-on-surface)]'}`}>
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="text-[12.5px] font-medium text-[var(--color-on-surface-var)] hover:text-[var(--color-primary)] transition-colors"
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
