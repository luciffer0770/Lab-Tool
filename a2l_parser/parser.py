"""
ASAP2 / A2L block parser.

Extracts structured engineering metadata without executing external tooling.
Designed for calibration workbenches and teaching workflows.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple


def _strip_comments(text: str) -> str:
    out: List[str] = []
    i = 0
    n = len(text)
    while i < n:
        if text.startswith("/*", i):
            j = text.find("*/", i + 2)
            if j == -1:
                break
            i = j + 2
            continue
        if text.startswith("//", i):
            j = text.find("\n", i)
            if j == -1:
                break
            i = j
            continue
        out.append(text[i])
        i += 1
    return "".join(out)


def _tokenize_lines(body: str) -> List[List[str]]:
    """Split body into logical lines; split quoted strings."""
    lines: List[List[str]] = []
    for raw in body.splitlines():
        line = raw.strip()
        if not line:
            continue
        parts: List[str] = []
        buf: List[str] = []
        in_quote = False
        escape = False
        for ch in line:
            if escape:
                buf.append(ch)
                escape = False
                continue
            if ch == "\\" and in_quote:
                escape = True
                buf.append(ch)
                continue
            if ch == '"':
                in_quote = not in_quote
                buf.append(ch)
                continue
            if ch.isspace() and not in_quote:
                if buf:
                    parts.append("".join(buf))
                    buf = []
                continue
            buf.append(ch)
        if buf:
            parts.append("".join(buf))
        if parts:
            lines.append(parts)
    return lines


def _unquote(s: str) -> str:
    s = s.strip()
    if len(s) >= 2 and s[0] == '"' and s[-1] == '"':
        return s[1:-1].replace('\\"', '"')
    return s


def _parse_block_tree(content: str) -> Tuple[List[Dict[str, Any]], List[str]]:
    """Parse /begin ... /end hierarchy from ASAP2 text."""
    text = _strip_comments(content)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    return _parse_block_tree_v2(text)


def _parse_block_tree_v2(text: str) -> Tuple[List[Dict[str, Any]], List[str]]:
    diagnostics: List[str] = []
    roots: List[Dict[str, Any]] = []
    stack: List[Dict[str, Any]] = []
    i = 0
    n = len(text)
    begin_re = re.compile(r"/begin\s+(\w+)\s*", re.IGNORECASE)
    end_re = re.compile(r"/end\s+(\w+)\s*", re.IGNORECASE)

    while i < n:
        mb = begin_re.search(text, i)
        me = end_re.search(text, i)
        if not mb and not me:
            break
        if mb and (not me or mb.start() < me.start()):
            kw = mb.group(1).upper()
            pos = mb.end()
            name = ""
            mname = re.match(r'(\w+|"[^"]*")\s*', text[pos:])
            if mname:
                name = _unquote(mname.group(1))
                pos += mname.end()
            node = {
                "keyword": kw,
                "name": name,
                "body": "",
                "children": [],
                "_body_start": pos,
            }
            if stack:
                stack[-1]["children"].append(node)
            else:
                roots.append(node)
            stack.append(node)
            i = pos
            continue
        if me:
            kw = me.group(1).upper()
            if not stack:
                diagnostics.append(f"/end {kw} without /begin")
                i = me.end()
                continue
            node = stack.pop()
            body = text[node["_body_start"] : me.start()]
            node["body"] = body.strip()
            del node["_body_start"]
            i = me.end()
            continue
        break

    if stack:
        for n in stack:
            diagnostics.append(f"Unclosed block {n.get('keyword')}")
    return roots, diagnostics


def _lines(body: str) -> List[List[str]]:
    return _tokenize_lines(body)


def _find_project_module(roots: List[Dict[str, Any]]) -> Tuple[Optional[Dict], Optional[Dict]]:
    project = None
    module = None
    for r in roots:
        if r["keyword"] == "PROJECT":
            project = r
            for c in r.get("children", []):
                if c["keyword"] == "MODULE":
                    module = c
                    break
            break
    if module is None:
        for r in roots:
            if r["keyword"] == "MODULE":
                module = r
                break
    return project, module


def _child_blocks(node: Optional[Dict[str, Any]], keyword: str) -> List[Dict[str, Any]]:
    if not node:
        return []
    return [c for c in node.get("children", []) if c["keyword"] == keyword.upper()]


def _collect_descendants(node: Optional[Dict[str, Any]], keyword: str) -> List[Dict[str, Any]]:
    """Collect all descendant blocks of a type (handles GROUP nesting)."""
    if not node:
        return []
    found: List[Dict[str, Any]] = []
    for c in node.get("children", []):
        if c["keyword"] == keyword.upper():
            found.append(c)
        found.extend(_collect_descendants(c, keyword))
    return found


def _dedupe_blocks_by_name(blocks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen: set = set()
    out: List[Dict[str, Any]] = []
    for b in blocks:
        n = b.get("name")
        if not n or n in seen:
            continue
        seen.add(n)
        out.append(b)
    return out


def _parse_measurement_block(b: Dict[str, Any]) -> Dict[str, Any]:
    lines = _lines(b["body"])
    datatype = ""
    ecu_address = ""
    compu_method = ""
    resolution = ""
    accuracy = ""
    lower = ""
    upper = ""
    desc = ""
    for parts in lines:
        if not parts:
            continue
        tag = parts[0].upper()
        if tag == "ECU_ADDRESS":
            ecu_address = " ".join(parts[1:])
        elif tag == "DATATYPE":
            datatype = parts[1] if len(parts) > 1 else ""
        elif tag == "COMPU_METHOD":
            compu_method = parts[1] if len(parts) > 1 else ""
        elif tag == "RESOLUTION":
            resolution = " ".join(parts[1:])
        elif tag == "ACCURACY":
            accuracy = " ".join(parts[1:])
        elif tag == "LOWER_LIMIT":
            lower = " ".join(parts[1:])
        elif tag == "UPPER_LIMIT":
            upper = " ".join(parts[1:])
        elif tag == "DESCRIPTION":
            desc = _unquote(" ".join(parts[1:])) if len(parts) > 1 else ""
    return {
        "name": b["name"],
        "description": desc,
        "datatype": datatype,
        "ecuAddress": ecu_address,
        "compuMethod": compu_method,
        "resolution": resolution,
        "accuracy": accuracy,
        "lowerLimit": lower,
        "upperLimit": upper,
        "scalingFormula": "",
        "daqEvent": "",
        "relatedFunctions": [],
    }


def _parse_characteristic_block(b: Dict[str, Any]) -> Dict[str, Any]:
    lines = _lines(b["body"])
    desc = ""
    address = ""
    fmt = ""
    width = ""
    compu = ""
    lower = ""
    upper = ""
    related_fn = ""
    record_layout = ""
    memory_segment = ""
    for parts in lines:
        if not parts:
            continue
        tag = parts[0].upper()
        if tag == "DESCRIPTION":
            desc = _unquote(" ".join(parts[1:])) if len(parts) > 1 else ""
        elif tag == "ECU_ADDRESS":
            address = " ".join(parts[1:])
        elif tag == "FORMAT":
            fmt = parts[1] if len(parts) > 1 else ""
        elif tag == "NUMBER":
            width = parts[1] if len(parts) > 1 else ""
        elif tag == "COMPU_METHOD":
            compu = parts[1] if len(parts) > 1 else ""
        elif tag == "LOWER_LIMIT":
            lower = " ".join(parts[1:])
        elif tag == "UPPER_LIMIT":
            upper = " ".join(parts[1:])
        elif tag == "FUNCTION":
            related_fn = parts[1] if len(parts) > 1 else ""
        elif tag == "RECORD_LAYOUT":
            record_layout = parts[1] if len(parts) > 1 else ""
        elif tag == "MEMORY_SEGMENT":
            memory_segment = parts[1] if len(parts) > 1 else ""
    type_str = fmt or width or "VALUE"
    return {
        "name": b["name"],
        "description": desc,
        "address": address,
        "type": type_str,
        "unit": "",
        "lowerLimit": lower,
        "upperLimit": upper,
        "compuMethod": compu,
        "memorySegment": memory_segment,
        "relatedFunction": related_fn,
        "recordLayout": record_layout,
    }


def _parse_function_block(b: Dict[str, Any]) -> Dict[str, Any]:
    lines = _lines(b["body"])
    desc = ""
    in_meas: List[str] = []
    out_meas: List[str] = []
    loc_meas: List[str] = []
    def_meas: List[str] = []
    refs: List[str] = []
    for parts in lines:
        if not parts:
            continue
        tag = parts[0].upper()
        if tag == "DESCRIPTION":
            desc = _unquote(" ".join(parts[1:])) if len(parts) > 1 else ""
        elif tag == "IN_MEASUREMENT":
            in_meas.append(parts[1] if len(parts) > 1 else "")
        elif tag == "OUT_MEASUREMENT":
            out_meas.append(parts[1] if len(parts) > 1 else "")
        elif tag == "LOC_MEASUREMENT":
            loc_meas.append(parts[1] if len(parts) > 1 else "")
        elif tag == "DEF_CHARACTERISTIC":
            if len(parts) > 1:
                def_meas.extend([p for p in parts[1:] if p])
        elif tag == "REF_CHARACTERISTIC":
            refs.append(parts[1] if len(parts) > 1 else "")
    return {
        "name": b["name"],
        "description": desc,
        "inputs": in_meas,
        "outputs": out_meas,
        "localMeasurements": loc_meas,
        "calibrations": def_meas + refs,
    }


def _parse_group_block(b: Dict[str, Any]) -> Dict[str, Any]:
    lines = _lines(b["body"])
    desc = ""
    members: List[str] = []
    subgroups: List[str] = []
    root_name = b["name"]
    for parts in lines:
        if not parts:
            continue
        tag = parts[0].upper()
        if tag == "DESCRIPTION":
            desc = _unquote(" ".join(parts[1:])) if len(parts) > 1 else ""
        elif tag == "SUB_GROUP":
            subgroups.append(parts[1] if len(parts) > 1 else "")
        elif tag == "REF_MEASUREMENT":
            members.append(parts[1] if len(parts) > 1 else "")
        elif tag == "REF_CHARACTERISTIC":
            members.append(parts[1] if len(parts) > 1 else "")
    return {
        "name": root_name,
        "description": desc,
        "subgroups": subgroups,
        "members": members,
    }


def _parse_compu_method(b: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "name": b["name"],
        "description": "",
        "rawBody": b.get("body", "")[:4000],
    }


def _parse_axis_pts(b: Dict[str, Any]) -> Dict[str, Any]:
    lines = _lines(b["body"])
    desc = ""
    values: List[str] = []
    for parts in lines:
        if not parts:
            continue
        tag = parts[0].upper()
        if tag == "DESCRIPTION":
            desc = _unquote(" ".join(parts[1:])) if len(parts) > 1 else ""
        elif tag == "AXIS_PTS_REF" or tag == "FIX_AXIS_PAR_DIST" or tag == "STD_AXIS":
            values.append(" ".join(parts[1:]))
    return {"name": b["name"], "description": desc, "details": values}


def _parse_memory_segment(b: Dict[str, Any]) -> Dict[str, Any]:
    lines = _lines(b["body"])
    desc = ""
    addr_type = ""
    for parts in lines:
        if not parts:
            continue
        tag = parts[0].upper()
        if tag == "DESCRIPTION":
            desc = _unquote(" ".join(parts[1:])) if len(parts) > 1 else ""
        elif tag == "ADDRESS_TYPE" or tag == "PRG_TYPE":
            addr_type = " ".join(parts[1:])
    return {"name": b["name"], "description": desc, "addressType": addr_type}


def _flatten_if_data(module: Optional[Dict[str, Any]]) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []

    def walk(node: Optional[Dict[str, Any]]) -> None:
        if not node:
            return
        for c in node.get("children", []):
            if c["keyword"] == "IF_DATA":
                rows.append(
                    {
                        "name": c["name"],
                        "content": c.get("body", "")[:8000],
                    }
                )
            walk(c)

    walk(module)
    return rows


def _build_explorer_tree(roots: List[Dict[str, Any]], limit: int = 5000) -> List[Dict[str, Any]]:
    def conv(node: Dict[str, Any], depth: int) -> Dict[str, Any]:
        return {
            "id": f"{node['keyword']}:{node.get('name','')}:{depth}",
            "label": node["name"] or node["keyword"],
            "keyword": node["keyword"],
            "children": [conv(ch, depth + 1) for ch in node.get("children", [])[:200]],
        }

    out = [conv(r, 0) for r in roots[:limit]]
    return out


def _diagnostics_with_levels(messages: List[str]) -> List[Dict[str, str]]:
    out: List[Dict[str, str]] = []
    for m in messages:
        level = "info"
        ml = m.lower()
        if "mismatch" in ml or "without" in ml or "unclosed" in ml:
            level = "warning"
        if "duplicate" in ml:
            level = "warning"
        out.append({"level": level, "message": m})
    return out


def parse_a2l_text(content: str) -> Dict[str, Any]:
    roots, diag = _parse_block_tree(content)
    # Remove dead code path - _parse_block_tree now delegates to v2
    project, module = _find_project_module(roots)

    project_name = project["name"] if project else ""
    module_name = module["name"] if module else ""
    asap2_version = ""
    if project:
        for parts in _lines(project["body"]):
            if parts and parts[0].upper() == "VERSION":
                asap2_version = _unquote(" ".join(parts[1:])) if len(parts) > 1 else ""

    chars = [
        _parse_characteristic_block(b)
        for b in _dedupe_blocks_by_name(_collect_descendants(module, "CHARACTERISTIC"))
    ]
    meas = [
        _parse_measurement_block(b)
        for b in _dedupe_blocks_by_name(_collect_descendants(module, "MEASUREMENT"))
    ]
    funcs = [
        _parse_function_block(b) for b in _dedupe_blocks_by_name(_collect_descendants(module, "FUNCTION"))
    ]
    groups = [_parse_group_block(b) for b in _dedupe_blocks_by_name(_collect_descendants(module, "GROUP"))]
    compu = [_parse_compu_method(b) for b in _dedupe_blocks_by_name(_collect_descendants(module, "COMPU_METHOD"))]
    axis = [_parse_axis_pts(b) for b in _dedupe_blocks_by_name(_collect_descendants(module, "AXIS_PTS"))]
    mem = [
        _parse_memory_segment(b)
        for b in _dedupe_blocks_by_name(_collect_descendants(module, "MEMORY_SEGMENT"))
    ]

    diag_msgs = list(diag)
    for label, raw_list, deduped in (
        ("CHARACTERISTIC", _collect_descendants(module, "CHARACTERISTIC"), chars),
        ("MEASUREMENT", _collect_descendants(module, "MEASUREMENT"), meas),
        ("FUNCTION", _collect_descendants(module, "FUNCTION"), funcs),
    ):
        if len(raw_list) > len(deduped):
            diag_msgs.append(
                f"Duplicate {label} block names collapsed: {len(raw_list)} definitions -> {len(deduped)} unique"
            )

    # Link measurements to functions
    for m in meas:
        related = []
        for f in funcs:
            if m["name"] in f["inputs"] or m["name"] in f["outputs"] or m["name"] in f["localMeasurements"]:
                related.append(f["name"])
        m["relatedFunctions"] = related

    if_data = _flatten_if_data(module)
    daq_blocks: List[Dict[str, Any]] = []

    def walk_daq(node: Optional[Dict[str, Any]]) -> None:
        if not node:
            return
        for c in node.get("children", []):
            if c["keyword"] in ("DAQ_EVENT", "DAQ", "DAQ_CONFIG"):
                daq_blocks.append(
                    {
                        "keyword": c["keyword"],
                        "name": c["name"],
                        "preview": c.get("body", "")[:2000],
                    }
                )
            walk_daq(c)

    walk_daq(module)

    labels_count = (
        len(chars) + len(meas) + len(funcs) + len(groups) + len(compu) + len(axis) + len(mem)
    )

    return {
        "meta": {
            "ecuName": module_name or project_name or "Unknown ECU",
            "projectName": project_name or "Calibration Project",
            "asap2Version": asap2_version or "unknown",
            "moduleName": module_name,
        },
        "counts": {
            "characteristics": len(chars),
            "measurements": len(meas),
            "functions": len(funcs),
            "groups": len(groups),
            "compuMethods": len(compu),
            "axisPoints": len(axis),
            "memorySegments": len(mem),
            "daqEvents": len(daq_blocks),
            "labels": labels_count,
        },
        "characteristics": chars,
        "measurements": meas,
        "functions": funcs,
        "groups": groups,
        "compuMethods": compu,
        "axisPoints": axis,
        "memorySegments": mem,
        "ifData": if_data,
        "daq": daq_blocks,
        "explorerTree": _build_explorer_tree(roots),
        "diagnostics": _diagnostics_with_levels(diag_msgs[:80]),
        "rawPreview": content[:120000],
    }
