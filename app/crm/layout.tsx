import { CrmMobileNav, CrmSidebar } from "@/components/crm/CrmSidebar";
import { requireCrmAdmin } from "@/lib/crm/access";

export const dynamic = "force-dynamic";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const user = await requireCrmAdmin();
  return (
    <div className="min-h-screen bg-[#F8F7F4] text-[#211432]">
      <CrmSidebar email={user.email!} />
      <main className="min-h-screen pb-20 md:ml-[236px] md:pb-0">{children}</main>
      <CrmMobileNav />
    </div>
  );
}
