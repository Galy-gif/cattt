"""把 scene.json 的路网、目的地、池塘轮廓和物件落点换算成 3D 坐标，写给网页端。

用法（仓库根目录）：python3 assets/yard-3d/make_paths.py
产出：web/src/yard/layout.generated.ts（生成文件，不手改；要调落点改 layout.py）。
写成 .ts 而不是 .json，是为了不去动 web/tsconfig.json 的 resolveJsonModule。
"""

import json
import os

from layout import REPO, build_layout

OUT = os.path.join(REPO, "web", "src", "yard", "layout.generated.ts")

if __name__ == "__main__":
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    data = build_layout()
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("// 由 assets/yard-3d/make_paths.py 生成，不要手改。\n")
        f.write("export const LAYOUT = ")
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write(" as const;\n")
    print(f"{len(data['nodes'])} 个节点、{len(data['edges'])} 条边 → {os.path.relpath(OUT, REPO)}")
