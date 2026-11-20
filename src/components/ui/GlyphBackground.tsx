import { useEffect, useRef } from "react";

const VERTEX_SHADER = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;
uniform sampler2D atlas;
uniform vec2 size;
uniform vec2 cell;
uniform float dpr;
uniform float time;
uniform float rest;
uniform float haze;
uniform float hoverInk;
uniform vec3 pointer;
uniform float activity;
uniform vec2 drift;
uniform vec3 color;
uniform vec3 accent;
uniform vec4 waves[12];
uniform vec4 trail[8];

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float smoothNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float outline(float kind, float angle, float phase) {
  if (kind < 0.5) return 1.0;
  if (kind < 1.5) {
    float s = sin(angle);
    float c = cos(angle);
    return (2.0 - 2.0 * s + s * sqrt(abs(c)) / (s + 1.4)) * 0.42;
  }
  return 1.0 + 0.14 * sin(3.0 * angle + phase) + 0.08 * sin(5.0 * angle - phase * 1.3);
}

void main() {
  vec2 pixel = vec2(gl_FragCoord.x, size.y - gl_FragCoord.y);
  vec2 index = floor(pixel / cell);
  vec2 point = (index + 0.5) * cell / dpr;

  float ring = 0.0;
  for (int i = 0; i < 6; i++) {
    vec4 a = waves[i * 2];
    vec4 b = waves[i * 2 + 1];
    if (a.w <= 0.0) continue;
    vec2 v = point - a.xy;
    float angle = atan(-v.y, v.x);
    float shape = mix(1.0, outline(b.x, angle, b.z), b.y);
    shape *= 1.0 + 0.07 * sin(3.0 * angle + b.z + b.w) + 0.05 * sin(5.0 * angle - b.z * 1.7 - b.w * 1.3) + 0.03 * sin(9.0 * angle + b.w * 2.1);
    float d = length(v) - a.z * shape;
    float k = d > 0.0 ? d / 14.0 : d / 42.0;
    ring = max(ring, exp(-k * k) * a.w);
  }

  float focus = length((point - pointer.xy) / vec2(86.0, 48.0));
  float hover = pointer.z * (1.0 - smoothstep(0.12, 1.0, focus));
  for (int i = 0; i < 8; i++) {
    vec4 t = trail[i];
    if (t.w <= 0.0) continue;
    vec2 v = point - t.xy;
    hover += t.w * exp(-dot(v, v) / (2.0 * t.z * t.z));
  }
  hover = min(hover, 1.0);

  mat2 turn = mat2(0.82, 0.57, -0.57, 0.82);
  vec2 q = turn * (point - drift);
  float blob = smoothNoise(vec2(q.x / 140.0, q.y / 80.0) + vec2(time * 0.04, 0.0)) * 0.62
    + smoothNoise(vec2(q.x / 62.0, q.y / 36.0) + vec2(3.7, time * 0.06)) * 0.38;
  float grain = smoothNoise(vec2(q.x / 30.0, q.y / 14.0) + vec2(time * 0.2, 7.3));
  float cloud = blob * (0.82 + 0.24 * grain);
  float mask = pow(smoothstep(0.47 - 0.2 * activity, 0.84, cloud), 2.6);

  float ink = texture2D(atlas, pixel / size).a;

  vec2 viewport = size / dpr;
  vec2 patchSize = vec2(min(110.0, viewport.x * 0.23), 38.0);
  vec2 a = (point - viewport * vec2(0.16, 0.22)) / patchSize;
  vec2 b = (point - viewport * vec2(0.83, 0.36)) / patchSize;
  vec2 c = (point - viewport * vec2(0.22, 0.77)) / patchSize;
  vec2 d = (point - viewport * vec2(0.84, 0.82)) / patchSize;
  float idle = max(
    max(exp(-dot(a, a)) * (0.8 + 0.15 * sin(time * 0.18)),
        exp(-dot(b, b)) * (0.8 + 0.15 * sin(time * 0.18 + 1.6))),
    max(exp(-dot(c, c)) * (0.8 + 0.15 * sin(time * 0.18 + 3.2)),
        exp(-dot(d, d)) * (0.8 + 0.15 * sin(time * 0.18 + 4.8)))
  );

  float grey = ink * clamp(rest + 0.075 * idle + haze * mask * (1.0 + 0.3 * activity) + hoverInk * hover * (0.9 + 0.1 * mask), 0.0, 1.0);
  float blue = ink * ring * 0.10;
  float alpha = grey + blue - grey * blue;
  vec3 tint = color * grey * (1.0 - blue) + accent * blue;
  gl_FragColor = vec4(tint, alpha);
}
`;

type Stamp = { x: number; y: number; at: number };

type GlyphBackgroundProps = {
  code: string;
  fontSize?: number;
  interactive?: boolean;
  className?: string;
};

/**
 * Interactive WebGL code backdrop (matches aswinpanengal.me):
 * renders multi-column code into an alpha atlas, then illuminates glyphs via
 * quiet ambient islands, drifting haze, cursor spotlight + motion trail, and click ripples.
 */
export function GlyphBackground({
  code,
  fontSize = 12,
  interactive = true,
  className = "",
}: GlyphBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
    });
    if (!gl) return;

    const shaders: WebGLShader[] = [];
    const compile = (type: number, source: string) => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      shaders.push(sh);
      gl.shaderSource(sh, source);
      gl.compileShader(sh);
      return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
    };

    const vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!vs || !fs || !program) {
      shaders.forEach((sh) => gl.deleteShader(sh));
      if (program) gl.deleteProgram(program);
      return;
    }

    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      shaders.forEach((sh) => gl.deleteShader(sh));
      gl.deleteProgram(program);
      return;
    }

    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const u = {
      atlas: gl.getUniformLocation(program, "atlas"),
      size: gl.getUniformLocation(program, "size"),
      cell: gl.getUniformLocation(program, "cell"),
      dpr: gl.getUniformLocation(program, "dpr"),
      time: gl.getUniformLocation(program, "time"),
      rest: gl.getUniformLocation(program, "rest"),
      haze: gl.getUniformLocation(program, "haze"),
      hoverInk: gl.getUniformLocation(program, "hoverInk"),
      pointer: gl.getUniformLocation(program, "pointer"),
      activity: gl.getUniformLocation(program, "activity"),
      drift: gl.getUniformLocation(program, "drift"),
      color: gl.getUniformLocation(program, "color"),
      accent: gl.getUniformLocation(program, "accent"),
      waves: gl.getUniformLocation(program, "waves[0]"),
      trail: gl.getUniformLocation(program, "trail[0]"),
    };

    gl.uniform1i(u.atlas, 0);
    gl.uniform1f(u.rest, 0.025);
    gl.uniform1f(u.haze, 0.08);
    gl.uniform1f(u.hoverInk, 0.38);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const atlasCanvas = document.createElement("canvas");
    const atlasCtx = atlasCanvas.getContext("2d");
    const colorCtx = document.createElement("canvas").getContext("2d");

    let width = 0;
    let height = 0;
    let dpr = 1;
    let elapsed = 0;
    let rafId = 0;
    let lastFrame = 0;
    let visible = false;
    let destroyed = false;
    let contextLost = false;
    let localPointer: { x: number; y: number } | null = null;
    let clientPointer: { x: number; y: number } | null = null;
    let waves: Stamp[] = [];
    let trail: Stamp[] = [];
    const waveBuf = new Float32Array(48);
    const trailBuf = new Float32Array(32);

    const syncThemeColor = () => {
      if (!colorCtx) return;
      colorCtx.fillStyle = getComputedStyle(container).color;
      colorCtx.fillRect(0, 0, 1, 1);
      const rgba = colorCtx.getImageData(0, 0, 1, 1).data;
      gl.uniform3f(u.color, rgba[0] / 255, rgba[1] / 255, rgba[2] / 255);
      gl.uniform3f(u.accent, rgba[0] / 255, rgba[1] / 255, rgba[2] / 255);
    };

    const draw = () => {
      if (destroyed || contextLost || !width || !height) return;

      waveBuf.fill(0);
      waves = waves.filter((w) => elapsed - w.at < 4);
      waves.forEach((w, idx) => {
        const dt = elapsed - w.at;
        const fade = Math.min(1, dt / 0.08) * Math.exp(-dt / 1.3) * Math.min(1, (4 - dt) / 0.5);
        waveBuf.set([w.x, w.y, (420 * dt) / (1 + 0.4 * dt), fade, 0, 0, 0, 0], idx * 8);
      });

      trailBuf.fill(0);
      trail = trail.filter((t) => elapsed - t.at < 0.45);
      trail.forEach((t, idx) => {
        const p = (elapsed - t.at) / 0.45;
        trailBuf.set([t.x, t.y, 28, 0.18 * (1 - p) ** 2], idx * 4);
      });

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(u.size, canvas.width, canvas.height);
      gl.uniform2f(u.cell, 8 * dpr, 18 * dpr);
      gl.uniform1f(u.dpr, dpr);
      gl.uniform1f(u.time, elapsed);
      gl.uniform3f(u.pointer, localPointer?.x ?? -1000, localPointer?.y ?? -1000, localPointer ? 1 : 0);
      gl.uniform1f(u.activity, trail.length / 8);
      gl.uniform2f(u.drift, -8 * elapsed, 4 * elapsed);
      gl.uniform4fv(u.waves, waveBuf);
      gl.uniform4fv(u.trail, trailBuf);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const rebuildAtlas = () => {
      if (destroyed || contextLost || !atlasCtx) return;
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(15e5 / Math.max(1, width * height)));
      canvas.width = atlasCanvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = atlasCanvas.height = Math.max(1, Math.round(height * dpr));

      atlasCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      atlasCtx.clearRect(0, 0, width, height);
      atlasCtx.fillStyle = "white";
      atlasCtx.font = `400 ${fontSize}px ${getComputedStyle(container).fontFamily}`;
      atlasCtx.textBaseline = "top";

      const lineH = 1.7 * fontSize;
      const rows = Math.ceil(height / lineH);
      const cols = Math.max(1, Math.floor(width / 370));
      const colW = width / cols;
      const maxLineW = Math.max(1, colW - 40);

      const wrapped = code.split("\n").flatMap((raw) => {
        const out: string[] = [];
        let line = raw;
        let cont = false;
        while (line && atlasCtx.measureText(`${cont ? "  " : ""}${line}`).width > maxLineW) {
          const pad = cont ? "  " : "";
          let cut = line.length;
          while (cut > 1 && atlasCtx.measureText(pad + line.slice(0, cut)).width > maxLineW) {
            cut -= 1;
          }
          const space = line.lastIndexOf(" ", cut);
          if (space > cut / 2) cut = space;
          out.push(pad + line.slice(0, cut));
          line = line.slice(cut).trimStart();
          cont = true;
        }
        return [...out, `${cont && line ? "  " : ""}${line}`];
      });

      for (let col = 0; col < cols; col += 1) {
        atlasCtx.save();
        atlasCtx.beginPath();
        atlasCtx.rect(col * colW + 20, 0, colW - 40, height);
        atlasCtx.clip();
        const topOffset = width <= 700 ? 112 : 12;
        for (let r = 0; r < rows; r += 1) {
          atlasCtx.fillText(wrapped[(r + col * rows) % wrapped.length], col * colW + 20, topOffset + r * lineH);
        }
        atlasCtx.restore();
      }

      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasCanvas);
      syncThemeColor();
      draw();
      container.dataset.renderer = "webgl";
    };

    const tick = (now: number) => {
      if (now - lastFrame >= 1000 / 30) {
        elapsed += lastFrame ? Math.min((now - lastFrame) / 1000, 0.064) : 0;
        lastFrame = now;
        draw();
      }
      rafId = requestAnimationFrame(tick);
    };

    const updatePlayback = () => {
      cancelAnimationFrame(rafId);
      rafId = 0;
      lastFrame = 0;
      const shouldRun = visible && !document.hidden && !reducedMotion.matches && !contextLost;
      container.dataset.animated = String(shouldRun);
      if (shouldRun) {
        rafId = requestAnimationFrame(tick);
      } else {
        waves = [];
        trail = [];
        if (!visible || document.hidden) localPointer = null;
        if (visible && !document.hidden) draw();
      }
    };

    const toLocal = (e: PointerEvent): Stamp => {
      const rect = container.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top, at: elapsed };
    };

    const updatePointerFromScroll = () => {
      const rect = container.getBoundingClientRect();
      const x = (clientPointer?.x ?? -1000) - rect.left;
      const y = (clientPointer?.y ?? -1000) - rect.top;
      localPointer =
        clientPointer && x >= 0 && x <= rect.width && y >= 0 && y <= rect.height ? { x, y } : null;
      if (reducedMotion.matches) draw();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!interactive || !visible) return;
      clientPointer = e.pointerType === "touch" ? null : { x: e.clientX, y: e.clientY };
      updatePointerFromScroll();
      if (reducedMotion.matches) {
        draw();
        return;
      }
      const pt = toLocal(e);
      const prev = trail.at(-1);
      if (
        pt.x < 0 ||
        pt.x > width ||
        pt.y < 0 ||
        pt.y > height ||
        (prev && Math.hypot(pt.x - prev.x, pt.y - prev.y) < 14)
      ) {
        return;
      }
      trail = [...trail.slice(-7), pt];
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!interactive || reducedMotion.matches || !visible) return;
      const pt = toLocal(e);
      if (pt.x >= 0 && pt.x <= width && pt.y >= 0 && pt.y <= height) {
        waves = [...waves.slice(-5), pt];
      }
    };

    const clearPointer = () => {
      clientPointer = null;
      localPointer = null;
      if (reducedMotion.matches) draw();
    };

    const onContextLost = () => {
      contextLost = true;
      container.dataset.renderer = "fallback";
      updatePlayback();
    };

    const ro = new ResizeObserver(rebuildAtlas);
    ro.observe(container);

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      updatePlayback();
    });
    io.observe(container);

    const mo = new MutationObserver(() => {
      syncThemeColor();
      draw();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    window.addEventListener("pointermove", onPointerMove, { passive: true, capture: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true, capture: true });
    window.addEventListener("scroll", updatePointerFromScroll, { passive: true });
    window.addEventListener("blur", clearPointer);
    document.documentElement.addEventListener("pointerleave", clearPointer);
    canvas.addEventListener("webglcontextlost", onContextLost);
    reducedMotion.addEventListener("change", updatePlayback);
    document.addEventListener("visibilitychange", updatePlayback);

    rebuildAtlas();
    document.fonts?.ready.then(() => {
      if (!destroyed) rebuildAtlas();
    });

    return () => {
      destroyed = true;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", updatePointerFromScroll);
      window.removeEventListener("blur", clearPointer);
      document.documentElement.removeEventListener("pointerleave", clearPointer);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      reducedMotion.removeEventListener("change", updatePlayback);
      document.removeEventListener("visibilitychange", updatePlayback);
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      shaders.forEach((sh) => gl.deleteShader(sh));
    };
  }, [code, fontSize, interactive]);

  return (
    <div
      ref={containerRef}
      className={`glyph-background ${className}`}
      data-slot="glyph-background"
      aria-hidden="true"
    >
      <pre className="glyph-code-fallback">{code}</pre>
      <canvas ref={canvasRef} />
    </div>
  );
}
