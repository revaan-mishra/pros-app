import { describe, expect, it } from 'vitest';
import { clampRelicPitch, createRelicMesh, multiply4, perspective4, relicOrientation, relicProjection } from './relic-geometry';

const point = (matrix: Float32Array, value: number[]) => [0,1,2,3].map(row => value.reduce((total, number, column) => total + matrix[column*4+row]*number, 0));
describe('inspectable compass geometry', () => {
  it('has bounded, finite three-dimensional geometry and normalized material lighting', () => {
    const mesh = createRelicMesh();
    expect(mesh.vertices.length).toBe(mesh.vertexCount*9); expect(mesh.vertexCount%3).toBe(0);
    expect(mesh.vertices.byteLength).toBeLessThan(400_000);
    const heights = new Set<number>();
    for (let offset=0;offset<mesh.vertices.length;offset+=9) {
      const vertex = mesh.vertices.slice(offset,offset+9); expect([...vertex].every(Number.isFinite)).toBe(true);
      expect(Math.hypot(...vertex.slice(3,6))).toBeCloseTo(1,5);
      expect(Math.abs(vertex[0])).toBeLessThanOrEqual(1.25); expect(Math.abs(vertex[2])).toBeLessThanOrEqual(1.26);
      expect([...vertex.slice(6,9)].every(value=>value>=0&&value<=1)).toBe(true); heights.add(Math.round(vertex[1]*1000));
    }
    expect(heights.size).toBeGreaterThan(6);
  });
  it('generates independent arrays so inspection cannot alter a shared mesh', () => {
    const first=createRelicMesh(),second=createRelicMesh();const before=second.vertices[0];first.vertices[0]=999;
    expect(second.vertices[0]).toBe(before);
  });
  it('preserves lengths while rotating and returns to the same view after a full turn', () => {
    for (const yaw of [-12,-1,0,1,12]) {
      const model=relicOrientation(yaw,.94); const rotated=point(model,[1,2,3,0]);
      expect(Math.hypot(...rotated)).toBeCloseTo(Math.sqrt(14),5);
      const full=relicOrientation(yaw+Math.PI*2,.94);
      [...model].forEach((value,index)=>expect(full[index]).toBeCloseTo(value,5));
    }
  });
  it('keeps the compass in view for phone and desktop aspect ratios and permitted tilt', () => {
    const mesh=createRelicMesh();
    for (const aspect of [1,4/3,2]) for (const pitch of [.25,.94,1.4]) {
      const projection=relicProjection(aspect,relicOrientation(.4,pitch));
      for (let offset=0;offset<mesh.vertices.length;offset+=9) {
        const projected=point(projection,[...mesh.vertices.slice(offset,offset+3),1]);
        expect(projected[3]).toBeGreaterThan(0); expect(Math.abs(projected[0]/projected[3])).toBeLessThan(1);
        expect(Math.abs(projected[1]/projected[3])).toBeLessThan(1); expect(projected[2]/projected[3]).toBeGreaterThan(-1); expect(projected[2]/projected[3]).toBeLessThan(1);
      }
    }
  });
  it('clamps extreme pointer tilt while keeping projection multiplication stable', () => {
    expect(clampRelicPitch(-100)).toBe(.25); expect(clampRelicPitch(100)).toBe(1.4);
    const identity=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
    const perspective=perspective4(4/3);
    expect([...multiply4(identity,perspective)]).toEqual([...perspective]);
    expect([...multiply4(perspective,identity)]).toEqual([...perspective]);
  });
});
