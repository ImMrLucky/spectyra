import { Project, SyntaxKind, Node, PropertySignature } from "ts-morph";
import * as path from "path";
import * as fs from "fs";

type DeclKind = "interface" | "type" | "enum";

type DeclInfo = {
    name: string;
    kind: DeclKind;
    file: string;
    line: number;
    signature: string;      // normalized “shape”
    rawPreview: string;     // short preview for report
};

function rel(p: string) {
    return path.relative(process.cwd(), p).split("\\").join("/");
}

function getLine(node: Node): number {
    const sf = node.getSourceFile();
    const pos = node.getStart();
    const lc = sf.getLineAndColumnAtPos(pos);
    return lc.line;
}

function signatureForInterface(node: Node): { sig: string; preview: string } | null {
    if (!Node.isInterfaceDeclaration(node)) return null;

    const name = node.getName();
    const extendsNames = node.getExtends().map(e => e.getText()).sort();
    const props = node.getProperties().map(p => {
        const pname = p.getName();
        const optional = p.hasQuestionToken() ? "?" : "";
        return `${pname}${optional}`;
    }).sort();

    const sig = `extends=[${extendsNames.join(",")}] props=[${props.join(",")}]`;
    const preview = `interface ${name} { ${props.slice(0, 12).join(", ")}${props.length > 12 ? ", ..." : ""} }`;
    return { sig, preview };
}

function signatureForTypeAlias(node: Node): { sig: string; preview: string } | null {
    if (!Node.isTypeAliasDeclaration(node)) return null;

    const name = node.getName();
    const typeNode = node.getTypeNode();
    if (!typeNode) return { sig: "unknown", preview: `type ${name} = <no typeNode>` };

    // Only attempt structural signature for object literal types: type X = { ... }
    if (typeNode.getKind() === SyntaxKind.TypeLiteral) {
        const tl = typeNode.asKindOrThrow(SyntaxKind.TypeLiteral);
        const members = tl.getMembers();

        const props: string[] = [];
        for (const m of members) {
            if (m.getKind() === SyntaxKind.PropertySignature) {
                const ps = m as PropertySignature;
                const pname = ps.getName();
                const optional = ps.hasQuestionToken() ? "?" : "";
                props.push(`${pname}${optional}`);
            }
        }

        props.sort();
        const sig = `props=[${props.join(",")}]`;
        const preview = `type ${name} = { ${props.slice(0, 12).join(", ")}${props.length > 12 ? ", ..." : ""} }`;
        return { sig, preview };
    }

    // Fallback for non-object type aliases
    const text = typeNode.getText();
    const sig = `type=${text.substring(0, 140)}`;
    const preview = `type ${name} = ${text.substring(0, 140)}${text.length > 140 ? "..." : ""}`;
    return { sig, preview };
}

function signatureForEnum(node: Node): { sig: string; preview: string } | null {
    if (!Node.isEnumDeclaration(node)) return null;

    const name = node.getName();
    const members = node.getMembers().map(m => m.getName()).sort();
    const sig = `members=[${members.join(",")}]`;
    const preview = `enum ${name} { ${members.slice(0, 16).join(", ")}${members.length > 16 ? ", ..." : ""} }`;
    return { sig, preview };
}

function main() {
    const project = new Project({
        // Don’t rely on tsconfig; we want a fast scan
        skipAddingFilesFromTsConfig: true,
    });

    const includeGlobs = [
        "apps/**/src/**/*.{ts,tsx}",
        "packages/**/src/**/*.{ts,tsx}",
    ];
    const excludeGlobs = [
        "**/*.spec.ts",
        "**/*.test.ts",
        "**/dist/**",
        "**/node_modules/**",
        "**/.turbo/**",
        "**/build/**",
        "**/coverage/**",
    ];

    project.addSourceFilesAtPaths(includeGlobs);

    const decls: DeclInfo[] = [];
    for (const sf of project.getSourceFiles()) {
        const fp = rel(sf.getFilePath());
        if (
            fp.includes("node_modules") ||
            fp.includes("/dist/") ||
            fp.includes("/build/") ||
            fp.includes("/coverage/") ||
            fp.endsWith(".spec.ts") ||
            fp.endsWith(".test.ts")
        ) continue;

        const nodes = sf.forEachChildAsArray();

        for (const node of nodes) {
            if (Node.isInterfaceDeclaration(node)) {
                const s = signatureForInterface(node)!;
                decls.push({
                    name: node.getName(),
                    kind: "interface",
                    file: fp,
                    line: getLine(node),
                    signature: s.sig,
                    rawPreview: s.preview,
                });
            } else if (Node.isTypeAliasDeclaration(node)) {
                const s = signatureForTypeAlias(node)!;
                decls.push({
                    name: node.getName(),
                    kind: "type",
                    file: fp,
                    line: getLine(node),
                    signature: s.sig,
                    rawPreview: s.preview,
                });
            } else if (Node.isEnumDeclaration(node)) {
                const s = signatureForEnum(node)!;
                decls.push({
                    name: node.getName(),
                    kind: "enum",
                    file: fp,
                    line: getLine(node),
                    signature: s.sig,
                    rawPreview: s.preview,
                });
            }
        }
    }

    const byName = new Map<string, DeclInfo[]>();
    for (const d of decls) {
        const arr = byName.get(d.name) ?? [];
        arr.push(d);
        byName.set(d.name, arr);
    }

    const duplicates = Array.from(byName.entries()).filter(([, arr]) => arr.length > 1);

    const collisions = duplicates.filter(([, arr]) => {
        const sigs = new Set(arr.map(a => `${a.kind}|${a.signature}`));
        return sigs.size > 1;
    });

    const identical = duplicates.filter(([, arr]) => {
        const sigs = new Set(arr.map(a => `${a.kind}|${a.signature}`));
        return sigs.size === 1;
    });

    const lines: string[] = [];
    lines.push(`# Type Collision Report`);
    lines.push(``);
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(``);
    lines.push(`## Summary`);
    lines.push(`- Total declarations scanned: ${decls.length}`);
    lines.push(`- Duplicate names (2+ occurrences): ${duplicates.length}`);
    lines.push(`- **Collisions (same name, different shape): ${collisions.length}**`);
    lines.push(`- Duplicates (same name, same shape): ${identical.length}`);
    lines.push(``);

    lines.push(`## Collisions (high risk)`);
    if (collisions.length === 0) {
        lines.push(`No collisions found ✅`);
    } else {
        lines.push(`| Name | Occurrences | Kinds | Files |`);
        lines.push(`|---|---:|---|---|`);
        const sortedCollisions = collisions
            .slice()
            .sort((a, b) => b[1].length - a[1].length);

        for (let i = 0; i < sortedCollisions.length; i++) {
            const [name, arr] = sortedCollisions[i];

            // unique kinds without Set + spread
            const kindsMap: Record<string, true> = {};
            for (let j = 0; j < arr.length; j++) {
                kindsMap[arr[j].kind] = true;
            }
            const kinds = Object.keys(kindsMap).join(",");

            const files =
                arr
                    .map(a => `${a.file}:${a.line}`)
                    .slice(0, 3)
                    .join("<br/>") +
                (arr.length > 3 ? "<br/>…" : "");

            lines.push(`| \`${name}\` | ${arr.length} | ${kinds} | ${files} |`);
        }

    }
    lines.push(``);

    lines.push(`## Details`);
    for (const [name, arr] of collisions.sort((a,b) => a[0].localeCompare(b[0]))) {
        lines.push(`### ${name}`);
        lines.push(``);
        for (const d of arr.sort((a,b) => a.file.localeCompare(b.file))) {
            lines.push(`- **${d.kind}** — \`${d.file}:${d.line}\``);
            lines.push(`  - signature: \`${d.signature}\``);
            lines.push(`  - preview: ${d.rawPreview}`);
        }
        lines.push(``);
    }

    const outPath = path.join(process.cwd(), "TYPE_COLLISIONS.md");
    fs.writeFileSync(outPath, lines.join("\n"), "utf8");
    // Optional strict mode
    if (process.argv.includes("--fail-on-collision") && collisions.length > 0) {
        console.error(`Type collisions found: ${collisions.length}. See TYPE_COLLISIONS.md`);
        process.exit(1);
    }
}

main();
