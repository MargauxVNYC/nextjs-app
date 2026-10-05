"use client";

import { usePathname } from "next/navigation";

const links = [
    { href: "/", label: "Dashboard", icon: "✦" },
    { href: "/captions", label: "Caption the City", icon: "💬" },
    { href: "/spots", label: "Spots", icon: "📍" },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="sidebar">
            <a href="/" className="brand">
                <span className="brand-mark">NYC</span>
                <span>Spots</span>
            </a>

            <nav className="side-nav">
                {links.map((link) => {
                    const active =
                        link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
                    return (
                        <a
                            key={link.href}
                            href={link.href}
                            className={`side-link${active ? " active" : ""}`}
                        >
                            <span>{link.icon}</span>
                            {link.label}
                        </a>
                    );
                })}
            </nav>

            <p className="side-footer">Made in New York</p>
        </aside>
    );
}