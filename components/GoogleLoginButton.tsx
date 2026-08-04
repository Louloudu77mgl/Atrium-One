export function GoogleLoginButton({
  href = "/auth/google",
  label = "Connexion avec Google"
}: {
  href?: string;
  label?: string;
}) {
  return (
    <a
      href={href}
      className="flex w-full items-center justify-center gap-3 rounded-lg border border-[#D8B4FE] bg-white px-4 py-2.5 text-sm font-semibold text-[#211432] transition hover:bg-[#FBFAFF]"
    >
      <span className="text-base font-black text-[#4285F4]">G</span>
      {label}
    </a>
  );
}
