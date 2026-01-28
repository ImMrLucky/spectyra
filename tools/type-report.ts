/**
 * Type/Interface Report Generator
 * 
 * Scans all TypeScript source files and generates:
 * 1. TYPE_INDEX.md - Full inventory of all types/interfaces/enums
 * 2. TYPE_COLLISIONS.md - Duplicate names with shape differences
 */

import { Project, SyntaxKind, Node, PropertySignature } from "ts-morph";
import * as path from "path";
import * as fs from "fs";

type DeclKind = "interface" | "type" | "enum";

type DeclInfo = {
    name: string;
    kind: DeclKind;
    file: string;
    line: number;
    signature: string;      // normalized "shape"
    rawPreview: string;     // short preview for report
};

function rel(p: string): string {
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
    const maxLen = 140;
    const truncated = text.length > maxLen ? text.substring(0, maxLen) : text;
    const sig = `type=${truncated}`;
    const preview = `type ${name} = ${truncated}${text.length > maxLen ? "..." : ""}`;
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

function shouldExcludeFile(filePath: string): boolean {
    const fp = rel(filePath);
    return (
        fp.indexOf("node_modules") !== -1 ||
        fp.indexOf("/dist/") !== -1 ||
        fp.indexOf("/build/") !== -1 ||
        fp.indexOf("/coverage/") !== -1 ||
        fp.indexOf("/.turbo/") !== -1 ||
        fp.endsWith(".spec.ts") ||
        fp.endsWith(".test.ts") ||
        fp.endsWith(".spec.tsx") ||
        fp.endsWith(".test.tsx")
    );
}

function collectDeclarations(): DeclInfo[] {
    const project = new Project({
        skipAddingFilesFromTsConfig: true,
    });

    const includeGlobs = [
        "apps/**/src/**/*.{ts,tsx}",
        "packages/**/src/**/*.{ts,tsx}",
    ];

    project.addSourceFilesAtPaths(includeGlobs);

    const decls: DeclInfo[] = [];
    for (const sf of project.getSourceFiles()) {
        const fp = rel(sf.getFilePath());
        if (shouldExcludeFile(fp)) continue;

        const nodes = sf.forEachChildAsArray();

        for (const node of nodes) {
            if (Node.isInterfaceDeclaration(node)) {
                const s = signatureForInterface(node);
                if (s) {
                    decls.push({
                        name: node.getName(),
                        kind: "interface",
                        file: fp,
                        line: getLine(node),
                        signature: s.sig,
                        rawPreview: s.preview,
                    });
                }
            } else if (Node.isTypeAliasDeclaration(node)) {
                const s = signatureForTypeAlias(node);
                if (s) {
                    decls.push({
                        name: node.getName(),
                        kind: "type",
                        file: fp,
                        line: getLine(node),
                        signature: s.sig,
                        rawPreview: s.preview,
                    });
                }
            } else if (Node.isEnumDeclaration(node)) {
                const s = signatureForEnum(node);
                if (s) {
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
    }

    return decls;
}

function generateTypeIndex(decls: DeclInfo[]): string {
    const lines: string[] = [];
    lines.push(`# Type Index`);
    lines.push(``);
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(``);
    lines.push(`## Summary`);
    
    const byKind: Record<DeclKind, number> = { interface: 0, type: 0, enum: 0 };
    for (const d of decls) {
        byKind[d.kind]++;
    }
    
    lines.push(`- Total declarations: ${decls.length}`);
    lines.push(`  - Interfaces: ${byKind.interface}`);
    lines.push(`  - Type aliases: ${byKind.type}`);
    lines.push(`  - Enums: ${byKind.enum}`);
    lines.push(`- Unique names: ${new Set(decls.map(d => d.name)).size}`);
    lines.push(``);

    // Group by name
    const byName = new Map<string, DeclInfo[]>();
    for (const d of decls) {
        const arr = byName.get(d.name) || [];
        arr.push(d);
        byName.set(d.name, arr);
    }

    // Sort names alphabetically
    const sortedNames = Array.from(byName.keys()).sort((a, b) => a.localeCompare(b));

    lines.push(`## Declarations (A-Z)`);
    lines.push(``);

    for (const name of sortedNames) {
        const arr = byName.get(name)!;
        lines.push(`### ${name}`);
        lines.push(``);
        
        // Sort declarations by file path, then line
        arr.sort((a, b) => {
            const fileCmp = a.file.localeCompare(b.file);
            return fileCmp !== 0 ? fileCmp : a.line - b.line;
        });

        for (const d of arr) {
            lines.push(`- **${d.kind}** — \`${d.file}:${d.line}\``);
            lines.push(`  - signature: \`${d.signature}\``);
            lines.push(`  - preview: ${d.rawPreview}`);
            lines.push(``);
        }
    }

    return lines.join("\n");
}

function generateTypeCollisions(decls: DeclInfo[]): string {
    const lines: string[] = [];
    lines.push(`# Type Collision Report`);
    lines.push(``);
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(``);
    lines.push(`## Summary`);
    
    const byKind: Record<DeclKind, number> = { interface: 0, type: 0, enum: 0 };
    for (const d of decls) {
        byKind[d.kind]++;
    }
    
    lines.push(`- Total declarations scanned: ${decls.length}`);
    lines.push(`  - Interfaces: ${byKind.interface}`);
    lines.push(`  - Type aliases: ${byKind.type}`);
    lines.push(`  - Enums: ${byKind.enum}`);
    lines.push(``);

    // Group by name
    const byName = new Map<string, DeclInfo[]>();
    for (const d of decls) {
        const arr = byName.get(d.name) || [];
        arr.push(d);
        byName.set(d.name, arr);
    }

    const duplicates = Array.from(byName.entries()).filter(([, arr]) => arr.length > 1);

    const collisions = duplicates.filter(([, arr]) => {
        // Check if there are different signatures (kind or signature differs)
        const sigs = new Set<string>();
        for (let i = 0; i < arr.length; i++) {
            sigs.add(`${arr[i].kind}|${arr[i].signature}`);
        }
        return sigs.size > 1;
    });

    const identical = duplicates.filter(([, arr]) => {
        const sigs = new Set<string>();
        for (let i = 0; i < arr.length; i++) {
            sigs.add(`${arr[i].kind}|${arr[i].signature}`);
        }
        return sigs.size === 1;
    });

    lines.push(`- Duplicate names (2+ occurrences): ${duplicates.length}`);
    lines.push(`- **Collisions (same name, different shape): ${collisions.length}** ⚠️`);
    lines.push(`- Duplicates (same name, same shape): ${identical.length}`);
    lines.push(``);

    lines.push(`## Collisions (HIGH RISK - Same name, different shape)`);
    if (collisions.length === 0) {
        lines.push(`No collisions found ✅`);
    } else {
        lines.push(`| Name | Occurrences | Kinds | Files |`);
        lines.push(`|---|---:|---|---|`);
        
        // Sort by number of occurrences (descending)
        const sortedCollisions = collisions.slice().sort((a, b) => b[1].length - a[1].length);

        for (let i = 0; i < sortedCollisions.length; i++) {
            const [name, arr] = sortedCollisions[i];

            // Get unique kinds
            const kindsMap: Record<string, true> = {};
            for (let j = 0; j < arr.length; j++) {
                kindsMap[arr[j].kind] = true;
            }
            const kinds = Object.keys(kindsMap).sort().join(",");

            const files = arr
                .map(a => `${a.file}:${a.line}`)
                .slice(0, 3)
                .join("<br/>") + (arr.length > 3 ? "<br/>…" : "");

            lines.push(`| \`${name}\` | ${arr.length} | ${kinds} | ${files} |`);
        }
    }
    lines.push(``);

    lines.push(`## Duplicates (LOW RISK - Same name, same shape)`);
    if (identical.length === 0) {
        lines.push(`No identical duplicates found.`);
    } else {
        lines.push(`| Name | Occurrences | Kind | Files |`);
        lines.push(`|---|---:|---|---|`);
        
        const sortedIdentical = identical.slice().sort((a, b) => b[1].length - a[1].length);
        
        for (let i = 0; i < sortedIdentical.length; i++) {
            const [name, arr] = sortedIdentical[i];
            const kind = arr[0].kind; // All same kind
            const files = arr
                .map(a => `${a.file}:${a.line}`)
                .slice(0, 3)
                .join("<br/>") + (arr.length > 3 ? "<br/>…" : "");
            
            lines.push(`| \`${name}\` | ${arr.length} | ${kind} | ${files} |`);
        }
    }
    lines.push(``);

    lines.push(`## Collision Details`);
    if (collisions.length === 0) {
        lines.push(`No collisions to detail.`);
    } else {
        // Sort collisions alphabetically by name
        const sortedCollisions = collisions.slice().sort((a, b) => a[0].localeCompare(b[0]));
        
        for (let i = 0; i < sortedCollisions.length; i++) {
            const [name, arr] = sortedCollisions[i];
            lines.push(`### ${name}`);
            lines.push(``);
            
            // Sort by file path, then line
            arr.sort((a, b) => {
                const fileCmp = a.file.localeCompare(b.file);
                return fileCmp !== 0 ? fileCmp : a.line - b.line;
            });
            
            for (let j = 0; j < arr.length; j++) {
                const d = arr[j];
                lines.push(`- **${d.kind}** — \`${d.file}:${d.line}\``);
                lines.push(`  - signature: \`${d.signature}\``);
                lines.push(`  - preview: ${d.rawPreview}`);
            }
            lines.push(``);
        }
    }

    return lines.join("\n");
}

function main(): void {
    console.log("Scanning TypeScript files...");
    const decls = collectDeclarations();
    console.log(`Found ${decls.length} declarations`);

    console.log("Generating TYPE_INDEX.md...");
    const indexContent = generateTypeIndex(decls);
    const indexPath = path.join(process.cwd(), "TYPE_INDEX.md");
    fs.writeFileSync(indexPath, indexContent, "utf8");
    console.log(`✓ Written ${indexPath}`);

    console.log("Generating TYPE_COLLISIONS.md...");
    const collisionsContent = generateTypeCollisions(decls);
    const collisionsPath = path.join(process.cwd(), "TYPE_COLLISIONS.md");
    fs.writeFileSync(collisionsPath, collisionsContent, "utf8");
    console.log(`✓ Written ${collisionsPath}`);

    // Count collisions for exit code
    const byName = new Map<string, DeclInfo[]>();
    for (const d of decls) {
        const arr = byName.get(d.name) || [];
        arr.push(d);
        byName.set(d.name, arr);
    }

    const duplicates = Array.from(byName.entries()).filter(([, arr]) => arr.length > 1);
    const collisions = duplicates.filter(([, arr]) => {
        const sigs = new Set<string>();
        for (let i = 0; i < arr.length; i++) {
            sigs.add(`${arr[i].kind}|${arr[i].signature}`);
        }
        return sigs.size > 1;
    });

    if (process.argv.indexOf("--fail-on-collision") !== -1 && collisions.length > 0) {
        console.error(`\n❌ Type collisions found: ${collisions.length}. See TYPE_COLLISIONS.md`);
        process.exit(1);
    }

    console.log(`\n✅ Complete! Found ${collisions.length} collisions, ${duplicates.length - collisions.length} identical duplicates.`);
}

main();
