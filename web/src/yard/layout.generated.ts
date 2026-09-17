// 由 assets/yard-3d/make_paths.py 生成，不要手改。
export const LAYOUT = {
 "source": "assets/scenes/courtyard-v4/scene.json",
 "width": 6.0,
 "nodes": {
  "m0": {
   "x": -2.388,
   "z": -0.624
  },
  "m1": {
   "x": -2.238,
   "z": -0.408
  },
  "m2": {
   "x": -2.01,
   "z": -0.12
  },
  "m3": {
   "x": -1.77,
   "z": 0.132
  },
  "m4": {
   "x": -1.41,
   "z": 0.24
  },
  "m5": {
   "x": -1.14,
   "z": 0.252
  },
  "m6": {
   "x": -0.81,
   "z": 0.66
  },
  "m7": {
   "x": -0.33,
   "z": 1.032
  },
  "m8": {
   "x": 0.21,
   "z": 1.188
  },
  "m9": {
   "x": 0.87,
   "z": 1.236
  },
  "m10": {
   "x": 1.41,
   "z": 1.212
  },
  "m11": {
   "x": 1.89,
   "z": 1.104
  },
  "m12": {
   "x": 2.19,
   "z": 0.816
  },
  "m13": {
   "x": 2.388,
   "z": 0.228
  },
  "m14": {
   "x": 2.394,
   "z": -0.42
  },
  "m15": {
   "x": 2.28,
   "z": -0.936
  },
  "d1-0": {
   "x": -0.822,
   "z": 0.132
  },
  "d1-1": {
   "x": -0.75,
   "z": -0.108
  },
  "d1-2": {
   "x": -0.726,
   "z": -0.276
  },
  "d2-0": {
   "x": -1.818,
   "z": 0.924
  },
  "d3-0": {
   "x": -0.582,
   "z": 0.792
  },
  "d3-1": {
   "x": -0.306,
   "z": 0.648
  },
  "d4-0": {
   "x": 1.914,
   "z": 0.048
  },
  "clearing": {
   "x": -0.648,
   "z": 0.924
  },
  "fence-contact": {
   "x": 2.43,
   "z": -1.608
  },
  "bowl": {
   "x": -2.261,
   "z": -0.834
  }
 },
 "edges": [
  {
   "a": "m0",
   "b": "m1",
   "main": true
  },
  {
   "a": "m1",
   "b": "m2",
   "main": true
  },
  {
   "a": "m2",
   "b": "m3",
   "main": true
  },
  {
   "a": "m3",
   "b": "m4",
   "main": true
  },
  {
   "a": "m4",
   "b": "m5",
   "main": true
  },
  {
   "a": "m5",
   "b": "m6",
   "main": true
  },
  {
   "a": "m6",
   "b": "m7",
   "main": true
  },
  {
   "a": "m7",
   "b": "m8",
   "main": true
  },
  {
   "a": "m8",
   "b": "m9",
   "main": true
  },
  {
   "a": "m9",
   "b": "m10",
   "main": true
  },
  {
   "a": "m10",
   "b": "m11",
   "main": true
  },
  {
   "a": "m11",
   "b": "m12",
   "main": true
  },
  {
   "a": "m12",
   "b": "m13",
   "main": true
  },
  {
   "a": "m13",
   "b": "m14",
   "main": true
  },
  {
   "a": "m14",
   "b": "m15",
   "main": true
  },
  {
   "a": "m5",
   "b": "d1-0",
   "main": false
  },
  {
   "a": "d1-0",
   "b": "d1-1",
   "main": false
  },
  {
   "a": "d1-1",
   "b": "d1-2",
   "main": false
  },
  {
   "a": "m3",
   "b": "d2-0",
   "main": false
  },
  {
   "a": "m6",
   "b": "d3-0",
   "main": false
  },
  {
   "a": "d3-0",
   "b": "d3-1",
   "main": false
  },
  {
   "a": "m6",
   "b": "clearing",
   "main": false
  },
  {
   "a": "m15",
   "b": "fence-contact",
   "main": false
  },
  {
   "a": "m12",
   "b": "d4-0",
   "main": false
  },
  {
   "a": "m0",
   "b": "bowl",
   "main": false
  }
 ],
 "destinations": [
  {
   "id": "house",
   "name": "蘑菇屋",
   "node": "m0",
   "idle": "sleepyNod"
  },
  {
   "id": "tree",
   "name": "树屋",
   "node": "d1-2",
   "idle": "blinkLook"
  },
  {
   "id": "bed",
   "name": "猫窝",
   "node": "d2-0",
   "idle": "sleepBreathe"
  },
  {
   "id": "grass",
   "name": "草丛",
   "node": "d3-1",
   "idle": "blinkLook"
  },
  {
   "id": "pond",
   "name": "池塘",
   "node": "d4-0",
   "idle": "blinkLook"
  },
  {
   "id": "fence",
   "name": "栅栏边",
   "node": "fence-contact",
   "idle": "blinkLook"
  }
 ],
 "pond": [
  {
   "x": 0.03,
   "z": -0.72
  },
  {
   "x": 0.33,
   "z": -1.2
  },
  {
   "x": 0.69,
   "z": -1.308
  },
  {
   "x": 1.05,
   "z": -1.2
  },
  {
   "x": 1.47,
   "z": -0.9
  },
  {
   "x": 1.83,
   "z": -0.384
  },
  {
   "x": 1.908,
   "z": -0.084
  },
  {
   "x": 1.782,
   "z": 0.192
  },
  {
   "x": 1.506,
   "z": 0.36
  },
  {
   "x": 0.93,
   "z": 0.384
  },
  {
   "x": 0.6,
   "z": 0.324
  },
  {
   "x": 0.45,
   "z": 0.048
  },
  {
   "x": 0.174,
   "z": -0.12
  }
 ],
 "anchors": {
  "house": {
   "x": -2.265,
   "z": -1.5
  },
  "bowl": {
   "x": -1.974,
   "z": -0.984
  },
  "mailbox": {
   "x": -2.802,
   "z": 0.06
  },
  "bed": {
   "x": -1.818,
   "z": 0.924
  },
  "tree": {
   "x": -0.81,
   "z": -0.6
  },
  "nest": {
   "x": -1.347,
   "z": -0.456
  },
  "board": {
   "x": -0.63,
   "z": 1.2
  },
  "grass": {
   "x": -0.294,
   "z": 0.696
  },
  "flower": {
   "x": 2.487,
   "z": -1.272
  },
  "fence_from": {
   "x": 0.51,
   "z": -1.62
  },
  "fence_corner": {
   "x": 2.742,
   "z": -1.62
  },
  "fence_to": {
   "x": 2.742,
   "z": -0.42
  }
 },
 "nestPivotHeight": 1.22,
 "nestSeatHeight": 0.55
} as const;
