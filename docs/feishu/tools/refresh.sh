#!/bin/bash
# 重新从飞书拉取三份文档并转成 Markdown。依赖 lark-cli（已授权 user 身份）。
# 用法：bash tools/refresh.sh   （在 docs/feishu 目录下执行）
set -e
cd "$(dirname "$0")/.."
OUT="$(pwd)"
WORK="$(mktemp -d /tmp/feishu-refresh.XXXX)"; cd "$WORK"
fetch(){ lark-cli docs +fetch --doc "$2" --doc-format xml --detail with-ids > "$1.xml.json"; }
fetch panorama N0urdST5LojCWMxe5NycAKjInlg
fetch mech     KODZdLGbUoobNMxHNXccxV2FnFd
fetch prd      https://my.feishu.cn/wiki/NSwzwJlf6iABKSklAQ8cA0WGnWb
# 图片：lark-cli 只允许写到 cwd、/tmp 或 ~/files，所以先下到 $WORK 再复制
python3 - <<'PY'
import json,re,os
for name,sub in [('panorama','panorama'),('mech','mech'),('prd','prd')]:
    x=json.load(open(f'{name}.xml.json'))['data']['document']['content']
    m={};lines=[]
    for i,t in enumerate(re.findall(r'<img[^>]*/>',x),1):
        src=re.search(r'src="([^"]+)"',t).group(1); nm=re.search(r'name="([^"]+)"',t); nm=(nm.group(1) if nm else src+'.png').replace('/','_')
        m[src]=f'assets/{sub}/{i:02d}-{nm}'; lines.append(f'{src}\t{os.getcwd()}/dl/{sub}/{i:02d}-{nm}')
    json.dump(m,open(f'{name}_imgmap.json','w'),ensure_ascii=False); open(f'{name}_dl.tsv','w').write('\n'.join(lines)+('\n' if lines else ''))
    os.makedirs(f'dl/{sub}',exist_ok=True)
PY
for n in panorama mech prd; do
  [ -s "$n"_dl.tsv ] && cat "$n"_dl.tsv | xargs -P 6 -L 1 bash -c 'lark-cli docs +media-download --token "$0" --output "$1" --overwrite >/dev/null || echo "FAIL $0"'
done
python3 "$OUT/tools/feishu_xml_to_md.py" "$OUT" refresh
for sub in panorama mech prd; do if [ -n "$(ls dl/$sub 2>/dev/null)" ]; then mkdir -p "$OUT/assets/$sub"; cp dl/$sub/* "$OUT/assets/$sub/"; chmod 644 "$OUT/assets/$sub/"*; fi; done
mkdir -p "$OUT/raw"; cp *.xml.json "$OUT/raw/"
echo "刷新完成：$OUT"
