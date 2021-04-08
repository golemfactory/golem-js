"""Prepare documentation for Yagna Handbook"""

import argparse
import markdown
import os
import shutil
import sys

from collections import OrderedDict
from pathlib import Path
from mako import template as mako_template


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def get_md_files(md_root):
    root = md_root
    return sorted(
        [
            (
                dirname,
                sorted([f for f in files if f.endswith(".md")]),
            )
            for dirname, _, files in os.walk(root)
        ]
    )


def get_module_title(file_path):
    with open(file_path, "r", encoding="utf-8") as md_file:
        text = md_file.read()

    md = markdown.Markdown()

    lines = text.split("\n")
    etree = md.parser.parseDocument(lines)
    root = etree.getroot()

    h1 = root.find(f"./h1")
    return h1.text if h1 is not None else ""


class SummaryNode:
    def __init__(self, name: str = None, filepath: str = None):
        self.name = name
        self.filepath = filepath
        self.children = OrderedDict()

    def __str__(self):
        children = ", ".join([str(v) for k, v in self.children.items()])
        return f"<name={self.name}, filepath={self.filepath}, " f"children=[{children}]>"


def build_reference(root_node, md_root, summary_prefix):
    def process_file(dirname, filename):
        file_path = Path(dirname) / filename
        title = get_module_title(file_path)
        module_path = title.split(".")

        summary_node = root_node
        for segment in module_path:
            summary_node = summary_node.children.setdefault(segment, SummaryNode())

        summary_node.name = title
        relative_path = str(Path(dirname).relative_to(md_root) / filename)
        summary_node.filepath = f"{summary_prefix}/{relative_path}"

    for dirname, files in get_md_files(md_root):
        for filename in files:
            process_file(dirname, filename)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Prepare Markdown docs")
    parser.add_argument("--handbook-dir")
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--summary-prefix", default="yajsapi")
    parser.add_argument("--summary-file")
    parser.add_argument("--summary-stdout", action="store_true")

    args = parser.parse_args()

    handbook_root = Path(args.handbook_dir) if args.handbook_dir else PROJECT_ROOT / "handbook"

    summary_file = args.summary_file or handbook_root / ".SUMMARY.md"

    if handbook_root.exists():
        if args.overwrite:
            shutil.rmtree(handbook_root)
        else:
            raise Exception(f"Target directory {handbook_root} exists. Use explicit --overwrite.")

    md_root = PROJECT_ROOT / "docs"

    shutil.copytree(md_root, handbook_root)

    summary_template = Path(__file__).parent / "templates/summary.mako"

    summary = SummaryNode()

    reference_node = summary.children.setdefault("reference", SummaryNode())
    reference_node.name = "API Reference"
    build_reference(reference_node, md_root, args.summary_prefix)

    def write_template(stream):
        stream.write(mako_template.Template(filename=str(summary_template)).render(summary=summary))

    if args.summary_stdout:
        write_template(sys.stdout)
        sys.stdout.write("\n")
    else:
        with open(summary_file, "w") as f:
            write_template(f)
