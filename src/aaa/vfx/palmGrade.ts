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
      float edge = smoothstep(0.36, 0.62, dist) * uBoost;

      if (edge > 0.001) {
        vec3 acc = c;
        acc += texture2D(tDiffuse, vUv - dir * 0.012).rgb;
        acc += texture2D(tDiffuse, vUv - dir * 0.026).rgb;
        c = mix(c, acc * 0.333, edge * 0.65);
        float ang = atan(d.y, d.x);
        float lines = pow(abs(sin(ang * 18.0)), 18.0);
        c += vec3(0.95, 0.62, 0.22) * lines * edge * 0.22;
      }

      float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
      float sat = mix(1.08, 1.16, uBoost);
      c = mix(vec3(luma), c, sat);
      c += vec3(0.02, 0.022, 0.015) * (1.0 - smoothstep(0.0, 0.42, luma)) * (1.0 - uBoost);
      c *= mix(vec3(1.0), vec3(1.05, 1.02, 0.96), uBoost);
      gl_FragColor = vec4(max(c, vec3(0.0)), 1.0);
    }
  `,
}
