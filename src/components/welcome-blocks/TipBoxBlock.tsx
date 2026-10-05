import type { TipBoxContent } from "@/types/welcome-blocks";

export function TipBoxBlock({ content }: { content: TipBoxContent }) {
  const warning = content.style === "warning";
  return (
    <aside
      role="note"
      className="rounded-2xl border-l-4 p-4"
      style={{
        borderColor: warning ? "#D97706" : "#0F766E",
        background: warning ? "#FFFBEB" : "#F0FDFA",
      }}
    >
      <h3 className="text-sm font-semibold text-[#17181C]">{content.title}</h3>
      <p className="mt-1 text-sm text-[#17181C]">{content.body}</p>
    </aside>
  );
}
