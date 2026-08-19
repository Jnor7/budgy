"use client";

import { Ellipsis, Home, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useBudgyData } from "@/lib/data/data-provider";
import { moduleDefinition, primaryNavigationModules } from "@/lib/modules/registry";

interface Tab { href: string; label: string; icon: LucideIcon }

const HOME: Tab = { href: "/", label: "Accueil", icon: Home };
const MORE: Tab = { href: "/more", label: "Plus", icon: Ellipsis };

/**
 * La navigation ne montre jamais une destination inutile : elle est
 * entièrement dérivée des modules activés (§6). Rien n'est codé en dur en
 * dehors d'Accueil et Plus, présents pour tout le monde.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { modules, ready } = useBudgyData();

  const tabs = useMemo<Tab[]>(() => {
    const moduleTabs = primaryNavigationModules(modules)
      .map(moduleDefinition)
      .map((definition) => ({
        href: definition.href,
        label: definition.label.split(" ")[0]!,
        icon: definition.icon,
      }));
    return [HOME, ...moduleTabs, MORE];
  }, [modules]);

  return (
    <div className="app-frame">
      <div className="page-transition" key={pathname}>{children}</div>
      <div className="tabbar-wrap">
        <nav className="tabbar" aria-label="Navigation principale" aria-busy={!ready}>
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                className={`tab ${active ? "active" : ""}`}
                href={href}
                key={href}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={22} strokeWidth={active ? 2.6 : 2.1} />
                <span>{label}</span>
                <i className="tab-dot" />
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
