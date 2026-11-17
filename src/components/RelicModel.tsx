import { useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import { ChevronDown, MoveLeft, MoveRight, Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from './ui';
import { clampRelicPitch, createRelicMesh, relicOrientation, relicProjection } from './relic-geometry';
import './relic-model.css';

const VERTEX_SHADER = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec3 aColor;
uniform mat4 uModel;
uniform mat4 uMVP;
varying vec3 vNormal;
varying vec3 vColor;
void main() {
  vNormal = mat3(uModel) * aNormal;
  vColor = aColor;
  gl_Position = uMVP * vec4(aPosition, 1.0);
}`;
const FRAGMENT_SHADER = `
precision mediump float;
varying vec3 vNormal;
varying vec3 vColor;
void main() {
  vec3 normal = normalize(vNormal);
  float diffuse = max(dot(normal, normalize(vec3(-0.35, 0.7, 1.0))), 0.0);
  float rim = pow(max(0.0, 1.0 - abs(normal.z)), 3.0) * 0.12;
  gl_FragColor = vec4(vColor * (0.52 + diffuse * 0.66) + vec3(rim * 0.8, rim * 0.65, rim * 0.35), 1.0);
}`;
function createProgram(gl: WebGLRenderingContext): WebGLProgram {
  const vertex = gl.createShader(gl.VERTEX_SHADER), fragment = gl.createShader(gl.FRAGMENT_SHADER), program = gl.createProgram();
  if (!vertex || !fragment || !program) {
    if (vertex) gl.deleteShader(vertex); if (fragment) gl.deleteShader(fragment); if (program) gl.deleteProgram(program);
    throw new Error('The illustrated view is available.');
  }
  try {
    for (const [shader, source] of [[vertex, VERTEX_SHADER], [fragment, FRAGMENT_SHADER]] as const) {
      gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('The illustrated view is available.');
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('The illustrated view is available.');
    return program;
  } catch (error) { gl.deleteProgram(program); throw error; }
  finally { gl.deleteShader(vertex); gl.deleteShader(fragment); }
}

function CompassIllustration() {
  return <svg className="relic-illustration" viewBox="0 0 400 300" role="img" aria-label="An illustrated brass compass with a teal face and an ivory compass rose">
    <ellipse cx="200" cy="248" rx="106" ry="13" fill="#020d15" opacity=".35"/>
    <g transform="translate(200 148) rotate(-15)">
      <ellipse cy="-111" rx="16" ry="12" fill="none" stroke="#aa854a" strokeWidth="7"/>
      <circle cy="8" r="103" fill="#1b3334" stroke="#83663b" strokeWidth="7"/>
      <circle r="103" fill="#b79558" stroke="#dcc18b" strokeWidth="3"/>
      <circle r="92" fill="#18423e" stroke="#6f5837" strokeWidth="3"/>
      <circle r="83" fill="none" stroke="#c6aa6c" strokeWidth="1"/>
      <circle r="63" fill="none" stroke="#af8d50" strokeWidth="1"/>
      {Array.from({length:32},(_,i)=><path key={i} d={`M0 -${i%4===0?70:77}V-81`} transform={`rotate(${i*11.25})`} stroke="#dfd1a4" strokeWidth={i%4===0?2:1}/>)}
      {Array.from({length:8},(_,i)=><g key={i} transform={`rotate(${i*45})`}><path d={`M0 0 0 -${i%2===0?59:43} 10 0Z`} fill={i%2===0?'#e5d9b5':'#b69a60'}/><path d={`M0 0 0 -${i%2===0?59:43} -10 0Z`} fill="#9a7844"/></g>)}
      <circle r="8" fill="#ddbf7b" stroke="#8e703e" strokeWidth="2"/>
    </g>
  </svg>;
}
interface ModelControls { turn: (yaw: number, pitch?: number) => void; reset: () => void; spin: (value: boolean) => void }
function RelicStage({ motion }: { motion: 'system' | 'reduced' | 'full' }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controls = useRef<ModelControls | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; startX: number; startY: number; touch: boolean; committed: boolean } | null>(null);
  const [ready, setReady] = useState(false), [unavailable, setUnavailable] = useState(false), [spinning, setSpinning] = useState(false), [reduced, setReduced] = useState(true);
  const [attempt, setAttempt] = useState(0); const instructionsId = useId();
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    let gl: WebGLRenderingContext | null = null, program: WebGLProgram | null = null, buffer: WebGLBuffer | null = null;
    let disposed = false, lost = false, frameId = 0, visible = true, rotating = false, lastFrame = 0;
    let yaw = -.32, pitch = .94;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let reduce = motion === 'reduced' || media.matches || document.documentElement.dataset.motion === 'reduced';
    setReduced(reduce); setReady(false); setUnavailable(false); setSpinning(false);
    const drawable = () => !disposed && !lost && visible && !document.hidden;
    const request = () => { if (drawable() && !frameId) frameId = requestAnimationFrame(draw); };
    const stopFrame = () => { cancelAnimationFrame(frameId); frameId = 0; lastFrame = 0; };
    let vertexCount = 0;
    let mvp: WebGLUniformLocation | null = null, modelUniform: WebGLUniformLocation | null = null;
    function draw(time: number) {
      frameId = 0;
      if (!drawable() || !gl || !program) return;
      if (rotating && !reduce && lastFrame) yaw += Math.min(.06, (time - lastFrame) / 1000) * .35;
      lastFrame = time;
      const bounds = canvas!.getBoundingClientRect(), ratio = Math.min(1.75, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(bounds.width * ratio)), height = Math.max(1, Math.round(bounds.height * ratio));
      if (width !== canvas!.width || height !== canvas!.height) { canvas!.width = width; canvas!.height = height; }
      gl.viewport(0, 0, width, height); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const model = relicOrientation(yaw, pitch);
      gl.useProgram(program); gl.uniformMatrix4fv(modelUniform, false, model); gl.uniformMatrix4fv(mvp, false, relicProjection(width / height, model));
      gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
      if (rotating && !reduce) request();
    }
    function updateMotion() {
      reduce = motion === 'reduced' || media.matches || document.documentElement.dataset.motion === 'reduced'; setReduced(reduce);
      if (reduce) { rotating = false; setSpinning(false); stopFrame(); } request();
    }
    const visibility = () => { if (!drawable()) stopFrame(); else request(); };
    const contextLost = (event: Event) => { event.preventDefault(); lost = true; rotating = false; stopFrame(); setSpinning(false); setReady(false); setUnavailable(true); controls.current = null; };
    const contextRestored = () => { if (!disposed) setAttempt(value => value + 1); };
    let resize: ResizeObserver | undefined, intersection: IntersectionObserver | undefined, rootChanges: MutationObserver | undefined;
    try {
      gl = canvas.getContext('webgl', { alpha: true, antialias: true, depth: true, powerPreference: 'low-power', preserveDrawingBuffer: false });
      if (!gl) throw new Error('The illustrated view is available.');
      program = createProgram(gl); buffer = gl.createBuffer(); if (!buffer) throw new Error('The illustrated view is available.');
      const mesh = createRelicMesh(); vertexCount = mesh.vertexCount;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW); gl.useProgram(program);
      for (const [name, offset] of [['aPosition',0],['aNormal',12],['aColor',24]] as const) {
        const attribute = gl.getAttribLocation(program, name); if (attribute < 0) throw new Error('The illustrated view is available.');
        gl.enableVertexAttribArray(attribute); gl.vertexAttribPointer(attribute, 3, gl.FLOAT, false, 36, offset);
      }
      mvp = gl.getUniformLocation(program,'uMVP'); modelUniform = gl.getUniformLocation(program,'uModel');
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
      controls.current = {
        turn: (y, p = 0) => { rotating = false; setSpinning(false); yaw += y; pitch = clampRelicPitch(pitch + p); request(); },
        reset: () => { rotating = false; setSpinning(false); yaw = -.32; pitch = .94; request(); },
        spin: value => { rotating = value && !reduce; setSpinning(rotating); lastFrame = 0; request(); },
      };
      canvas.addEventListener('webglcontextlost',contextLost); canvas.addEventListener('webglcontextrestored',contextRestored);
      document.addEventListener('visibilitychange',visibility); media.addEventListener('change',updateMotion);
      rootChanges = new MutationObserver(updateMotion); rootChanges.observe(document.documentElement,{attributes:true,attributeFilter:['data-motion']});
      if (typeof ResizeObserver !== 'undefined') { resize = new ResizeObserver(request); resize.observe(canvas); }
      else window.addEventListener('resize',request);
      if (typeof IntersectionObserver !== 'undefined') { visible = false; intersection = new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); visibility(); }); intersection.observe(canvas); }
      setReady(true); request();
    } catch {
      setUnavailable(true); controls.current = null;
    }
    return () => {
      disposed = true; rotating = false; stopFrame(); controls.current = null; drag.current = null;
      resize?.disconnect(); intersection?.disconnect(); rootChanges?.disconnect();
      canvas.removeEventListener('webglcontextlost',contextLost); canvas.removeEventListener('webglcontextrestored',contextRestored);
      document.removeEventListener('visibilitychange',visibility); media.removeEventListener('change',updateMotion); window.removeEventListener('resize',request);
      if (gl) { if (buffer) gl.deleteBuffer(buffer); if (program) gl.deleteProgram(program); }
    };
  }, [motion, attempt]);
  const release = (event: PointerEvent<HTMLCanvasElement>) => {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return <div className="relic-inspection">
    <div className="relic-stage">
      {!ready && <CompassIllustration/>}
      <canvas ref={canvasRef} className={ready?'relic-canvas is-ready':'relic-canvas'} role="img" aria-label="A three-dimensional brass compass. Use the rotation buttons, drag sideways, or use the arrow keys to inspect it." aria-describedby={instructionsId} aria-hidden={!ready} tabIndex={ready?0:-1}
        onKeyDown={event => { if (!controls.current) return; if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key)) event.preventDefault(); if (event.key==='ArrowLeft') controls.current.turn(-.18); if (event.key==='ArrowRight') controls.current.turn(.18); if (event.key==='ArrowUp') controls.current.turn(0,.10); if (event.key==='ArrowDown') controls.current.turn(0,-.10); if (event.key==='Home') controls.current.reset(); }}
        onPointerDown={event => { if (!ready || !event.isPrimary || event.button!==0) return; drag.current = { id:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,touch:event.pointerType==='touch',committed:event.pointerType!=='touch' }; if (event.pointerType!=='touch') event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={event => { const state = drag.current; if (!state || state.id!==event.pointerId) return; const dx=event.clientX-state.startX,dy=event.clientY-state.startY; if (!state.committed) { if (Math.abs(dy)>Math.abs(dx)+5) { drag.current=null; return; } if (Math.abs(dx)<7 || Math.abs(dx)<Math.abs(dy)) return; state.committed=true; event.currentTarget.setPointerCapture(event.pointerId); } controls.current?.turn((event.clientX-state.x)*.009,state.touch?0:(event.clientY-state.y)*.006); state.x=event.clientX;state.y=event.clientY; }}
        onPointerUp={release} onPointerCancel={release} onLostPointerCapture={()=>{drag.current=null;}}/>
      <span className="relic-caption">THE WAYFINDER</span>
    </div>
    <p id={instructionsId} className="small muted">A compass for the next small step. Drag sideways to turn it; scrolling remains yours. Arrow keys tilt and turn. Home resets the view.</p>
    {ready?<div className="relic-controls" role="group" aria-label="Inspect the compass">
      <Button type="button" variant="ghost" onClick={()=>controls.current?.turn(-.3)}><MoveLeft size={16}/>Turn left</Button>
      <Button type="button" variant="ghost" onClick={()=>controls.current?.turn(.3)}>Turn right<MoveRight size={16}/></Button>
      <Button type="button" variant="ghost" onClick={()=>controls.current?.reset()}><RotateCcw size={16}/>Reset</Button>
      {!reduced&&<Button type="button" variant="ghost" aria-pressed={spinning} onClick={()=>controls.current?.spin(!spinning)}>{spinning?<Pause size={16}/>:<Play size={16}/>}<span>{spinning?'Pause turning':'Turn slowly'}</span></Button>}
    </div>:unavailable&&<div className="relic-fallback-note"><p className="small muted">The illustrated compass is shown on this device.</p><Button type="button" variant="ghost" onClick={()=>setAttempt(value=>value+1)}>Try the 3D view</Button></div>}
  </div>;
}
/** Entirely decorative. Inspecting it never changes eligibility, records or progression. */
export function RelicModel({ motion = 'system' }: { motion?: 'system' | 'reduced' | 'full' }) {
  const [open,setOpen] = useState(false);
  return <details className="relic-model" onToggle={event=>setOpen(event.currentTarget.open)}>
    <summary><span>Inspect the wayfinder<small>A small object, a closer look.</small></span><ChevronDown size={17}/></summary>
    {open&&<RelicStage motion={motion}/>}
  </details>;
}
