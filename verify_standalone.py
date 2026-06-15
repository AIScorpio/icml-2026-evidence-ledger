from __future__ import annotations

import argparse
from html.parser import HTMLParser
from pathlib import Path


class AssetAuditParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.external_scripts: list[str] = []
        self.external_stylesheets: list[str] = []
        self.inline_scripts = 0
        self.inline_styles = 0
        self.root_found = False

    def handle_starttag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        attributes = dict(attrs)
        if tag == "script":
            source = attributes.get("src")
            if source:
                self.external_scripts.append(source)
            else:
                self.inline_scripts += 1
        elif tag == "link" and attributes.get("rel") == "stylesheet":
            href = attributes.get("href")
            if href:
                self.external_stylesheets.append(href)
        elif tag == "style":
            self.inline_styles += 1
        elif tag == "div" and attributes.get("id") == "root":
            self.root_found = True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("html", type=Path)
    args = parser.parse_args()

    html = args.html.read_text(encoding="utf-8")
    module_marker = '<script type="module">'
    module_start = html.find(module_marker)
    module_end = html.rfind("</script>")
    if module_start == -1 or module_end == -1 or module_end < module_start:
        raise SystemExit("Standalone verification failed: inline module not found")

    shell = (
        html[: module_start + len(module_marker)]
        + html[module_end:]
    )
    audit = AssetAuditParser()
    audit.feed(shell)

    checks = {
        "root_found": audit.root_found,
        "inline_script_found": audit.inline_scripts > 0,
        "inline_style_found": audit.inline_styles > 0,
        "no_external_scripts": not audit.external_scripts,
        "no_external_stylesheets": not audit.external_stylesheets,
        "single_script_terminator": html.lower().count("</script>") == 1,
        "catalogue_payload_present": html.count('"id":') >= 6_631,
        "evidence_ledger_present": "Evidence Ledger" in html,
    }
    failures = [name for name, passed in checks.items() if not passed]
    print(
        {
            "file": str(args.html),
            "bytes": args.html.stat().st_size,
            "checks": checks,
            "external_scripts": audit.external_scripts,
            "external_stylesheets": audit.external_stylesheets,
        }
    )
    if failures:
        raise SystemExit(f"Standalone verification failed: {', '.join(failures)}")


if __name__ == "__main__":
    main()
