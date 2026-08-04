import Image from "next/image";

export function HansAvatar({
  size = 40,
  className = ""
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/hans.png"
      alt="Hans"
      width={size}
      height={size}
      className={`object-contain ${className}`}
      priority={size >= 80}
    />
  );
}
