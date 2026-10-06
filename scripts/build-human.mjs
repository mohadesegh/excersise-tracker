/**
 * Builds public/human.bin: the human body the app draws, from MakeHuman's
 * CC0 base mesh, skeleton weights and body-shape targets.
 *
 *   node scripts/build-human.mjs <dir>
 *
 * <dir> holds base.obj, default.mhskel, default_weights.mhw and targets/*.target,
 * as found under makehuman/data in https://github.com/makehumancommunity/makehuman
 * (3dobjs/, rigs/ and targets/macrodetails/).
 *
 * File layout (little endian): u32 length of a JSON header, the header padded
 * to 4 bytes, then the blobs the header points into. Lengths are in metres.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const src = process.argv[2];
if (!src) throw new Error('usage: node scripts/build-human.mjs <makehuman data dir>');
const DM = 0.1; // MakeHuman works in decimetres

/* ---------- mesh ---------- */
const V = [];
const groups = {};
let group = '';
for (const line of readFileSync(join(src, 'base.obj'), 'utf8').split('\n')) {
  if (line.startsWith('v ')) {
    const p = line.split(/\s+/);
    V.push([+p[1], +p[2], +p[3]]);
  } else if (line.startsWith('g ')) group = line.slice(2).trim();
  else if (line.startsWith('f ')) (groups[group] ??= []).push(line.trim().split(/\s+/).slice(1).map((s) => parseInt(s) - 1));
}

/** what each part is drawn as: 0 skin, 1 eyeball (its front becomes 2, the iris) */
const PARTS = [['body', 0], ['helper-l-eye', 1], ['helper-r-eye', 1]];
const remap = new Map();
const kind = [];
const tris = [];
for (const [name, k] of PARTS) {
  for (const f of groups[name]) {
    const ix = f.map((i) => {
      if (!remap.has(i)) { remap.set(i, remap.size); kind.push(k); }
      return remap.get(i);
    });
    for (let i = 1; i + 1 < ix.length; i++) tris.push(ix[0], ix[i], ix[i + 1]);
  }
}
const nv = remap.size;
const pos = new Float32Array(nv * 3);
for (const [from, to] of remap) for (let k = 0; k < 3; k++) pos[to * 3 + k] = V[from][k] * DM;

// the front of each eyeball is the iris
for (const name of ['helper-l-eye', 'helper-r-eye']) {
  const ids = [...new Set(groups[name].flat())];
  const c = [0, 0, 0];
  for (const i of ids) for (let k = 0; k < 3; k++) c[k] += V[i][k] / ids.length;
  for (const i of ids) {
    const d = [V[i][0] - c[0], V[i][1] - c[1], V[i][2] - c[2]];
    if (d[2] / Math.hypot(...d) > 0.8) kind[remap.get(i)] = 2;
  }
}

/* ---------- skeleton: joints the app drives, and MakeHuman's bones folded onto them ---------- */
const skel = JSON.parse(readFileSync(join(src, 'default.mhskel'), 'utf8'));
const BONES = ['pelvis', 'waist', 'chest', 'head',
  'armU.L', 'armL.L', 'hand.L', 'armU.R', 'armL.R', 'hand.R',
  'thigh.L', 'shin.L', 'foot.L', 'thigh.R', 'shin.R', 'foot.R', 'shoulder.L', 'shoulder.R'];
const B = Object.fromEntries(BONES.map((n, i) => [n, i]));

/** MakeHuman bone → [app bone, share][]; bones not listed follow their parent */
const FOLD = {
  root: [['pelvis', 1]], 'pelvis.L': [['pelvis', 1]], 'pelvis.R': [['pelvis', 1]], spine05: [['pelvis', 1]],
  spine04: [['pelvis', 0.5], ['waist', 0.5]], spine03: [['waist', 1]],
  spine02: [['waist', 0.5], ['chest', 0.5]], spine01: [['chest', 1]],
  neck01: [['chest', 1]], neck02: [['chest', 0.5], ['head', 0.5]], neck03: [['head', 1]], head: [['head', 1]],
};
for (const s of ['L', 'R']) {
  FOLD[`shoulder01.${s}`] = [[`shoulder.${s}`, 1]]; // the cap of the shoulder turns part of the way with the arm
  FOLD[`upperarm01.${s}`] = [[`armU.${s}`, 1]];
  FOLD[`lowerarm01.${s}`] = [[`armL.${s}`, 1]];
  FOLD[`wrist.${s}`] = [[`hand.${s}`, 1]];
  FOLD[`upperleg01.${s}`] = [[`thigh.${s}`, 1]];
  FOLD[`lowerleg01.${s}`] = [[`shin.${s}`, 1]];
  FOLD[`foot.${s}`] = [[`foot.${s}`, 1]];
}
const fold = (name) => {
  for (let b = name; b; b = skel.bones[b].parent) if (FOLD[b]) return FOLD[b];
  throw new Error(`no app bone for ${name}`);
};

const acc = Array.from({ length: nv }, () => new Float64Array(BONES.length));
const weights = JSON.parse(readFileSync(join(src, 'default_weights.mhw'), 'utf8')).weights;
for (const name in weights) {
  const to = fold(name);
  for (const [i, w] of weights[name]) {
    const v = remap.get(i);
    if (v === undefined || kind[v] !== 0) continue;
    for (const [b, share] of to) acc[v][B[b]] += w * share;
  }
}
const skinB = new Uint8Array(nv * 4);
const skinW = new Uint8Array(nv * 4);
for (let v = 0; v < nv; v++) {
  if (kind[v] !== 0) acc[v].fill(0)[B.head] = 1; // the eyes ride on the head
  const top = [...acc[v].entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).filter((e) => e[1] > 0);
  if (!top.length) throw new Error(`vertex ${v} has no weights`);
  const sum = top.reduce((s, e) => s + e[1], 0);
  let left = 255;
  top.forEach(([b, w], k) => {
    const q = k === top.length - 1 ? left : Math.min(left, Math.round((w / sum) * 255));
    skinB[v * 4 + k] = b;
    skinW[v * 4 + k] = q;
    left -= q;
  });
}

/** joints the app needs, as MakeHuman joint names (a joint sits at the mean of its helper vertices) */
const JOINTS = { neck: skel.bones.neck01.head, head: skel.bones.head.head };
for (const s of ['L', 'R']) {
  JOINTS[`hip.${s}`] = skel.bones[`upperleg01.${s}`].head;
  JOINTS[`knee.${s}`] = skel.bones[`lowerleg01.${s}`].head;
  JOINTS[`ankle.${s}`] = skel.bones[`foot.${s}`].head;
  JOINTS[`shoulder.${s}`] = skel.bones[`upperarm01.${s}`].head;
  JOINTS[`elbow.${s}`] = skel.bones[`lowerarm01.${s}`].head;
  JOINTS[`wrist.${s}`] = skel.bones[`wrist.${s}`].head;
}
const jointNames = Object.keys(JOINTS);
const mean = (ids, at) => {
  const o = [0, 0, 0];
  for (const i of ids) { const p = at(i); if (p) for (let k = 0; k < 3; k++) o[k] += (p[k] * DM) / ids.length; }
  return o;
};
const joints = jointNames.map((n) => mean(skel.joints[JOINTS[n]], (i) => V[i]));

/* ---------- body-shape targets: sparse vertex offsets, plus what each does to the joints ---------- */
const QUANT = 1 / 20000; // metres per step of the int16 offsets
const targets = [];
const blobs = [];
let offset = 0;
const push = (arr) => {
  const bytes = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
  const at = offset;
  blobs.push(bytes);
  offset += bytes.length;
  const pad = (4 - (offset % 4)) % 4;
  if (pad) { blobs.push(Buffer.alloc(pad)); offset += pad; }
  return at;
};

for (const file of readdirSync(join(src, 'targets')).sort()) {
  if (!file.endsWith('.target')) continue;
  const delta = new Map();
  for (const line of readFileSync(join(src, 'targets', file), 'utf8').split('\n')) {
    if (!line || line[0] === '#') continue;
    const p = line.trim().split(/\s+/);
    if (p.length === 4) delta.set(+p[0], [+p[1], +p[2], +p[3]]);
  }
  const ids = [...delta.keys()].filter((i) => remap.has(i)).sort((a, b) => remap.get(a) - remap.get(b));
  if (!ids.length) continue; // the "average" targets change nothing
  const idx = new Uint16Array(ids.map((i) => remap.get(i)));
  const off = new Int16Array(ids.length * 3);
  ids.forEach((i, n) => delta.get(i).forEach((d, k) => { off[n * 3 + k] = Math.round((d * DM) / QUANT); }));
  targets.push({
    name: file.replace('.target', ''),
    n: ids.length,
    idx: push(idx),
    off: push(off),
    joints: jointNames.map((j) => mean(skel.joints[JOINTS[j]], (i) => delta.get(i)).map((x) => +x.toFixed(5))),
  });
}

const header = {
  nv, nt: tris.length / 3, quant: QUANT, bones: BONES, jointNames,
  joints: joints.map((j) => j.map((x) => +x.toFixed(5))),
  pos: push(pos), tris: push(new Uint16Array(tris)), kind: push(new Uint8Array(kind)),
  skinB: push(skinB), skinW: push(skinW), targets,
};
let json = Buffer.from(JSON.stringify(header));
json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
const len = Buffer.alloc(4);
len.writeUInt32LE(json.length);
const out = Buffer.concat([len, json, ...blobs]);
writeFileSync(new URL('../public/human.bin', import.meta.url), out);
console.log(`human.bin: ${nv} vertices, ${tris.length / 3} triangles, ${targets.length} targets, ${(out.length / 1024).toFixed(0)} KB`);
