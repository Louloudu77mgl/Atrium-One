export function CrmPageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E8E4DB] bg-white px-5 py-5 lg:px-8">
      <div>
        {eyebrow ? <div className="mb-1 text-[10px] font-black uppercase tracking-[.14em] text-[#8B7AA8]">{eyebrow}</div> : null}
        <h1 className="text-[24px] font-black tracking-[-.03em]">{title}</h1>
        {description ? <p className="mt-1 text-[13px] font-medium text-[#6B617F]">{description}</p> : null}
      </div>
      {actions}
    </header>
  );
}
