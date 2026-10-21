/** Sunny Palm Prix grade. Neutral tonemap happens later in OutputPass.
 *  Boost adds a warm shift and edge streaks without crushing the kart. */
export const PalmGradeShader = {
  name: 'PalmGrade',
  uniforms: {
    tDiffuse: { value: null },
    uBoost: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uBoost;
    varying vec2 vUv;

    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      vec2 d = vUv - vec2(0.5);
      float dist = length(d);
      vec2 dir = dist > 0.0001 ? d / dist : vec2(0.0);
      float edge = smoothstep(0.06, 0.38, dist) * uBoost;

      if (edge > 0.001) {
        vec3 acc = c;
        acc += texture2D(tDiffuse, vUv - dir * 0.014).rgb;
        acc += texture2D(tDiffuse, vUv - dir * 0.03).rgb;
        acc += texture2D(tDiffuse, vUv - dir * 0.048).rgb;
        acc += texture2D(tDiffuse, vUv + dir * 0.01).rgb;
        c = mix(c, acc * 0.2, edge);
        float ang = atan(d.y, d.x);
        float lines = pow(abs(sin(ang * 22.0)), 18.0);
        c += vec3(1.15, 0.82, 0.35) * lines * edge * 0.48;
      }

      float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
      float sat = mix(1.14, 1.5, uBoost);
      c = mix(vec3(luma), c, sat);
      c += vec3(0.02, 0.022, 0.015) * (1.0 - smoothstep(0.0, 0.42, luma)) * (1.0 - uBoost);
      c *= mix(vec3(1.0), vec3(1.16, 1.04, 0.86), uBoost);
      c += vec3(0.045, 0.02, 0.0) * uBoost;
      gl_FragColor = vec4(max(c, vec3(0.0)), 1.0);
    }
  `,
}
