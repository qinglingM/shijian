"""Convert .docx files in workspace to clean markdown in docs/.

Heuristic table reconstruction:
- python-docx isn't installed; we parse the raw OOXML.
- We walk paragraphs and tables in document order.
- Lists / headings are detected by Word style names where possible.
"""

import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
}


def text_of(el):
    """Concatenate all w:t descendants and respect w:br / w:tab."""
    parts = []
    for node in el.iter():
        tag = node.tag.split("}", 1)[-1]
        if tag == "t":
            parts.append(node.text or "")
        elif tag == "tab":
            parts.append("\t")
        elif tag == "br":
            parts.append("\n")
    return "".join(parts)


def paragraph_style(p):
    pPr = p.find("w:pPr", NS)
    if pPr is None:
        return None
    pStyle = pPr.find("w:pStyle", NS)
    if pStyle is None:
        return None
    return pStyle.get("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val")


HEADING_RE = re.compile(r"^Heading(\d+)$", re.I)


def render_paragraph(p):
    txt = text_of(p).strip()
    if not txt:
        return ""
    style = paragraph_style(p) or ""
    m = HEADING_RE.match(style)
    if m:
        level = min(int(m.group(1)), 6)
        return f"{'#' * level} {txt}"
    # Manual heading heuristic: looks like "1. xxx" or "1.1 xxx"
    if re.match(r"^\d+(\.\d+)*\s+\S", txt) and len(txt) < 80:
        depth = txt.split(" ", 1)[0].count(".")
        return f"{'#' * (depth + 2)} {txt}"
    return txt


def render_table(tbl):
    rows = []
    for tr in tbl.findall("w:tr", NS):
        cells = []
        for tc in tr.findall("w:tc", NS):
            cell_text = " ".join(
                text_of(p).strip() for p in tc.findall("w:p", NS)
            ).strip()
            cells.append(cell_text.replace("|", "\\|").replace("\n", " "))
        rows.append(cells)
    if not rows:
        return ""
    width = max(len(r) for r in rows)
    rows = [r + [""] * (width - len(r)) for r in rows]
    header = rows[0]
    sep = ["---"] * width
    md = ["| " + " | ".join(header) + " |", "| " + " | ".join(sep) + " |"]
    for r in rows[1:]:
        md.append("| " + " | ".join(r) + " |")
    return "\n".join(md)


def convert(docx_path: Path) -> str:
    with zipfile.ZipFile(docx_path, "r") as z:
        xml = z.read("word/document.xml")
    root = ET.fromstring(xml)
    body = root.find("w:body", NS)
    out = []
    for child in body:
        tag = child.tag.split("}", 1)[-1]
        if tag == "p":
            line = render_paragraph(child)
            if line:
                out.append(line)
        elif tag == "tbl":
            md = render_table(child)
            if md:
                out.append(md)
    md = "\n\n".join(out)
    md = re.sub(r"\n{3,}", "\n\n", md)
    return md


def main():
    root = Path(__file__).resolve().parents[1]
    docs_dir = root / "docs"
    docs_dir.mkdir(exist_ok=True)
    targets = {
        "食鉴p0开发定版说明书.docx": "product-spec.md",
        "食鉴p0 Supabase后端数据库定版说明书.docx": "database-spec.md",
    }
    for src, dst in targets.items():
        src_path = root / src
        if not src_path.exists():
            print(f"SKIP (missing): {src}")
            continue
        md = convert(src_path)
        title = src.replace(".docx", "")
        header = f"# {title}\n\n> 本文档由 `{src}` 自动转换而来，请以原 docx 为准。\n\n"
        (docs_dir / dst).write_text(header + md + "\n", encoding="utf-8")
        print(f"WROTE: docs/{dst}  ({len(md)} chars)")


if __name__ == "__main__":
    main()
