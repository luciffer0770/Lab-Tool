"""Generate structured calibration learning experiments from parsed A2L data."""

from __future__ import annotations

from typing import Any, Dict, List, Optional


def _difficulty(n_signals: int) -> str:
    if n_signals <= 4:
        return "Beginner"
    if n_signals <= 12:
        return "Intermediate"
    return "Advanced"


def _char_by_name(chars: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    return {c["name"]: c for c in chars if c.get("name")}


def _meas_by_name(meas: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    return {m["name"]: m for m in meas if m.get("name")}


def build_experiments(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Build numbered experiments from FUNCTION blocks, CHARACTERISTIC, MEASUREMENT,
    GROUP membership, and protocol metadata present in the dataset.
    """
    MAX_EXP = 3000
    chars = data.get("characteristics") or []
    meas = data.get("measurements") or []
    funcs = data.get("functions") or []
    groups = data.get("groups") or []
    compu = data.get("compuMethods") or []
    axis = data.get("axisPoints") or []
    mem = data.get("memorySegments") or []
    meta = data.get("meta") or {}
    if_data = data.get("ifData") or []
    daq = data.get("daq") or []

    cmap = _char_by_name(chars)
    mmap = _meas_by_name(meas)

    experiments: List[Dict[str, Any]] = []
    n = 0

    def add_exp(payload: Dict[str, Any]) -> None:
        nonlocal n
        if len(experiments) >= MAX_EXP:
            return
        n += 1
        payload["id"] = n
        experiments.append(payload)

    ecu = meta.get("ecuName") or "ECU"

    # Per-function subsystem experiments (primary source)
    for fn in funcs:
        name = fn.get("name") or "UNNAMED_FUNCTION"
        desc = fn.get("description") or ""
        inputs = [x for x in fn.get("inputs") or [] if x]
        outputs = [x for x in fn.get("outputs") or [] if x]
        locals_ = [x for x in fn.get("localMeasurements") or [] if x]
        cals = [x for x in fn.get("calibrations") or [] if x]

        sig_inputs = [_signal_detail(mmap, x) for x in inputs]
        sig_outputs = [_signal_detail(mmap, x) for x in outputs]
        sig_locals = [_signal_detail(mmap, x) for x in locals_]
        sig_cals = [_cal_detail(cmap, x) for x in cals]

        n_sig = len(inputs) + len(outputs) + len(locals_) + len(cals)

        add_exp(
            {
                "title": f"Subsystem study: {name}",
                "subsystem": name,
                "difficulty": _difficulty(n_sig),
                "learningObjectives": [
                    f"Relate function {name} to listed ECU measurements and calibrations.",
                    "Identify signal flow from inputs to outputs for this subsystem.",
                    "Prepare an INCA workspace that traces these labels during a steady test.",
                ],
                "beginnerExplanation": (
                    f"This FUNCTION block groups related ECU logic for “{name}”. "
                    "Measurements are live values the ECU publishes; characteristics are tunable "
                    "parameters stored in memory. Observing them together shows how software "
                    "implements the physical control task."
                ),
                "engineeringPurpose": desc
                or "Documented ECU subsystem boundary for calibration and validation.",
                "whatToObserve": [
                    "Correlation between input measurements and output actuation demand.",
                    "Response time after calibration changes within this function scope.",
                    "Limiting or diagnostic behavior when measurements approach bounds.",
                ],
                "expectedEcuBehavior": (
                    "With consistent operating conditions, outputs should track control objectives "
                    "defined by internal algorithms and the referenced calibrations."
                ),
                "theory": _theory_sections(name, desc),
                "signals": {
                    "inputs": sig_inputs,
                    "outputs": sig_outputs,
                    "localMeasurements": sig_locals,
                    "calibrations": sig_cals,
                },
                "incaProcedure": _inca_procedure(ecu, name, inputs + outputs + locals_, cals),
                "observations": _observation_tables(inputs, outputs, mmap),
                "analysisQuestions": _analysis_questions(name, cals, inputs, outputs),
                "reportOutline": _report_outline(ecu, name, meta.get("projectName") or ""),
            }
        )

    # Per-characteristic tuning experiments
    for c in chars:
        cname = c.get("name")
        if not cname:
            continue
        related_fn = c.get("relatedFunction") or ""
        add_exp(
            {
                "title": f"Calibration trace: {cname}",
                "subsystem": related_fn or "Calibration",
                "difficulty": _difficulty(3),
                "learningObjectives": [
                    f"Interpret {cname} scaling and limits using the linked COMPU method.",
                    "Plan a safe single-parameter change with rollback strategy.",
                ],
                "beginnerExplanation": (
                    f"Characteristic “{cname}” is a stored calibration value. Changing it alters "
                    "ECU decisions that depend on this parameter. Always log before/after traces."
                ),
                "engineeringPurpose": c.get("description")
                or "Parameter identification and authority limits verification.",
                "whatToObserve": [
                    "Linked measurements before and after the change.",
                    "Guardrail activations if limits are approached.",
                ],
                "expectedEcuBehavior": "Controlled shift in dependent outputs when the parameter is active.",
                "theory": [
                    {
                        "title": "Calibration authority",
                        "body": "Characteristics define how control software maps stored intent to runtime behavior.",
                    }
                ],
                "signals": {
                    "inputs": [],
                    "outputs": [],
                    "localMeasurements": [],
                    "calibrations": [_cal_detail(cmap, cname)],
                },
                "incaProcedure": _inca_procedure(ecu, f"CAL:{cname}", [], [cname]),
                "observations": _observation_tables([], [], mmap),
                "analysisQuestions": [
                    f"Which measurements should move first when {cname} is perturbed stepwise?",
                    "How does the COMPU method shape perceived engineering units in the trace?",
                ],
                "reportOutline": _report_outline(ecu, f"Characteristic {cname}", meta.get("projectName") or ""),
            }
        )

    # Per-measurement acquisition experiments
    for m in meas:
        mname = m.get("name")
        if not mname:
            continue
        rel = m.get("relatedFunctions") or []
        subsystem = rel[0] if rel else "Measurements"
        add_exp(
            {
                "title": f"Signal acquisition: {mname}",
                "subsystem": subsystem,
                "difficulty": "Beginner",
                "learningObjectives": [
                    f"Configure DAQ raster suitable for bandwidth of {mname}.",
                    "Relate raw datatype and COMPU scaling to physical meaning.",
                ],
                "beginnerExplanation": (
                    f"Measurement “{mname}” is a live ECU signal. INCA displays it after XCP reads "
                    "the configured address with the correct datatype and scaling."
                ),
                "engineeringPurpose": m.get("description") or "Signal validation and bandwidth assessment.",
                "whatToObserve": [
                    "Noise floor and quantization steps at steady state.",
                    "Dynamic response during transients relevant to this signal.",
                ],
                "expectedEcuBehavior": "Signal remains within declared limits under nominal operation.",
                "theory": [
                    {
                        "title": "Sampling and aliasing",
                        "body": "Choose raster fast enough for dynamics; align DAQ lists with event timing.",
                    }
                ],
                "signals": {
                    "inputs": [],
                    "outputs": [_signal_detail(mmap, mname)],
                    "localMeasurements": [],
                    "calibrations": [],
                },
                "incaProcedure": _inca_procedure(ecu, f"MEAS:{mname}", [mname], []),
                "observations": _observation_tables([mname], [], mmap),
                "analysisQuestions": [
                    f"Which calibrations in related functions could explain drift in {mname}?",
                    "What COMPU method converts raw values to engineering units?",
                ],
                "reportOutline": _report_outline(ecu, f"Measurement {mname}", meta.get("projectName") or ""),
            }
        )

    # Group navigation experiment
    for g in groups:
        gname = g.get("name") or "GROUP"
        members = (g.get("members") or [])[:80]
        if not members:
            continue
        add_exp(
            {
                "title": f"Label group walkthrough: {gname}",
                "subsystem": "Groups",
                "difficulty": "Beginner",
                "learningObjectives": [
                    "Navigate hierarchical label organization used in calibration datasets.",
                    "Cross-link measurements and characteristics used together in validation.",
                ],
                "beginnerExplanation": "Groups bundle labels for repeatable experiment setup.",
                "engineeringPurpose": g.get("description") or "Structured reuse of label sets.",
                "whatToObserve": ["Coverage of critical signals for the test scenario."],
                "expectedEcuBehavior": "No runtime change; organizational clarity for the engineer.",
                "theory": [],
                "signals": {
                    "inputs": [],
                    "outputs": [_signal_detail(mmap, x) for x in members if x in mmap],
                    "localMeasurements": [],
                    "calibrations": [_cal_detail(cmap, x) for x in members if x in cmap],
                },
                "incaProcedure": _inca_procedure(ecu, f"GROUP:{gname}", members, []),
                "observations": [],
                "analysisQuestions": ["Are any safety-critical labels missing from this group?"],
                "reportOutline": _report_outline(ecu, f"Group {gname}", meta.get("projectName") or ""),
            }
        )

    # COMPU method interpretation
    for cm in compu[:400]:
        cm_name = cm.get("name")
        if not cm_name:
            continue
        add_exp(
            {
                "title": f"Scaling review: {cm_name}",
                "subsystem": "COMPU Methods",
                "difficulty": "Intermediate",
                "learningObjectives": [
                    "Read COMPU_METHOD structure and relate coefficients to physical units.",
                ],
                "beginnerExplanation": "COMPU methods translate raw memory values to engineering units.",
                "engineeringPurpose": "Verify correct interpretation of acquisition traces.",
                "whatToObserve": ["Linearity segments, breakpoints, and saturation handling."],
                "expectedEcuBehavior": "Consistent unit conversion across related labels.",
                "theory": [],
                "signals": {"inputs": [], "outputs": [], "localMeasurements": [], "calibrations": []},
                "incaProcedure": _inca_procedure(ecu, f"COMPU:{cm_name}", [], []),
                "observations": [],
                "analysisQuestions": [
                    "Which measurements reference this COMPU method in the A2L?",
                ],
                "reportOutline": _report_outline(ecu, f"COMPU {cm_name}", meta.get("projectName") or ""),
            }
        )

    # Axis points map experiments
    for ax in axis[:200]:
        axn = ax.get("name")
        if not axn:
            continue
        add_exp(
            {
                "title": f"Axis / map structure: {axn}",
                "subsystem": "Axis Points",
                "difficulty": "Intermediate",
                "learningObjectives": [
                    "Interpret breakpoints used by calibration maps.",
                ],
                "beginnerExplanation": "Axis definitions set breakpoints for tables and curves.",
                "engineeringPurpose": ax.get("description") or "Interpolation domain verification.",
                "whatToObserve": ["Monotonicity and coverage of operating range."],
                "expectedEcuBehavior": "Interpolation behaves predictably between breakpoints.",
                "theory": [],
                "signals": {"inputs": [], "outputs": [], "localMeasurements": [], "calibrations": []},
                "incaProcedure": _inca_procedure(ecu, f"AXIS:{axn}", [], []),
                "observations": [],
                "analysisQuestions": ["Do breakpoints align with physical actuator limits?"],
                "reportOutline": _report_outline(ecu, f"Axis {axn}", meta.get("projectName") or ""),
            }
        )

    # Memory layout audit
    for seg in mem[:120]:
        sn = seg.get("name")
        if not sn:
            continue
        add_exp(
            {
                "title": f"Memory segment audit: {sn}",
                "subsystem": "Memory",
                "difficulty": "Advanced",
                "learningObjectives": [
                    "Relate MEMORY_SEGMENT metadata to calibration flashing strategy.",
                ],
                "beginnerExplanation": "Segments classify address spaces such as flash or RAM pages.",
                "engineeringPurpose": seg.get("description") or "Address space planning.",
                "whatToObserve": ["Overlap risk and alignment constraints."],
                "expectedEcuBehavior": "Stable addressing for all labels mapped into the segment.",
                "theory": [],
                "signals": {"inputs": [], "outputs": [], "localMeasurements": [], "calibrations": []},
                "incaProcedure": _inca_procedure(ecu, f"MEM:{sn}", [], []),
                "observations": [],
                "analysisQuestions": ["Which calibrations declare this segment?"],
                "reportOutline": _report_outline(ecu, f"Memory {sn}", meta.get("projectName") or ""),
            }
        )

    # Protocol / IF_DATA lab
    for idx, row in enumerate(if_data[:40]):
        iname = row.get("name") or f"IF_DATA_{idx}"
        add_exp(
            {
                "title": f"Transport configuration review: {iname}",
                "subsystem": "XCP / Protocol",
                "difficulty": "Advanced",
                "learningObjectives": [
                    "Extract transport parameters required for a working measurement link.",
                ],
                "beginnerExplanation": "IF_DATA carries tool-specific protocol configuration embedded in the A2L.",
                "engineeringPurpose": "Align INCA / XCP settings with ECU expectations.",
                "whatToObserve": ["IDs, byte order, segment references, and DAQ mode hints."],
                "expectedEcuBehavior": "Successful connect and deterministic DAQ scheduling when matched.",
                "theory": [],
                "signals": {"inputs": [], "outputs": [], "localMeasurements": [], "calibrations": []},
                "incaProcedure": _inca_procedure(ecu, f"PROTO:{iname}", [], []),
                "observations": [],
                "analysisQuestions": ["Does the transport match the bench wiring and gateway setup?"],
                "reportOutline": _report_outline(ecu, f"Protocol {iname}", meta.get("projectName") or ""),
            }
        )

    # DAQ event experiments
    for d in daq[:80]:
        dn = d.get("name") or d.get("keyword") or "DAQ"
        add_exp(
            {
                "title": f"DAQ configuration study: {dn}",
                "subsystem": "DAQ",
                "difficulty": "Intermediate",
                "learningObjectives": [
                    "Understand event timing and list construction for high-rate signals.",
                ],
                "beginnerExplanation": "DAQ blocks describe acquisition lists and timing in the ECU.",
                "engineeringPurpose": "Optimize measurement load and avoid bus overload.",
                "whatToObserve": ["Raster alignment and event priorities."],
                "expectedEcuBehavior": "Stable acquisition without dropped counters on critical signals.",
                "theory": [],
                "signals": {"inputs": [], "outputs": [], "localMeasurements": [], "calibrations": []},
                "incaProcedure": _inca_procedure(ecu, f"DAQ:{dn}", [], []),
                "observations": [],
                "analysisQuestions": ["Which signals require fastest sampling in this event?"],
                "reportOutline": _report_outline(ecu, f"DAQ {dn}", meta.get("projectName") or ""),
            }
        )

    return experiments


def _theory_sections(fn_name: str, desc: str) -> List[Dict[str, str]]:
    return [
        {
            "title": "Control intent",
            "body": desc
            or f"The {fn_name} function encapsulates ECU software logic for a cohesive control task.",
        },
        {
            "title": "Signal flow",
            "body": "Inputs represent sensed or modeled state; outputs drive actuators or setpoints; "
            "local measurements capture internal controller state.",
        },
        {
            "title": "Calibration coupling",
            "body": "DEF_CHARACTERISTIC and REF_CHARACTERISTIC entries expose tunable degrees of freedom.",
        },
    ]


def _inca_procedure(
    ecu: str,
    focus: str,
    measurements: List[str],
    characteristics: List[str],
) -> List[str]:
    steps = [
        "Open the calibration toolchain workspace tied to this vehicle project.",
        "Import the ASAP2 / A2L dataset so label metadata matches the ECU software version.",
        f"Select ECU / variant context: {ecu}.",
        "Establish the XCP (or configured transport) link and verify seed/key or security steps if applicable.",
        "Confirm protocol settings (transport, timing, byte order) against IF_DATA guidance in the A2L.",
    ]
    if measurements:
        steps.append(
            "Add the experiment measurements to a DAQ group with an appropriate raster: "
            + ", ".join(measurements[:40])
            + (" …" if len(measurements) > 40 else "")
        )
    if characteristics:
        steps.append(
            "Add characteristics for short-stroke tuning with workspace backup: "
            + ", ".join(characteristics[:40])
            + (" …" if len(characteristics) > 40 else "")
        )
    steps.extend(
        [
            f"Name the experiment session: {focus} — baseline log.",
            "Run a repeatable operating point; capture MDF / log with timestamped notes.",
            "Apply a single, reversible change where appropriate; hold other variables steady.",
            "Compare overlays before/after for causal reasoning.",
            "Restore baseline parameters prior to shutdown if changes were exploratory.",
        ]
    )
    return steps


def _observation_tables(
    inputs: List[str],
    outputs: List[str],
    mmap: Dict[str, Dict[str, Any]],
) -> List[Dict[str, Any]]:
    rows = []
    for lab, names in (("Inputs", inputs), ("Outputs", outputs)):
        tbl = []
        for nm in names[:30]:
            m = mmap.get(nm, {})
            tbl.append(
                {
                    "signal": nm,
                    "unit": m.get("datatype") or "",
                    "range": f"{m.get('lowerLimit','')} … {m.get('upperLimit','')}",
                    "notes": m.get("description") or "",
                }
            )
        if tbl:
            rows.append({"title": f"Observation matrix — {lab}", "rows": tbl})
    return rows


def _analysis_questions(
    fn: str,
    cals: List[str],
    inputs: List[str],
    outputs: List[str],
) -> List[str]:
    qs = [
        f"What physical failure modes would first appear as anomalies in {fn}?",
        "Which signals are necessary vs sufficient to prove correct function behavior?",
    ]
    if cals:
        qs.append(f"How do calibrations {', '.join(cals[:8])} trade off performance and robustness?")
    if inputs and outputs:
        qs.append(
            f"Is the static gain from {inputs[0]} to {outputs[0]} consistent with subsystem intent?"
        )
    return qs


def _report_outline(ecu: str, topic: str, project: str) -> Dict[str, Any]:
    return {
        "institution": "National Institute of Technology Karnataka, Surathkal — Automotive Electronics Laboratory",
        "title": f"Technical note — {topic}",
        "project": project,
        "ecu": ecu,
        "sections": [
            "Title and authorship",
            "Objectives and safety precautions",
            "Instrumentation and ECU connection summary",
            "Procedure chronology with screenshots / log references",
            "Observations with tabulated signal evidence",
            "Analysis and causal reasoning",
            "Conclusions and recommended follow-up experiments",
        ],
    }


def _signal_detail(mmap: Dict[str, Dict[str, Any]], name: str) -> Dict[str, Any]:
    m = mmap.get(name, {})
    return {
        "name": name,
        "description": m.get("description") or "",
        "unit": m.get("datatype") or "",
        "range": f"{m.get('lowerLimit','')} … {m.get('upperLimit','')}",
        "address": m.get("ecuAddress") or "",
        "engineeringExplanation": "Live ECU signal acquired via the measurement definition.",
    }


def _cal_detail(cmap: Dict[str, Dict[str, Any]], name: str) -> Dict[str, Any]:
    c = cmap.get(name, {})
    return {
        "name": name,
        "description": c.get("description") or "",
        "unit": c.get("type") or "",
        "range": f"{c.get('lowerLimit','')} … {c.get('upperLimit','')}",
        "address": c.get("address") or "",
        "engineeringExplanation": "Tunable calibration parameter stored in ECU memory.",
    }
