/* Жидкость внутри плашек. Общий renderer в water.js отвечает за размер,
   видимость и reduced motion; здесь только геометрия и материал потока.
   uFlow: 1 — нижний бассейн, 2 — восходящий поток в шапке цен. */
window.PortfolioFlowShader = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uFlow;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 s = f*f*f*(f*(f*6.0-15.0)+10.0);
  return mix(mix(hash(i), hash(i+vec2(1.,0.)), s.x),
             mix(hash(i+vec2(0.,1.)), hash(i+vec2(1.,1.)), s.x), s.y);
}

float fbm(vec2 p) {
  float value = 0., weight = .5;
  for (int i=0; i<4; i++) {
    value += weight * noise(p);
    p = mat2(1.6,1.2,-1.2,1.6) * p;
    weight *= .42;
  }
  return value;
}

// Широкий вал набегает на стенку, замедляется и возвращается внутрь.
// Скруглённый разворот и нулевая амплитуда на концах скрывают цикл.
float rebound(float x, float time) {
  float phase = fract(time * .065);
  float travel = phase * 1.12 - .36;
  float crest = 1. - (sqrt(travel*travel + .0025) - .05);
  float distance = x - crest;
  float life = pow(sin(phase * 3.141593), 2.);
  return exp(-distance*distance / .018) * life;
}

float centerline(float x) {
  // Подъём выполаживается у стенки: поток собирается под верхним краем.
  return .09 + .65*smoothstep(0.,1.,x);
}

float widthAt(float x) {
  return .115 + .15*smoothstep(0.,1.,x);
}

float level(float x, float time) {
  return .63 + .018*sin(7.*x-time*.38)
    + .012*sin(10.*x-time*.29)
    + .10*smoothstep(.72,1.,x) + .065*rebound(x,time);
}

vec2 flowCoordinates(vec2 uv) {
  if (uFlow < 1.5) return vec2(uv.x, uv.y / level(uv.x,uTime));
  float lift = .035*sin(5.*uv.x-uTime*.32) + .035*rebound(uv.x,uTime);
  return vec2(uv.x, (uv.y-centerline(uv.x)-lift)/widthAt(uv.x));
}

vec2 materialCoordinates(vec2 q, float time) {
  // Складки набегают вправо, верхний слой отзывается обратной волной.
  // Смещение ограничено и обнуляется у стенок, не накапливая растяжение.
  float turn = smoothstep(.15,.85,q.y);
  float drift = time*.24;
  float incoming = sin(4.*q.x-drift);
  float returning = sin(4.*q.x+drift);
  float x = q.x + .12*sin(3.141593*q.x)*mix(incoming,returning,turn);
  float aspect = clamp(uRes.x/uRes.y, .6, 4.5);
  return vec2(x*aspect*.75, q.y*1.6 - 2.);
}

void main() {
  vec2 uv = gl_FragCoord.xy/uRes;
  vec2 q = flowCoordinates(uv);
  vec2 p = materialCoordinates(q,uTime);
  vec2 warp = vec2(fbm(p*.8-uTime*.004), fbm(p*.8+vec2(4.2,1.3)-uTime*.004));
  p += warp*2.;
  // Как на первом экране, общий плавный warp для соседних выборок:
  // нормаль описывает широкие складки, без рваной мелкой фактуры.
  float e = .008;
  float h = fbm(p);
  float hx = fbm(p+vec2(e,0.));
  float hy = fbm(p+vec2(0.,e));
  float backCrest = rebound(uv.x-.025*q.y*q.y,uTime);
  float backShade = rebound(uv.x-.025*q.y*q.y-.07,uTime);
  float backBand = exp(-pow(q.y-.45,2.)*1.5);
  vec2 grad = vec2(h-hx,h-hy)/e;
  grad.y += (backCrest-backShade)*backBand*.55;
  vec3 normal = normalize(vec3(grad*.55,1.));

  float mask;
  float rim;
  if (uFlow < 1.5) {
    float edge = level(uv.x,uTime) + (h-.35)*.045;
    mask = 1.-smoothstep(edge-.045,edge+.02,uv.y);
    rim = exp(-pow((uv.y-edge+.035)/.055,2.));
  } else {
    float edge = abs(q.y + (h-.35)*.24 - .10*backCrest);
    mask = 1.-smoothstep(.72,1.12,edge);
    rim = exp(-pow((edge-.83)/.18,2.));
  }

  // Тот же мятный материал, что у hero: цвет даёт поглощение света
  // в толще, а соседние светлые и тёмные складки создают объём.
  vec3 light = normalize(vec3(-.45,.6,.7));
  float diffuse = max(dot(normal,light),0.);
  float highlight = pow(max(dot(normal,normalize(light+vec3(0.,0.,1.))),0.),14.);
  float depth = .065 + .14*clamp(h+.2,0.,1.) + .07*max(-normal.y,0.);
  depth += .025*backCrest;
  vec3 transmittance = exp(-vec3(3.,1.,1.36)*depth);
  vec3 color = vec3(.957,.973,.965)*transmittance*(.88+.12*diffuse);
  color += vec3(.86,1.,.96) * (highlight*.085 + rim*.035);
  // Возвращающийся гребень имеет светлый срез и более глубокую изнанку.
  // Оба следуют той же кривой и исчезают вместе с возвратной волной.
  color *= 1.-backShade*backBand*.055;
  color += vec3(.65,.95,.84)*max(backCrest-backShade,0.)*backBand*.10;
  float alpha = mask * (.62+.10*clamp(h,0.,1.));
  // Renderer использует premultipliedAlpha: прозрачная вода не должна
  // добавлять белую засветку поверх фона и текста.
  gl_FragColor = vec4(clamp(color,0.,1.)*alpha,alpha);
}
`;
