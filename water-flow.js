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
    weight *= .5;
  }
  return value;
}

// Возвратный гребень рождается у правой стенки, идёт влево и гаснет.
// Амплитуда обнуляется на обоих концах цикла, поэтому шва во времени нет.
float rebound(float x, float time) {
  float phase = fract(time * .20);
  float distance = (1. - x) - phase * .48;
  float life = pow(sin(phase * 3.141593), 2.);
  return exp(-distance*distance / .006) * life;
}

float centerline(float x) {
  return .09 + .68*x + .10*smoothstep(.68,1.,x);
}

float widthAt(float x) {
  return .115 + .20*x + .055*smoothstep(.72,1.,x);
}

float level(float x, float time) {
  return .63 + .025*sin(12.*x-time*1.5)
    + .025*sin(21.*x-time*2.1)
    + .17*smoothstep(.78,1.,x) + .10*rebound(x,time);
}

vec2 flowCoordinates(vec2 uv) {
  if (uFlow < 1.5) return vec2(uv.x, uv.y / level(uv.x,uTime));
  return vec2(uv.x, (uv.y-centerline(uv.x))/widthAt(uv.x));
}

float folds(vec2 p, float time) {
  vec2 warp = vec2(fbm(p*.72 + vec2(0., time*.025)),
                   fbm(p*.72 + vec2(4.2, 1.3)));
  p += warp*2.5;
  return fbm(p*1.7)*.85 + noise(p*4.3)*.025;
}

float surface(vec2 uv, float time) {
  vec2 q = flowCoordinates(uv);
  float aspect = clamp(uRes.x/uRes.y, .6, 4.5);
  vec2 along = vec2((q.x-time*.085)*aspect*1.5, q.y*2.1);
  vec2 back = vec2((2.-q.x-time*.085)*aspect*1.5, q.y*2.1);
  // Струя заворачивает у стенки. Верхняя часть движется обратно,
  // нижняя продолжает приходить слева, создавая складку в точке встречи.
  float curl = smoothstep(.62,1.,uv.x) * smoothstep(.0,.8,q.y);
  float h = mix(folds(along,time), folds(back,time), curl*.85);
  h += rebound(uv.x-.045*q.y*q.y,time) * .23 * exp(-pow(q.y-.4,2.)*2.);
  return h;
}

void main() {
  vec2 uv = gl_FragCoord.xy/uRes;
  vec2 q = flowCoordinates(uv);
  float h = surface(uv,uTime);
  float aspect = uRes.x/uRes.y;
  vec2 e = vec2(.002/aspect,.002);
  float hx = surface(uv+vec2(e.x,0.),uTime);
  float hy = surface(uv+vec2(0.,e.y),uTime);
  vec3 normal = normalize(vec3((h-hx)/e.x*.025, (h-hy)/e.y*.025, 1.));

  float mask;
  float rim;
  if (uFlow < 1.5) {
    float edge = level(uv.x,uTime) + (h-.35)*.025;
    mask = 1.-smoothstep(edge-.018,edge+.008,uv.y);
    rim = exp(-pow((uv.y-edge+.014)/.016,2.));
  } else {
    float edge = abs(q.y + (h-.35)*.16 - .24*rebound(uv.x,uTime));
    mask = 1.-smoothstep(.82,1.03,edge);
    rim = exp(-pow((edge-.86)/.06,2.));
  }

  // Тот же мятный материал, что у hero: цвет даёт поглощение света
  // в толще, а соседние светлые и тёмные складки создают объём.
  vec3 light = normalize(vec3(-.45,.6,.7));
  float diffuse = max(dot(normal,light),0.);
  float highlight = pow(max(dot(normal,normalize(light+vec3(0.,0.,1.))),0.),45.);
  float depth = .13 + .22*clamp(h+.2,0.,1.) + .10*max(-normal.y,0.);
  depth += .05*rebound(uv.x,uTime);
  vec3 transmittance = exp(-vec3(3.,1.,1.36)*depth);
  vec3 color = vec3(.957,.973,.965)*transmittance*(.88+.12*diffuse);
  color += vec3(.86,1.,.96) * (highlight*.12 + rim*.14);
  // Возвращающийся гребень имеет светлый срез и более глубокую изнанку.
  // Оба следуют той же кривой и исчезают вместе с возвратной волной.
  float backCrest = rebound(uv.x-.045*q.y*q.y,uTime);
  float backShade = rebound(uv.x-.045*q.y*q.y-.024,uTime);
  float backBand = exp(-pow(q.y-.4,2.)*2.);
  color *= 1.-backShade*backBand*.12;
  color += vec3(.65,.95,.84)*max(backCrest-backShade,0.)*backBand*.32;
  // Тонкая каустическая нить, а не сплошная белая полоса.
  color += vec3(.46,.90,.77) * pow(max(sin(h*42.),0.),18.)*.07;
  float alpha = mask * (.82+.12*clamp(h,0.,1.));
  gl_FragColor = vec4(color,alpha);
}
`;
