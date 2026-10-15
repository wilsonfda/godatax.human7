# -*- coding: utf-8 -*-
"""
Validate an intake JSON file produced by GDX_SKILL_NEW_STUDY against the
contract documented in intake_schema.json, before handing it to
GDX_SKILL_RECORD_NEW_STUDY.

Deliberately zero third-party dependencies (no `jsonschema` package): this is
a small, fixed shape, and hand-written checks let the error messages point
straight at the GDX_PSY_* column they correspond to.

Usage:
    python validate_intake.py <path/to/intake.json>

Exit code 0 and "OK" on stdout if valid; otherwise exit code 1 and every
problem found is printed (not just the first one).
"""
import json
import re
import sys

MAX_LEN = {
    "study.title": 200,
    "study.objective": 1000,
    "study.method": 1000,
    "instrument.name": 160,
    "instrument.version": 30,
    "instrument.type": 50,
    "instrument.description": 1000,
    "phenomenon_name": 120,
    "phenomenon_description": 1000,
    "construct.name": 120,
    "construct.domain": 60,
    "construct.definition": 1000,
    "variable.name": 150,
    "variable.description": 1000,
    "variable.operational_definition": 1000,
    "variable.variable_type": 40,
    "variable.measurement_level": 30,
    "indicator.name": 150,
    "indicator.description": 1000,
    "indicator.type": 30,
    "indicator.measurement_unit": 40,
    "indicator.direction": 15,
    "item.response_type": 30,
    "alternative.label": 300,
}

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
STATUS_VALUES = {"PLANNED", "ACTIVE", "COMPLETED", "CANCELLED"}
STUDY_TYPE_VALUES = {"PSYCHOMETRIC", "METAPHYSICOMETRIC"}


class Problems:
    def __init__(self):
        self.items = []

    def add(self, path, message):
        self.items.append(f"{path}: {message}")

    def check_len(self, path, value, key):
        if value is None:
            return
        limit = MAX_LEN[key]
        if len(str(value)) > limit:
            self.add(path, f"exceeds max length {limit} (got {len(str(value))}): {str(value)[:60]!r}...")

    def check_required(self, obj, path, *fields):
        for f in fields:
            if f not in obj or obj[f] in (None, ""):
                self.add(path, f"missing required field '{f}'")


def validate(data):
    p = Problems()

    if "study" not in data:
        p.add("$", "missing required top-level field 'study'")
    else:
        study = data["study"]
        p.check_required(study, "study", "title", "study_type")
        study_type = study.get("study_type")
        if study_type is not None and study_type not in STUDY_TYPE_VALUES:
            p.add("study.study_type", f"must be one of {sorted(STUDY_TYPE_VALUES)}, got {study_type!r}")
        p.check_len("study.title", study.get("title"), "study.title")
        p.check_len("study.objective", study.get("objective"), "study.objective")
        p.check_len("study.method", study.get("method"), "study.method")
        for f in ("start_date", "end_date"):
            v = study.get(f)
            if v is not None and not DATE_RE.match(str(v)):
                p.add(f"study.{f}", f"expected YYYY-MM-DD, got {v!r}")
        status = study.get("status", "PLANNED")
        if status not in STATUS_VALUES:
            p.add("study.status", f"must be one of {sorted(STATUS_VALUES)}, got {status!r}")

    instruments = data.get("instruments")
    if not instruments:
        p.add("$", "missing/empty required top-level field 'instruments'")
        return p

    for i, instr in enumerate(instruments):
        ipath = f"instruments[{i}]"
        p.check_required(instr, ipath, "name", "type", "phenomenon_name", "constructs", "variables", "items")
        p.check_len(f"{ipath}.name", instr.get("name"), "instrument.name")
        p.check_len(f"{ipath}.version", instr.get("version"), "instrument.version")
        p.check_len(f"{ipath}.type", instr.get("type"), "instrument.type")
        p.check_len(f"{ipath}.description", instr.get("description"), "instrument.description")
        p.check_len(f"{ipath}.phenomenon_name", instr.get("phenomenon_name"), "phenomenon_name")
        p.check_len(f"{ipath}.phenomenon_description", instr.get("phenomenon_description"), "phenomenon_description")

        construct_names = set()
        for j, c in enumerate(instr.get("constructs") or []):
            cpath = f"{ipath}.constructs[{j}]"
            p.check_required(c, cpath, "name", "definition")
            p.check_len(f"{cpath}.name", c.get("name"), "construct.name")
            p.check_len(f"{cpath}.domain", c.get("domain"), "construct.domain")
            p.check_len(f"{cpath}.definition", c.get("definition"), "construct.definition")
            if c.get("name"):
                if c["name"] in construct_names:
                    p.add(cpath, f"duplicate construct name within this instrument: {c['name']!r}")
                construct_names.add(c["name"])

        variable_names = set()
        for j, v in enumerate(instr.get("variables") or []):
            vpath = f"{ipath}.variables[{j}]"
            p.check_required(v, vpath, "construct_name", "name", "indicator_name")
            p.check_len(f"{vpath}.name", v.get("name"), "variable.name")
            p.check_len(f"{vpath}.description", v.get("description"), "variable.description")
            p.check_len(f"{vpath}.operational_definition", v.get("operational_definition"), "variable.operational_definition")
            p.check_len(f"{vpath}.variable_type", v.get("variable_type"), "variable.variable_type")
            p.check_len(f"{vpath}.measurement_level", v.get("measurement_level"), "variable.measurement_level")
            p.check_len(f"{vpath}.indicator_name", v.get("indicator_name"), "indicator.name")
            p.check_len(f"{vpath}.indicator_description", v.get("indicator_description"), "indicator.description")
            p.check_len(f"{vpath}.indicator_type", v.get("indicator_type"), "indicator.type")
            p.check_len(f"{vpath}.measurement_unit", v.get("measurement_unit"), "indicator.measurement_unit")
            p.check_len(f"{vpath}.direction", v.get("direction"), "indicator.direction")
            if v.get("construct_name") and v["construct_name"] not in construct_names:
                p.add(vpath, f"construct_name {v['construct_name']!r} does not match any constructs[].name in this instrument")
            if v.get("name"):
                if v["name"] in variable_names:
                    p.add(vpath, f"duplicate variable name within this instrument: {v['name']!r}")
                variable_names.add(v["name"])
            minv, maxv = v.get("min_value"), v.get("max_value")
            if minv is not None and maxv is not None and minv > maxv:
                p.add(vpath, f"min_value ({minv}) > max_value ({maxv})")

        anchor_sets = {}
        for j, a in enumerate(instr.get("response_anchor_sets") or []):
            apath = f"{ipath}.response_anchor_sets[{j}]"
            p.check_required(a, apath, "key", "alternatives")
            key = a.get("key")
            if key in anchor_sets:
                p.add(apath, f"duplicate anchor_set key: {key!r}")
            anchor_sets[key] = a
            orders_seen = set()
            for k, alt in enumerate(a.get("alternatives") or []):
                altpath = f"{apath}.alternatives[{k}]"
                p.check_required(alt, altpath, "order", "label", "numeric_value")
                p.check_len(f"{altpath}.label", alt.get("label"), "alternative.label")
                order = alt.get("order")
                if order in orders_seen:
                    p.add(altpath, f"duplicate alternative order {order} within anchor_set {key!r}")
                orders_seen.add(order)

        orders_seen = set()
        for j, item in enumerate(instr.get("items") or []):
            itpath = f"{ipath}.items[{j}]"
            p.check_required(item, itpath, "order", "statement_text", "response_type", "variable_name")
            p.check_len(f"{itpath}.response_type", item.get("response_type"), "item.response_type")
            order = item.get("order")
            if order in orders_seen:
                p.add(itpath, f"duplicate item order {order} within this instrument")
            orders_seen.add(order)

            anchor_set = item.get("anchor_set")
            if anchor_set is not None and anchor_set not in anchor_sets:
                p.add(itpath, f"anchor_set {anchor_set!r} does not match any response_anchor_sets[].key in this instrument")

            targets = [{"variable_name": item.get("variable_name"),
                        "reversed": item.get("reversed", 0)}] + list(item.get("extra_variables") or [])
            for t in targets:
                vn = t.get("variable_name")
                if vn and vn not in variable_names:
                    p.add(itpath, f"variable_name {vn!r} does not match any variables[].name in this instrument")
                if t.get("reversed") not in (0, 1, None):
                    p.add(itpath, f"reversed must be 0 or 1, got {t.get('reversed')!r}")

    return p


def main():
    if len(sys.argv) != 2:
        print("Usage: python validate_intake.py <path/to/intake.json>", file=sys.stderr)
        sys.exit(2)

    path = sys.argv[1]
    with open(path, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError as e:
            print(f"INVALID JSON: {e}")
            sys.exit(1)

    problems = validate(data)
    if problems.items:
        print(f"FOUND {len(problems.items)} PROBLEM(S) in {path}:")
        for msg in problems.items:
            print(f"  - {msg}")
        sys.exit(1)

    n_instr = len(data.get("instruments", []))
    n_items = sum(len(i.get("items", [])) for i in data.get("instruments", []))
    print(f"OK: {path} is valid ({n_instr} instrument(s), {n_items} item(s) total).")


if __name__ == "__main__":
    main()
