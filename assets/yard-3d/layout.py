"""院子的 2D → 3D 换算。make_paths.py 和 build_yard.py 共用，网页端读生成的 layout.generated.ts。

iOS 场景坐标是归一化的（x、y ∈ 0–1，y 越大越靠近镜头）。3D 院子：单位米，Y 朝上，
+Z 朝镜头（和团子的"脸朝 +Z"一致），X 向右。

尺度：iOS 里团子身长 100.9pt、场景宽约 1266pt，整个院子约 12.5 个身长宽；团子 3D 身长 0.38 m，
照比例是 4.75 m，这里略放宽到 6 m，纵深把画面上 0.56–0.82 的落脚带拉开到约 3 m。
"""

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
SCENE_JSON = os.path.join(REPO, "assets", "scenes", "courtyard-v4", "scene.json")

WIDTH = 6.0        # 场景全宽（米）
DEPTH = 12.0       # 画面纵向 1.0 对应的纵深（米）；落脚带 0.26 → 约 3.1 m
CENTER_X = 0.535   # 主路横向中点
CENTER_Y = 0.70    # 落脚带纵向中线，落在世界 Z = 0

# 团子身长 0.38m（web/src/tuanzi/metrics.ts）。地面足迹取略大于半身长的 0.22m，
# 另留 0.04m 安全余量；路径校验时把两者膨胀进所有实体。
CAT_FOOTPRINT_RADIUS = 0.22
PATH_SAFETY_MARGIN = 0.04


def to_world(x, y):
    """归一化场景坐标 → (世界 X, 世界 Z)，保留三位小数。"""
    return round((x - CENTER_X) * WIDTH, 3), round((y - CENTER_Y) * DEPTH, 3)


def load_scene():
    with open(SCENE_JSON, encoding="utf-8") as f:
        return json.load(f)


# 物件落点（归一化场景坐标）。取自 scene.json 的物件矩形、障碍和接触点；
# 3D 里物件有了体积，落点取"底部中心"。高度单位米。
ANCHORS = {
    "house": (0.1575, 0.575),      # 蘑菇屋底部中心（前墙落在矩形下沿 0.6475 附近）；门朝 m0 节点
    "bowl": (0.206, 0.618),        # 水盆
    "mailbox": (0.068, 0.705),     # 信箱，门左前方；离屋子远一点，不挡蘑菇屋章节的机位
    "bed": (0.232, 0.777),         # 猫窝，就是 d2-0 节点
    "tree": (0.400, 0.650),        # 树干底部中心（障碍矩形 0.388–0.413）
    "nest": (0.3105, 0.662),       # 吊窝正下方的地面点
    "board": (0.430, 0.800),       # 木牌：主路前沿、草丛左侧，不挡草丛章节的机位
    "grass": (0.486, 0.758),       # 草丛中心
    "flower": (0.9495, 0.594),     # 栅栏边的小花
    "fence_from": (0.620, 0.565),  # 栅栏沿院子后沿，再在右端折向前
    "fence_corner": (0.992, 0.565),
    "fence_to": (0.992, 0.665),
}
NEST_PIVOT_HEIGHT = 1.22   # 吊绳挂点离地（nestPivot y 0.395 对地面 y 0.70）
NEST_SEAT_HEIGHT = 0.55    # 窝底离地（nestSupport y 0.5615）


def build_layout():
    scene = load_scene()
    nodes = {}
    for node in scene["nodes"]:
        x, z = to_world(node["point"]["x"], node["point"]["y"])
        nodes[node["id"]] = {"x": x, "z": z}
    edges = [{"a": e["a"], "b": e["b"], "main": bool(e.get("main"))} for e in scene["edges"]]
    destinations = [
        {"id": d["id"], "name": d["name"], "node": d["node"], "idle": d["idle"]}
        for d in scene["destinations"]
    ]
    pond = [dict(zip(("x", "z"), to_world(p["x"], p["y"]))) for p in scene["waterOutline"]]
    anchors = {k: dict(zip(("x", "z"), to_world(*v))) for k, v in ANCHORS.items()}

    # 2D 接触点在 3D 里有实体体积，以下节点只属于 3D，不回写 scene.json。
    # 床从右前侧接近并停在床前；树停在板根外；池塘退出石头边；栅栏退出灌木和木板。
    nodes["m7"] = {"x": -0.20, "z": 0.65}
    nodes["m14"] = {"x": 2.30, "z": -0.32}
    nodes["d2-side"] = {"x": -1.04, "z": 1.42}
    nodes["d2-0"] = {"x": -1.818, "z": 1.54}
    nodes["d4-0"] = {"x": 2.30, "z": 0.48}
    nodes["fence-contact"] = {"x": 2.25, "z": -1.14}
    removed_nodes = {"d1-1", "d1-2", "d3-0", "clearing", "bowl"}
    edges = [e for e in edges if not ({e["a"], e["b"]} == {"m3", "d2-0"}) and e["a"] not in removed_nodes and e["b"] not in removed_nodes]
    edges.extend([
        {"a": "m4", "b": "d2-side", "main": False},
        {"a": "d2-side", "b": "d2-0", "main": False},
        {"a": "m6", "b": "d3-1", "main": False},
    ])
    for destination in destinations:
        if destination["id"] == "tree":
            destination["node"] = "d1-0"

    colliders = [
        {"id": "house", "kind": "circle", **anchors["house"], "radius": 0.50},
        {"id": "mailbox", "kind": "circle", **anchors["mailbox"], "radius": 0.15},
        {"id": "bed", "kind": "circle", **anchors["bed"], "radius": 0.328},
        {"id": "tree", "kind": "circle", **anchors["tree"], "radius": 0.36},
        {"id": "board", "kind": "circle", **anchors["board"], "radius": 0.17},
        {"id": "pond-stones", "kind": "polygon", "points": pond, "radius": 0.15},
        {"id": "fence-back", "kind": "segment", "a": anchors["fence_from"], "b": anchors["fence_corner"], "radius": 0.17},
        {"id": "fence-side", "kind": "segment", "a": anchors["fence_corner"], "b": anchors["fence_to"], "radius": 0.17},
    ]
    return {
        "source": "assets/scenes/courtyard-v4/scene.json",
        "width": WIDTH,
        "nodes": nodes,
        "edges": edges,
        "destinations": destinations,
        "pond": pond,
        "anchors": anchors,
        "catFootprintRadius": CAT_FOOTPRINT_RADIUS,
        "pathSafetyMargin": PATH_SAFETY_MARGIN,
        "colliders": colliders,
        "nestPivotHeight": NEST_PIVOT_HEIGHT,
        "nestSeatHeight": NEST_SEAT_HEIGHT,
    }


# 2026-09-26 用户批准：扩大真实院内空间，保留远山与团子尺度；最新反馈另放大蘑菇屋与池塘。
# 旧换算仅用于取得已确认池塘轮廓与地点语义，生产端只导出这一版布局。
build_legacy_layout = build_layout


def build_layout():
    """第二次构图：左后蘑菇屋、右后大树、右前池塘；一条柔和环路连接生活区。"""
    import math
    old = build_legacy_layout()
    point = lambda x, z: {"x": round(x, 5), "z": round(z, 5)}
    anchors = {k: point(*v) for k, v in {
        "house": (-2.35, -1.80), "bowl": (-1.45, -1.25),
        "mailbox": (-3.60, -1.72), "tree": (.75, -1.80),
        "nest": (.213, -1.65), "bed": (-2.60, 1.35),
        "grass": (-.20, 1.85),
        "fence_from": (-3.75, -3.15), "fence_corner": (3.90, -3.15),
        "fence_to": (3.90, -.95), "flower": (2.80, -2.65),
        "bench": (-3.85, .25), "rocks": (3.85, 3.15),
        "flowerbed": (2.90, 3.32),
    }.items()}
    nodes = {k: point(*v) for k, v in {
        "m0": (-2.35, -.55), "m1": (-1.45, -.48), "lawn-center": (-.30, -.05),
        "pond-north": (2.20, -.90), "m14": (3.80, -.10), "m12": (3.96, 1.45),
        "m10": (3.15, 2.62), "d4-0": (2.55, 2.75), "m9": (1.42, 2.86),
        "m8": (-.20, 2.90), "lawn-south": (-.90, 2.85), "lawn-southwest": (-1.80, 2.67),
        "d2-0": (-2.60, 2.18), "bed-west": (-3.45, 1.44),
        "bench-front": (-2.74, .28), "d1-0": (.75, -.95),
        "d3-1": (-.20, 2.22), "fence-contact": (2.80, -2.20),
    }.items()}
    controls = [
        {"nodes": ["m0", "m1", "lawn-center", "pond-north", "m14", "m12", "m10", "d4-0", "m9", "m8", "lawn-south", "lawn-southwest", "d2-0", "bed-west", "bench-front", "m0"], "width": .28, "closed": True},
        {"nodes": ["lawn-center", "d1-0"], "width": .24},
        {"nodes": ["pond-north", "fence-contact"], "width": .24},
        {"nodes": ["m8", "d3-1"], "width": .24},
    ]
    # 三次 Hermite 曲线采样同时提供给路基、石块和导航，不留视觉曲线／导航直线分叉。
    paths = []
    for run_index, run in enumerate(controls):
        ids = run["nodes"]
        sampled = [ids[0]]
        for i, (a_id, b_id) in enumerate(zip(ids, ids[1:])):
            a, b = nodes[a_id], nodes[b_id]
            prev = nodes[ids[i-1] if i else ids[-2] if run.get("closed") else a_id]
            after = nodes[ids[i+2] if i+2<len(ids) else ids[1] if run.get("closed") else b_id]
            count = max(1, math.ceil(math.hypot(b["x"]-a["x"], b["z"]-a["z"])/.085))
            for j in range(1,count):
                t=j/count
                coords=[]
                for axis in ("x","z"):
                    ta=.36*(b[axis]-prev[axis]);tb=.36*(after[axis]-a[axis])
                    coords.append((2*t**3-3*t*t+1)*a[axis]+(t**3-2*t*t+t)*ta+(-2*t**3+3*t*t)*b[axis]+(t**3-t*t)*tb)
                ident=f"curve-{run_index}-{i}-{j}"
                nodes[ident]=point(*coords);sampled.append(ident)
            sampled.append(b_id)
        paths.append({"nodes": sampled,"width":run["width"]})
    edges = [{"a": a, "b": b, "main": index == 0}
             for index, run in enumerate(paths)
             for a, b in zip(run["nodes"], run["nodes"][1:])]
    cx=(min(p["x"] for p in old["pond"])+max(p["x"] for p in old["pond"]))/2
    cz=(min(p["z"] for p in old["pond"])+max(p["z"] for p in old["pond"]))/2
    pond = [point(2.0+(p["x"]-cx)*1.4, 1.0+(p["z"]-cz)*1.4) for p in old["pond"]]
    colliders = [{"id": name, "kind": "circle", **anchors[name], "radius": radius}
                 for name, radius in [("house", .675), ("mailbox", .15), ("bed", .328),
                                      ("tree", .36), ("bench", .57), ("rocks", .42)]]
    colliders += [
        {"id": "pond-stones", "kind": "polygon", "points": pond, "radius": .15},
        {"id": "fence-back", "kind": "segment", "a": anchors["fence_from"], "b": anchors["fence_corner"], "radius": .17},
        {"id": "fence-side", "kind": "segment", "a": anchors["fence_corner"], "b": anchors["fence_to"], "radius": .17},
    ]
    boundary = [point(*p) for p in [(-4.25,-3.6),(-.8,-3.6),(4.25,-3.6),(4.45,-1.4),
                (4.50,1.4),(4.2,3.65),(1.8,3.85),(-1.6,3.45),(-3.85,2.25),(-4.45,.1)]]
    return {**old, "version": "open-yard-v3", "width": 8.95, "nodes": nodes, "edges": edges,
            "anchors": anchors, "houseScale":1.35, "pondScale":1.4, "pond": pond, "colliders": colliders,
            "paths": paths, "pathControls":controls, "boundary": boundary,
            "stroll": ["m0", "lawn-center", "d1-0", "pond-north", "fence-contact", "m14",
                       "d4-0", "m8", "d3-1", "lawn-south", "d2-0", "bench-front", "m0"]}
