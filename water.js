/* ============================================================
   Течение — WebGL

   Поверхность считается как поле высот: домен-варпинг фрактального
   шума даёт складки, из градиента поля строится нормаль, по нормали
   — затенение и блик. Поэтому это читается как жидкость, а не туман.

   Три особенности:
   · домен растянут вдоль направления волны — волны получаются длинными
   · разрешение рендера подстраивается под реальный FPS
   · курсор мягко расталкивает поверхность в радиусе ~2 см
   ============================================================ */
(function () {
  'use strict';

  var canvases = document.querySelectorAll('canvas.water');
  if (!canvases.length) return;

  // Радиус плато под курсором — 3 см при 96 dpi. Задан в физических
  // единицах осознанно: «три сантиметра» не должно зависеть от диагонали.
  var PX_PER_CM = 96 / 2.54;
  var RADIUS_CSS_PX = 3 * PX_PER_CM;

  var VERT = [
    'attribute vec2 aPos;',
    'void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  var FRAG = [
    'precision highp float;',
    'uniform vec2  uRes;',
    'uniform float uTime;',
    'uniform float uDark;',
    'uniform vec2  uMouse;',
    'uniform float uMouseAmt;',
    'uniform float uRadius;',

    'float hash(vec2 p){',
    '  p = fract(p * vec2(123.34, 456.21));',
    '  p += dot(p, p + 45.32);',
    '  return fract(p.x * p.y);',
    '}',

    // квинтическая интерполяция вместо кубической: убирает решётчатость,
    // которая на пологих градиентах читается как сетка
    'float noise(vec2 p){',
    '  vec2 i = floor(p), f = fract(p);',
    '  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);',
    '  float a = hash(i);',
    '  float b = hash(i + vec2(1.0, 0.0));',
    '  float c = hash(i + vec2(0.0, 1.0));',
    '  float d = hash(i + vec2(1.0, 1.0));',
    '  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);',
    '}',

    'float fbm4(vec2 p){',
    '  float v = 0.0, a = 0.5;',
    '  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);',
    '  for (int i = 0; i < 4; i++){ v += a * noise(p); p = m * p; a *= 0.52; }',
    '  return v;',
    '}',

    // Смещение домена считается ОДИН раз и переиспользуется для всех
    // трёх выборок высоты: оно низкочастотное и на масштабе производной
    // не меняется. Это втрое дешевле полного пересчёта поля.
    //
    // Сила варпа полная — именно он создаёт крупную структуру и контраст.
    // Хаос давал не он, а время, входившее сюда с противоположными
    // знаками: поле кипело на месте. Теперь время здесь одно и очень
    // медленное, а двигает картину единый снос в main().
    'vec2 warpOffset(vec2 p, float t){',
    '  vec2 q = vec2(fbm4(p), fbm4(p + vec2(4.2, 1.3)));',
    '  vec2 r = vec2(fbm4(p + 2.1 * q + vec2(1.7, 9.2) + t * 0.06),',
    '                fbm4(p + 2.1 * q + vec2(8.3, 2.8) + t * 0.05));',
    '  return 2.0 * r;',
    '}',

    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / uRes;',
    '  float asp = uRes.x / uRes.y;',
    '  vec2 p = uv * vec2(asp, 1.0) * 2.9;',
    '  float t = uTime * 0.15;',

    // Направление потока. Всё поле сносится вдоль него как одно целое —
    // отсюда ощущение цельной струи, а не разнонаправленной толчеи.
    //
    // Скорость потока. Единица поля p равна H/2.9 экранных пикселей,
    // снос идёт со скоростью 0.15*K единиц в секунду — то есть ровно
    // 61*K пикселей в секунду, одинаково на любом разрешении.
    // K = 0.5 -> ~30 px/с: гребень проходит собственную длину за ~13 с.
    // Это единственная ручка скорости течения.
    '  vec2 dir = normalize(vec2(0.94, 0.34));',
    '  p -= dir * (t * 0.5);',

    // Поворот в систему потока и сжатие вдоль него: изотропный шум
    // вытягивается в длинные гребни, идущие по течению.
    '  mat2 R = mat2(dir.x, dir.y, -dir.y, dir.x);',
    '  vec2 ps = R * p;',
    '  ps.x *= 0.40;',

    /* ---------- курсор: плато и вал по его кромке ---------- */
    '  vec2 md = gl_FragCoord.xy - uMouse;',
    '  float r = length(md);',
    '  vec2 rdir = r > 0.0001 ? md / r : vec2(0.0);',
    '  float R0 = max(uRadius, 1.0);',

    // плато: внутри радиуса вода спокойная и плоская
    '  float plateau = (1.0 - smoothstep(R0 * 0.55, R0 * 0.98, r)) * uMouseAmt;',

    // вал: мягкий подъём по кромке плато, к центру и вдаль сходит в нуль
    '  float xr = (r - R0) / (R0 * 0.52);',
    '  float ring = exp(-xr * xr) * uMouseAmt;',

    // Поток обтекает плато: смещение максимально на кромке и нулевое
    // в центре — поэтому больше нет стягивания в точку курсора.
    '  ps -= R * rdir * ring * 0.38;',

    '  vec2 wo = warpOffset(ps, t);',
    '  float e = 0.006;',
    '  float h  = fbm4(ps + wo);',
    '  float hx = fbm4(ps + vec2(e, 0.0) + wo);',
    '  float hy = fbm4(ps + vec2(0.0, e) + wo);',

    // Растяжение домена ради длинных волн срезает контраст поля почти
    // вдвое. Возвращаем усилением вокруг среднего fbm — заодно круче
    // становятся нормали, то есть возвращаются и блики.
    '  const float GAIN = 2.20;',
    '  const float MID  = 0.48;',
    '  h  = (h  - MID) * GAIN + MID;',
    '  hx = (hx - MID) * GAIN + MID;',
    '  hy = (hy - MID) * GAIN + MID;',

    '  vec3 n = normalize(vec3((h - hx) / e, (h - hy) / e, 3.2));',

    // Внутри плато нормаль выпрямляется: рябь и блики гаснут, остаётся
    // спокойная гладь. Цвет при этом сохраняется — это не наклейка.
    '  n = normalize(mix(n, vec3(0.0, 0.0, 1.0), plateau * 0.90));',
    '  h = mix(h, MID, plateau * 0.42);',

    // Наклон вала считаем аналитически: у радиально-симметричного
    // гауссова горба производная известна, отдельные выборки не нужны.
    '  float dRing = exp(-xr * xr) * (-2.0 * xr) / (R0 * 0.52) * uMouseAmt;',
    '  n = normalize(vec3(n.xy + rdir * dRing * 115.0, n.z));',
    '  h += ring * 0.095;',

    '  vec3 L = normalize(vec3(-0.48, 0.55, 0.68));',
    '  float diff = clamp(dot(n, L) * 0.5 + 0.5, 0.0, 1.0);',
    '  vec3 hv = normalize(L + vec3(0.0, 0.0, 1.0));',
    '  float sp = clamp(dot(n, hv), 0.0, 1.0);',
    '  float spec  = pow(sp, 26.0);',
    '  float spec2 = pow(sp, 80.0);',

    '  float dens = clamp(smoothstep(0.33, 0.74, h), 0.0, 1.0);',

    '  vec3 l1 = vec3(0.980, 0.994, 0.990);',
    '  vec3 l2 = vec3(0.859, 0.937, 0.918);',
    '  vec3 l3 = vec3(0.545, 0.804, 0.749);',
    '  vec3 l4 = vec3(0.196, 0.522, 0.447);',
    '  vec3 lc = mix(l1, l2, smoothstep(0.02, 0.36, dens));',
    '  lc = mix(lc, l3, smoothstep(0.32, 0.72, dens));',
    '  lc = mix(lc, l4, smoothstep(0.70, 1.00, dens) * 0.80);',
    '  lc *= 0.84 + 0.30 * diff;',
    '  lc += spec * 0.34 + spec2 * 0.46;',

    '  vec3 d1 = vec3(0.031, 0.122, 0.098);',
    '  vec3 d2 = vec3(0.051, 0.212, 0.173);',
    '  vec3 d3 = vec3(0.090, 0.373, 0.306);',
    '  vec3 d4 = vec3(0.325, 0.663, 0.573);',
    '  vec3 dc = mix(d1, d2, smoothstep(0.02, 0.40, dens));',
    '  dc = mix(dc, d3, smoothstep(0.36, 0.76, dens));',
    '  dc = mix(dc, d4, smoothstep(0.70, 1.00, dens) * 0.66);',
    '  dc *= 0.80 + 0.36 * diff;',
    '  dc += spec * 0.20 + spec2 * 0.34;',

    '  vec3 col = mix(lc, dc, uDark);',

    '  float lift = smoothstep(0.02, 0.54, uv.x);',
    '  float fade = smoothstep(0.0, 0.26, uv.y);',
    '  float body = 0.42 + 0.58 * dens;',
    '  float alpha = mix(clamp(0.14 + 0.86 * lift, 0.0, 1.0) * fade * body, 1.0, uDark);',

    // Дизеринг. На пологих светлых градиентах 8 бит на канал дают
    // видимые ступени; шум в пол-единицы младшего разряда их размывает.
    '  float dth = (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0;',
    '  col += dth;',

    '  gl_FragColor = vec4(col, alpha);',
    '}'
  ].join('\n');

  Array.prototype.forEach.call(canvases, init);

  function init(canvas) {
    var gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false })
          || canvas.getContext('experimental-webgl', { alpha: true, antialias: false });

    if (!gl) { document.documentElement.classList.add('no-webgl'); return; }

    var dark = canvas.dataset.tone === 'dark' ? 1.0 : 0.0;

    function compile(type, src) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.warn('water shader:', gl.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    }

    var vs = compile(gl.VERTEX_SHADER, VERT);
    var fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { document.documentElement.classList.add('no-webgl'); return; }

    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      document.documentElement.classList.add('no-webgl');
      return;
    }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    var uRes = gl.getUniformLocation(prog, 'uRes');
    var uTime = gl.getUniformLocation(prog, 'uTime');
    var uMouse = gl.getUniformLocation(prog, 'uMouse');
    var uMouseAmt = gl.getUniformLocation(prog, 'uMouseAmt');
    var uRadius = gl.getUniformLocation(prog, 'uRadius');
    gl.uniform1f(gl.getUniformLocation(prog, 'uDark'), dark);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Разрешение: целимся в физические пиксели экрана, но при просадке
    // FPS опускаемся по ступеням. Красиво по умолчанию, плавно на слабом.
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var STEPS = [1.0, 0.8, 0.62, 0.48, 0.36];
    // На телефоне стартуем со сниженной ступени: там DPR 3, слабая GPU,
    // и первые секунды на полном разрешении заметно тормозят. Если
    // железо тянет, цикл сам поднимет качество обратно через ~4 секунды.
    var lean = window.innerWidth < 820 || (navigator.hardwareConcurrency || 8) <= 4;
    var step = lean ? 2 : 0;
    var scale = dpr * STEPS[step];

    function resize() {
      var w = Math.max(1, Math.round(canvas.clientWidth * scale));
      var h = Math.max(1, Math.round(canvas.clientHeight * scale));
      if (canvas.width === w && canvas.height === h) return;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uRadius, RADIUS_CSS_PX * scale);
    }

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var visible = true;
    var raf = null;
    var start = performance.now() - (dark ? 41000 : 0);

    /* ---------- курсор ---------- */
    // Цель и текущее положение разведены: курсор прыгает по пикселям,
    // а вода должна догонять его плавно, иначе бугор дёргается.
    var tgX = -9999, tgY = -9999, curX = -9999, curY = -9999;
    var tgAmt = 0, curAmt = 0;
    var pointerFine = window.matchMedia('(pointer: fine)').matches;

    function onMove(ev) {
      var r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var x = ev.clientX - r.left;
      var y = ev.clientY - r.top;
      var inside = x >= -60 && y >= -60 && x <= r.width + 60 && y <= r.height + 60;
      tgAmt = inside ? 1 : 0;
      if (!inside) return;
      // в пиксели рендера, с переворотом Y: у WebGL начало снизу
      tgX = x * (canvas.width / r.width);
      tgY = (r.height - y) * (canvas.height / r.height);
      if (curX < -9000) { curX = tgX; curY = tgY; }
    }

    if (pointerFine && !reduced) {
      window.addEventListener('mousemove', onMove, { passive: true });
      window.addEventListener('mouseout', function (e) { if (!e.relatedTarget) tgAmt = 0; }, { passive: true });
    }

    /* ---------- цикл ---------- */
    var slow = 0, fast = 0, prev = 0;

    function frame(now) {
      resize();

      // догон курсора и плавное угасание влияния
      curX += (tgX - curX) * 0.16;
      curY += (tgY - curY) * 0.16;
      curAmt += (tgAmt - curAmt) * 0.07;
      gl.uniform2f(uMouse, curX, curY);
      gl.uniform1f(uMouseAmt, curAmt);

      gl.uniform1f(uTime, (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // Ступенчатая деградация: 12 тяжёлых кадров подряд — снижаем
      // разрешение; 240 лёгких — пробуем вернуть обратно.
      if (prev) {
        var dt = now - prev;
        if (dt > 26) { slow++; fast = 0; } else if (dt < 19) { fast++; slow = 0; }
        if (slow > 12 && step < STEPS.length - 1) {
          step++; scale = dpr * STEPS[step]; slow = 0;
          canvas.width = 0; resize();
        } else if (fast > 240 && step > 0) {
          step--; scale = dpr * STEPS[step]; fast = 0;
          canvas.width = 0; resize();
        }
      }
      prev = now;

      raf = visible ? requestAnimationFrame(frame) : null;
    }

    function play() { if (raf === null && visible) { prev = 0; raf = requestAnimationFrame(frame); } }
    function stop() { if (raf !== null) { cancelAnimationFrame(raf); raf = null; } }

    if (reduced) {
      resize();
      gl.uniform2f(uMouse, -9999, -9999);
      gl.uniform1f(uMouseAmt, 0);
      gl.uniform1f(uTime, 12.0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } else {
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          visible = entries[0].isIntersecting;
          if (visible) play(); else stop();
        }, { rootMargin: '120px' }).observe(canvas);
      }
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) stop(); else play();
      });
      window.addEventListener('resize', resize, { passive: true });
      play();
    }

    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      stop();
      document.documentElement.classList.add('no-webgl');
    });
  }
})();
