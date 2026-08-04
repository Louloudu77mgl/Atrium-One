import { Icon } from "@/components/icons";
import { tools } from "@/lib/mock-data";

const toneClasses = {
  blue: "bg-[#F3F0FF]",
  amber: "bg-[#F5F0FF]",
  green: "bg-[#F3E8FF]",
  purple: "bg-[#F3EEF8]"
};

export function ToolsGrid() {
  const iconNames = ["phone", "image", "message", "party"] as const;

  return (
    <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
      {tools.map((tool, index) => (
        <article key={tool.name} className="flex flex-col gap-2.5 rounded-[14px] border border-[#E9D5FF] bg-white p-[18px] shadow-[0_1px_4px_rgba(76,29,149,0.07)] transition hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(76,29,149,0.10)]">
          <div className={`flex h-[42px] w-[42px] items-center justify-center rounded-[10px] text-[#7C3AED] ${toneClasses[tool.tone as keyof typeof toneClasses]}`}>
            <Icon name={iconNames[index] ?? "sparkle"} className="h-5 w-5" />
          </div>
          <div>
            <h3 className="mb-0.5 text-sm font-bold">{tool.name}</h3>
            <p className="text-xs leading-5 text-[#6B617F]">{tool.description}</p>
          </div>
          <div className="mt-auto flex items-center justify-between gap-3">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tool.active ? "bg-[#F3E8FF] text-[#7C3AED]" : "bg-[#F3F4F6] text-[#6B617F]"}`}>
              {tool.active ? "● " : ""}
              {tool.status}
            </span>
            <button type="button" className="rounded-lg border border-[#E9D5FF] px-3 py-1.5 text-xs font-semibold text-[#6B617F] transition hover:border-[#4C1D95] hover:bg-[#F3F0FF] hover:text-[#4C1D95]">
              {tool.action}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
