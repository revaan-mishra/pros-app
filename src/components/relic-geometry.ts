export type Matrix4 = Float32Array;
export interface RelicMesh { vertices: Float32Array; vertexCount: number }
type Vector3 = readonly [number, number, number];
type Color = readonly [number, number, number];

export function multiply4(a: Matrix4, b: Matrix4): Matrix4 {
  const result = new Float32Array(16);
  for (let column = 0; column < 4; column++) for (let row = 0; row < 4; row++) {
    for (let inner = 0; inner < 4; inner++) result[column * 4 + row] += a[inner * 4 + row] * b[column * 4 + inner];
  }
  return result;
}
export function perspective4(aspect: number): Matrix4 {
  const f = 1 / Math.tan(Math.PI / 8), near = .1, far = 30;
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0]);
}
export function relicOrientation(yaw: number, pitch: number): Matrix4 {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(pitch), sx = Math.sin(pitch);
  return multiply4(new Float32Array([1,0,0,0,0,cx,sx,0,0,-sx,cx,0,0,0,0,1]), new Float32Array([cy,0,-sy,0,0,1,0,0,sy,0,cy,0,0,0,0,1]));
}
export function relicProjection(aspect: number, model: Matrix4): Matrix4 {
  const view = new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,-.05,-4.4,1]);
  return multiply4(perspective4(Math.max(.25, aspect)), multiply4(view, model));
}
export function clampRelicPitch(pitch: number): number { return Math.max(.25, Math.min(1.4, pitch)); }
/** Fixed, bounded geometry. Each vertex contains position, face normal and material RGB. */
export function createRelicMesh(): RelicMesh {
  const values: number[] = [];
  const brass: Color = [.74,.57,.29], edge: Color = [.88,.72,.42], teal: Color = [.12,.32,.30], dark: Color = [.055,.13,.14], ivory: Color = [.88,.85,.69];
  function triangle(a: Vector3, b: Vector3, c: Vector3, color: Color) {
    const ab = b.map((value, i) => value - a[i]), ac = c.map((value, i) => value - a[i]);
    const cross = [ab[1]*ac[2]-ab[2]*ac[1], ab[2]*ac[0]-ab[0]*ac[2], ab[0]*ac[1]-ab[1]*ac[0]];
    const length = Math.hypot(...cross) || 1;
    const normal = cross.map(value => value / length);
    for (const point of [a,b,c]) values.push(...point, ...normal, ...color);
  }
  function quad(a: Vector3, b: Vector3, c: Vector3, d: Vector3, color: Color) { triangle(a,b,c,color); triangle(a,c,d,color); }
  function ring(outer: number, inner: number, top: number, bottom: number, color: Color, segments = 64) {
    for (let i = 0; i < segments; i++) {
      const a = i * Math.PI * 2 / segments, b = (i + 1) * Math.PI * 2 / segments;
      const point = (radius: number, y: number, angle: number): Vector3 => [Math.cos(angle)*radius, y, Math.sin(angle)*radius];
      quad(point(outer,top,a), point(inner,top,a), point(inner,top,b), point(outer,top,b), color);
      quad(point(outer,bottom,a), point(outer,top,a), point(outer,top,b), point(outer,bottom,b), color);
      quad(point(inner,top,a), point(inner,bottom,a), point(inner,bottom,b), point(inner,top,b), color);
      quad(point(inner,bottom,a), point(outer,bottom,a), point(outer,bottom,b), point(inner,bottom,b), color);
    }
  }
  function disk(radius: number, top: number, bottom: number, color: Color) {
    for (let i = 0; i < 64; i++) {
      const a = i * Math.PI * 2 / 64, b = (i + 1) * Math.PI * 2 / 64;
      const p = (angle: number, y: number): Vector3 => [Math.cos(angle)*radius,y,Math.sin(angle)*radius];
      triangle([0,top,0],p(b,top),p(a,top),color);
      triangle([0,bottom,0],p(a,bottom),p(b,bottom),color);
      quad(p(a,bottom),p(a,top),p(b,top),p(b,bottom),color);
    }
  }
  disk(1, -.05, -.22, dark);
  ring(1.04,.91,.04,-.12,brass);
  disk(.91,.012,-.05,teal);
  ring(.85,.836,.026,.013,edge);
  ring(.64,.63,.025,.013,brass);
  // Raised hour marks retain their shape when the compass is tilted.
  for (let i = 0; i < 48; i++) {
    const angle = i*Math.PI/24, half = i%4===0 ? .012 : .006, outer = .805, inner = i%4===0 ? .70 : .76;
    const point = (radius: number, delta: number, y: number): Vector3 => [Math.cos(angle+delta)*radius,y,Math.sin(angle+delta)*radius];
    quad(point(inner,-half,.037),point(inner,half,.037),point(outer,half,.037),point(outer,-half,.037),ivory);
    quad(point(inner,-half,.025),point(inner,-half,.037),point(outer,-half,.037),point(outer,-half,.025),brass);
  }
  // Eight folded, geometric points form a real, raised compass rose.
  for (let i = 0; i < 8; i++) {
    const angle = i*Math.PI/4, radius = i%2===0 ? .60 : .43;
    const tip: Vector3 = [Math.cos(angle)*radius,.045,Math.sin(angle)*radius];
    const left: Vector3 = [Math.cos(angle+Math.PI/2)*.10,.035,Math.sin(angle+Math.PI/2)*.10];
    const right: Vector3 = [-left[0],.035,-left[2]];
    triangle([0,.105,0],left,tip,i%2===0?edge:ivory);
    triangle([0,.105,0],tip,right,i%2===0?brass:teal);
  }
  disk(.075,.145,.08,edge);
  // A small raised eyelet gives the silhouette a distinct top edge.
  ring(.13,.075,.04,-.02,brass,32);
  const eyeletStart = values.length - 32*4*6*9;
  for (let offset = eyeletStart; offset < values.length; offset += 9) values[offset + 2] -= 1.12;
  return { vertices: new Float32Array(values), vertexCount: values.length / 9 };
}
