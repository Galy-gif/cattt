"""把 scene.json 的路网、目的地、池塘轮廓和物件落点换算成 3D 坐标，写给网页端。

用法（仓库根目录）：python3 assets/yard-3d/make_paths.py
产出：web/src/yard/layout.generated.ts（生成文件，不手改；要调落点改 layout.py）。
写成 .ts 而不是 .json，是为了不去动 web/tsconfig.json 的 resolveJsonModule。
"""

import json
import math
import os

from layout import REPO, build_layout

OUT = os.path.join(REPO, "web", "src", "yard", "layout.generated.ts")


def segment_distance(point, a, b):
    dx, dz = b["x"] - a["x"], b["z"] - a["z"]
    length2 = dx * dx + dz * dz
    t = 0 if length2 == 0 else max(0, min(1, ((point["x"] - a["x"]) * dx + (point["z"] - a["z"]) * dz) / length2))
    return math.hypot(point["x"] - (a["x"] + dx * t), point["z"] - (a["z"] + dz * t))


def inside_polygon(point, polygon):
    inside = False
    j = len(polygon) - 1
    for i, a in enumerate(polygon):
        b = polygon[j]
        crosses = (a["z"] > point["z"]) != (b["z"] > point["z"])
        if crosses and point["x"] < (b["x"] - a["x"]) * (point["z"] - a["z"]) / (b["z"] - a["z"]) + a["x"]:
            inside = not inside
        j = i
    return inside


def clearance(point, collider, footprint, margin):
    if collider["kind"] == "circle":
        distance = math.hypot(point["x"] - collider["x"], point["z"] - collider["z"])
    elif collider["kind"] == "segment":
        distance = segment_distance(point, collider["a"], collider["b"])
    else:
        polygon = collider["points"]
        distance = min(segment_distance(point, polygon[i], polygon[(i + 1) % len(polygon)]) for i in range(len(polygon)))
        if inside_polygon(point, polygon):
            distance = -distance
    return distance - collider["radius"] - footprint - margin


def validate(data, sample_step=0.05):
    failures = []
    footprint, margin = data["catFootprintRadius"], data["pathSafetyMargin"]
    for edge in data["edges"]:
        a, b = data["nodes"][edge["a"]], data["nodes"][edge["b"]]
        samples = max(1, math.ceil(math.hypot(b["x"] - a["x"], b["z"] - a["z"]) / sample_step))
        for index in range(samples + 1):
            t = index / samples
            point = {"x": a["x"] + (b["x"] - a["x"]) * t, "z": a["z"] + (b["z"] - a["z"]) * t}
            for collider in data["colliders"]:
                gap = clearance(point, collider, footprint, margin)
                if gap < 0:
                    failures.append(f"{edge['a']}→{edge['b']} 与 {collider['id']} 净距 {gap:.3f}m")
                    break
            if failures and failures[-1].startswith(f"{edge['a']}→{edge['b']}"):
                break
    if failures:
        raise SystemExit("3D 路网净距校验失败：\n- " + "\n- ".join(failures))

if __name__ == "__main__":
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    data = build_layout()
    validate(data)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("// 由 assets/yard-3d/make_paths.py 生成，不要手改。\n")
        f.write("export const LAYOUT = ")
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write(" as const;\n")
    print(f"{len(data['nodes'])} 个节点、{len(data['edges'])} 条边 → {os.path.relpath(OUT, REPO)}")
