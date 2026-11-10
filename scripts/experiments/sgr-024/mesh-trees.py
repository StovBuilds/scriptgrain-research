#!/usr/bin/env python3
"""SGR-024: build the MeSH descriptor -> tree-number table used to give each journal a subject group.

  python3 -I scripts/experiments/sgr-024/mesh-trees.py ~/research/sgr-024/ref/desc2026.gz ~/research/sgr-024/ref/mesh-trees.tsv

desc2026.gz is NLM's MeSH 2026 descriptor file (public domain), downloaded from
https://nlmpubs.nlm.nih.gov/projects/mesh/MESH_FILES/xmlmesh/desc2026.gz. Output: one line per descriptor,
"name<TAB>tree,tree,...". Already run for the data snapshot; not part of the D-1 run.
"""
import gzip, sys, xml.etree.ElementTree as ET
src, dst = sys.argv[1], sys.argv[2]
n = 0
with gzip.open(src, "rb") as f, open(dst, "w", encoding="utf-8") as out:
    for _, el in ET.iterparse(f, events=("end",)):
        if el.tag != "DescriptorRecord":
            continue
        name = el.findtext("DescriptorName/String")
        trees = [t.text for t in el.findall("TreeNumberList/TreeNumber")]
        if name and trees:
            out.write(name + "\t" + ",".join(trees) + "\n"); n += 1
        el.clear()
print(n, "descriptors with tree numbers")
