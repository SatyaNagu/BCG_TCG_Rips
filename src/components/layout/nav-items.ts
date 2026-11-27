export const NAV_ITEMS = [
  { label: "Packs", href: "/packs" },
  { label: "Collection", href: "/collection" },
  { label: "Wallet", href: "/wallet" },
] as const;

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
