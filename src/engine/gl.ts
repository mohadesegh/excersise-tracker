/**
 * Real-3D body renderer with zero dependencies.
 *
 * The body is a signed-distance field: tapered limbs (round cones) and an
 * ellipsoid torso blended with smooth-min, so it reads as one continuous
 * surface. Raymarched in a fragment shader with soft shadows, ambient
 * occlusion and a contact-shadowed floor.
 *
 * One WebGL context is shared by the whole app; each on-screen canvas copies
 * the result with drawImage. That keeps us far below browser context limits
 * even with a grid of thumbnails.
 */

export type V3 = [number, number, number];

export interface Cone { a: V3; b: V3; ra: number; rb: number; hot: number }
export interface Ellipsoid { c: V3; r: V3; hot: number }
export interface Cylinder { a: V3; b: V3; r: number }
/** Oriented rounded box from a to b: palms, fingers, feet, toes. `up` is the thickness axis. */
export interface Slab { a: V3; b: V3; w: number; t: number; up: V3; r: number }

export interface Scene {
  cones: Cone[]; // exactly MAX_CONES (pad with zero-radius)
  ellipsoids: Ellipsoid[]; // exactly MAX_ELL
  /** torso basis (columns: side, up, forward) for oriented ellipsoids */
  basis: [V3, V3, V3];
  props: Cylinder[];
  slabs: Slab[];
  bound: { c: V3; r: number };
  floorR: number;
}

export interface Camera {
  /** world→camera rotation (row-major 3×3) */
  rot: number[];
  cam: number;
  ox: number;
  oy: number;
  scale: number;
}

export interface Palette {
  body: [number, number, number];
  hot: [number, number, number];
  iron: [number, number, number];
  floor: [number, number, number];
  grid: [number, number, number];
  floorAlpha: number;
  gridAlpha: number;
  shadow: number;
  dark: boolean;
}

export const MAX_CONES = 16;
export const MAX_ELL = 5;
export const MAX_PROPS = 6;
export const MAX_SLABS = 10;

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform vec3 uFit;      // ox, oy, scale (pixels)
uniform float uCam;
uniform mat3 uRot;      // world -> camera
uniform vec4 uCA[${MAX_CONES}];  // cone start xyz, radius
uniform vec4 uCB[${MAX_CONES}];  // cone end xyz, radius
uniform float uCH[${MAX_CONES}]; // 1 = highlighted muscle
uniform vec4 uE[${MAX_ELL}];     // ellipsoid centre xyz, hot
uniform vec3 uER[${MAX_ELL}];    // ellipsoid radii (side, up, fwd)
uniform mat3 uBasis;
uniform vec4 uSA[${MAX_SLABS}];  // slab start xyz, half width
uniform vec4 uSB[${MAX_SLABS}];  // slab end xyz, half thickness
uniform vec4 uSU[${MAX_SLABS}];  // thickness axis xyz, rounding
uniform vec4 uPA[${MAX_PROPS}];
uniform vec4 uPB[${MAX_PROPS}];
uniform int uPN;
uniform vec4 uBound;    // body bounding sphere
uniform float uFloorR;
uniform vec3 uBody, uHot, uIron, uFloor, uGrid;
uniform vec4 uMisc;     // floorAlpha, gridAlpha, shadow, dark

float sdRoundCone(vec3 p, vec3 a, vec3 b, float r1, float r2){
  vec3 ba = b - a; float l2 = dot(ba,ba);
  if (l2 < 1e-6) return length(p - a) - max(r1, r2);
  float rr = r1 - r2; float a2 = l2 - rr*rr; float il2 = 1.0/l2;
  vec3 pa = p - a; float y = dot(pa,ba); float z = y - l2;
  vec3 xv = pa*l2 - ba*y; float x2 = dot(xv,xv); float y2 = y*y*l2; float z2 = z*z*l2;
  float k = sign(rr)*rr*rr*x2;
  if (sign(z)*a2*z2 > k) return sqrt(x2 + z2)*il2 - r2;
  if (sign(y)*a2*y2 < k) return sqrt(x2 + y2)*il2 - r1;
  return (sqrt(x2*a2*il2) + y*rr)*il2 - r1;
}
float sdEllipsoid(vec3 p, vec3 r){
  float k0 = length(p/r); float k1 = length(p/(r*r));
  return k0*(k0 - 1.0)/k1;
}
float sdCyl(vec3 p, vec3 a, vec3 b, float r){
  vec3 ba = b - a; vec3 pa = p - a; float baba = dot(ba,ba); float paba = dot(pa,ba);
  float x = length(pa*baba - ba*paba) - r*baba; float y = abs(paba - baba*0.5) - baba*0.5;
  float x2 = x*x; float y2 = y*y*baba;
  float d = (max(x,y) < 0.0) ? -min(x2, y2*1.0) : (((x > 0.0) ? x2 : 0.0) + ((y > 0.0) ? y2 : 0.0));
  return sign(d)*sqrt(abs(d))/baba;
}
float sdSlab(vec3 p, vec4 A, vec4 B, vec4 U){
  vec3 ax = B.xyz - A.xyz; float len = length(ax); ax /= max(len, 1e-5);
  vec3 sd = normalize(cross(ax, U.xyz)); vec3 nm = cross(sd, ax);
  vec3 d = p - (A.xyz + B.xyz)*0.5;
  vec3 q = vec3(dot(d, sd), dot(d, nm), dot(d, ax));
  vec3 h = vec3(A.w, B.w, len*0.5);
  vec3 e = abs(q) - (h - U.w);
  return length(max(e, 0.0)) + min(max(e.x, max(e.y, e.z)), 0.0) - U.w;
}
// smooth min that also returns the blend factor toward b
vec2 smin(float a, float b, float k){
  float h = max(k - abs(a - b), 0.0)/k; float m = h*h*0.5; float s = m*k*0.5;
  return (a < b) ? vec2(a - s, m) : vec2(b - s, 1.0 - m);
}

// x = distance, y = hot (0..1), z = iron (0..1)
vec3 map(vec3 p){
  vec3 lp = p * uBasis; // into torso frame
  vec3 res = vec3(1e5, 0.0, 0.0);
  // torso + head: soft, generous blend
  for (int i = 0; i < ${MAX_ELL}; i++){
    vec3 q = lp - uE[i].xyz * uBasis;
    float d = sdEllipsoid(q, uER[i]);
    vec2 s = smin(res.x, d, i == 0 ? 0.03 : 0.1);
    res = vec3(s.x, mix(res.y, uE[i].w, s.y), 0.0);
  }
  // limbs: tighter blend so joints stay readable
  for (int i = 0; i < ${MAX_CONES}; i++){
    if (uCA[i].w <= 0.0) continue;
    float d = sdRoundCone(p, uCA[i].xyz, uCB[i].xyz, uCA[i].w, uCB[i].w);
    vec2 s = smin(res.x, d, 0.035);
    res = vec3(s.x, mix(res.y, uCH[i], s.y), 0.0);
  }
  // hands and feet: small blend so fingers/toes stay distinct
  for (int i = 0; i < ${MAX_SLABS}; i++){
    if (uSA[i].w <= 0.0) continue;
    float d = sdSlab(p, uSA[i], uSB[i], uSU[i]);
    vec2 s = smin(res.x, d, i < 4 ? 0.024 : 0.035);   // hands: 0-3, feet: 4+
    res = vec3(s.x, res.y*(1.0 - s.y), 0.0);
  }
  for (int i = 0; i < ${MAX_PROPS}; i++){
    if (i >= uPN) break;
    float d = sdCyl(p, uPA[i].xyz, uPB[i].xyz, uPA[i].w);
    if (d < res.x) res = vec3(d, 0.0, 1.0);
  }
  return res;
}

vec3 normalAt(vec3 p){
  const vec2 e = vec2(0.0015, -0.0015);
  return normalize(e.xyy*map(p + e.xyy).x + e.yyx*map(p + e.yyx).x + e.yxy*map(p + e.yxy).x + e.xxx*map(p + e.xxx).x);
}

float softShadow(vec3 ro, vec3 rd){
  float res = 1.0; float t = 0.02;
  for (int i = 0; i < 28; i++){
    float h = map(ro + rd*t).x;
    res = min(res, 10.0*h/t);
    t += clamp(h, 0.015, 0.12);
    if (res < 0.01 || t > 2.5) break;
  }
  return clamp(res, 0.0, 1.0);
}

float ao(vec3 p, vec3 n){
  float occ = 0.0; float sca = 1.0;
  for (int i = 0; i < 4; i++){
    float h = 0.02 + 0.06*float(i);
    occ += (h - map(p + n*h).x)*sca; sca *= 0.7;
  }
  return clamp(1.0 - 2.2*occ, 0.0, 1.0);
}

vec2 sphereHit(vec3 ro, vec3 rd, vec4 s){
  vec3 oc = ro - s.xyz; float b = dot(oc, rd); float c = dot(oc,oc) - s.w*s.w; float h = b*b - c;
  if (h < 0.0) return vec2(-1.0);
  h = sqrt(h); return vec2(-b - h, -b + h);
}

void main(){
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 q = (px - uFit.xy) / uFit.z;           // same camera model as the 2D fallback
  vec3 roC = vec3(0.0, 0.0, uCam);
  vec3 rdC = normalize(vec3(q.x, -q.y, -uCam));
  vec3 ro = roC * uRot;                        // camera -> world (transpose)
  vec3 rd = normalize(rdC * uRot);
  vec3 L = normalize(vec3(-0.45, 1.0, 0.55));  // key light: above, front, left
  float floorA = uMisc.x, gridA = uMisc.y, shadowK = uMisc.z;

  // body
  float tHit = -1.0; vec3 hit = vec3(0.0);
  vec2 bs = sphereHit(ro, rd, uBound);
  if (bs.y > 0.0){
    float t = max(bs.x, 0.0);
    for (int i = 0; i < 80; i++){
      vec3 m = map(ro + rd*t);
      if (m.x < 0.0015){ tHit = t; hit = m; break; }
      t += m.x * 0.9;
      if (t > bs.y) break;
    }
  }
  // floor plane y = 0
  float tF = rd.y < 0.0 ? -ro.y/rd.y : -1.0;

  vec4 outc = vec4(0.0);
  if (tHit > 0.0 && (tF < 0.0 || tHit < tF)){
    vec3 p = ro + rd*tHit;
    vec3 n = normalAt(p);
    vec3 alb = mix(uBody, uHot, smoothstep(0.25, 0.75, hit.y));
    alb = mix(alb, uIron, hit.z);
    float dif = clamp(dot(n, L), 0.0, 1.0);
    float sh = softShadow(p + n*0.004, L);
    float occ = ao(p, n);
    vec3 L2 = normalize(vec3(0.7, 0.35, -0.5));          // cool fill from behind-right
    float fill = clamp(dot(n, L2), 0.0, 1.0);
    float sky = 0.55 + 0.45*n.y;
    float bounce = clamp(-n.y, 0.0, 1.0);                 // warm light off the floor
    float rim = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 3.0);
    vec3 hv = normalize(L - rd);
    float spec = pow(clamp(dot(n, hv), 0.0, 1.0), 40.0) * sh;
    vec3 col = alb * (0.78*dif*sh + 0.22*fill*occ + 0.38*sky*occ + 0.12*bounce*occ);
    col += vec3(0.08)*spec + alb*rim*0.18*occ;
    col *= mix(1.3, 1.0, uMisc.w);                         // light theme needs more exposure
    col = col / (1.0 + col*0.25) * 1.18;                  // soft tone curve: no blown highlights
    outc = vec4(col, 1.0);
  } else if (tF > 0.0){
    vec3 p = ro + rd*tF;
    float r = length(p.xz);
    float fade = 1.0 - smoothstep(uFloorR*0.45, uFloorR, r);
    float shadowFade = 1.0 - smoothstep(uFloorR*0.7, uFloorR*1.8, r);
    if (shadowFade > 0.0){
      // grid with distance-aware anti-aliasing
      float fp = tF / (uFit.z * uCam) * 1.6 / max(abs(rd.y), 0.15);
      vec2 g = abs(fract(p.xz/0.25 + 0.5) - 0.5) * 0.25;
      float line = 1.0 - smoothstep(0.0, fp + 0.003, min(g.x, g.y));
      float sh = softShadow(p + vec3(0.0, 0.002, 0.0), L);
      float contact = 1.0 - smoothstep(0.0, 0.14, map(p).x);   // darkens right under the body
      float dark = max((1.0 - sh)*0.75, contact*0.8);
      float a = (floorA + line*gridA) * fade;
      vec3 col = mix(uFloor, uGrid, line*gridA/(floorA + line*gridA + 1e-4));
      float sa = dark * shadowK * shadowFade;
      // composite: shadow over floor (premultiplied)
      vec3 c = col*a*(1.0 - sa);
      float alpha = a + sa*(1.0 - a);
      outc = vec4(c, alpha);
      gl_FragColor = outc; return;
    }
  }
  gl_FragColor = vec4(outc.rgb*outc.a, outc.a);
}`;

class Renderer {
  readonly canvas = document.createElement('canvas');
  private gl: WebGLRenderingContext;
  private loc: Record<string, WebGLUniformLocation | null> = {};

  constructor() {
    const gl = this.canvas.getContext('webgl', { premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('no webgl');
    this.gl = gl;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link');
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    for (const n of ['uRes', 'uFit', 'uCam', 'uRot', 'uCA', 'uCB', 'uCH', 'uE', 'uER', 'uBasis', 'uPA', 'uPB', 'uPN', 'uSA', 'uSB', 'uSU', 'uBound', 'uFloorR', 'uBody', 'uHot', 'uIron', 'uFloor', 'uGrid', 'uMisc'])
      this.loc[n] = gl.getUniformLocation(prog, n);
  }

  render(w: number, h: number, s: Scene, c: Camera, pal: Palette): HTMLCanvasElement {
    const { gl, loc } = this;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const ca = new Float32Array(MAX_CONES * 4), cb = new Float32Array(MAX_CONES * 4), ch = new Float32Array(MAX_CONES);
    s.cones.slice(0, MAX_CONES).forEach((k, i) => {
      ca.set([...k.a, k.ra], i * 4);
      cb.set([...k.b, k.rb], i * 4);
      ch[i] = k.hot;
    });
    const e = new Float32Array(MAX_ELL * 4), er = new Float32Array(MAX_ELL * 3);
    s.ellipsoids.slice(0, MAX_ELL).forEach((k, i) => {
      e.set([...k.c, k.hot], i * 4);
      er.set(k.r, i * 3);
    });
    const sa = new Float32Array(MAX_SLABS * 4), sb = new Float32Array(MAX_SLABS * 4), su = new Float32Array(MAX_SLABS * 4);
    s.slabs.slice(0, MAX_SLABS).forEach((k, i) => {
      sa.set([...k.a, k.w], i * 4);
      sb.set([...k.b, k.t], i * 4);
      su.set([...k.up, k.r], i * 4);
    });
    gl.uniform4fv(loc.uSA, sa);
    gl.uniform4fv(loc.uSB, sb);
    gl.uniform4fv(loc.uSU, su);
    const pa = new Float32Array(MAX_PROPS * 4), pb = new Float32Array(MAX_PROPS * 4);
    s.props.slice(0, MAX_PROPS).forEach((k, i) => {
      pa.set([...k.a, k.r], i * 4);
      pb.set([...k.b, 0], i * 4);
    });
    // mat3 uniforms are column-major: pass transpose of row-major rot
    const r = c.rot;
    const rotCM = new Float32Array([r[0], r[3], r[6], r[1], r[4], r[7], r[2], r[5], r[8]]);
    const [sx, up, fw] = s.basis;
    const basis = new Float32Array([...sx, ...up, ...fw]); // columns

    gl.uniform2f(loc.uRes, w, h);
    gl.uniform3f(loc.uFit, c.ox, c.oy, c.scale);
    gl.uniform1f(loc.uCam, c.cam);
    gl.uniformMatrix3fv(loc.uRot, false, rotCM);
    gl.uniform4fv(loc.uCA, ca);
    gl.uniform4fv(loc.uCB, cb);
    gl.uniform1fv(loc.uCH, ch);
    gl.uniform4fv(loc.uE, e);
    gl.uniform3fv(loc.uER, er);
    gl.uniformMatrix3fv(loc.uBasis, false, basis);
    gl.uniform4fv(loc.uPA, pa);
    gl.uniform4fv(loc.uPB, pb);
    gl.uniform1i(loc.uPN, Math.min(MAX_PROPS, s.props.length));
    gl.uniform4f(loc.uBound, ...s.bound.c, s.bound.r);
    gl.uniform1f(loc.uFloorR, s.floorR);
    gl.uniform3f(loc.uBody, ...pal.body);
    gl.uniform3f(loc.uHot, ...pal.hot);
    gl.uniform3f(loc.uIron, ...pal.iron);
    gl.uniform3f(loc.uFloor, ...pal.floor);
    gl.uniform3f(loc.uGrid, ...pal.grid);
    gl.uniform4f(loc.uMisc, pal.floorAlpha, pal.gridAlpha, pal.shadow, pal.dark ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return this.canvas;
  }
}

let shared: Renderer | null | undefined;
/** The app-wide renderer, or null when WebGL is unavailable (the 2D fallback takes over). */
export function glRenderer(): Renderer | null {
  if (shared === undefined) {
    try {
      shared = new Renderer();
    } catch (e) {
      console.warn('WebGL unavailable, using 2D mannequin', e);
      shared = null;
    }
  }
  return shared;
}

/** "#rrggbb" or "rgb(…)" → linear-ish 0..1 triple. */
export function rgb(css: string, fallback: [number, number, number]): [number, number, number] {
  const m = css.trim().match(/^#([0-9a-f]{6})$/i);
  if (m) {
    const n = parseInt(m[1], 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const r = css.match(/rgba?\(([^)]+)\)/);
  if (r) {
    const p = r[1].split(',').map((x) => parseFloat(x));
    return [p[0] / 255, p[1] / 255, p[2] / 255];
  }
  return fallback;
}
