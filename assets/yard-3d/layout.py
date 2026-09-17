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
    return {
        "source": "assets/scenes/courtyard-v4/scene.json",
        "width": WIDTH,
        "nodes": nodes,
        "edges": edges,
        "destinations": destinations,
        "pond": pond,
        "anchors": anchors,
        "nestPivotHeight": NEST_PIVOT_HEIGHT,
        "nestSeatHeight": NEST_SEAT_HEIGHT,
    }
