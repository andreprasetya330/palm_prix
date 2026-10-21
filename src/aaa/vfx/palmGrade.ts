/** Sunny Palm Prix grade. Neutral tonemap happens later in OutputPass.
 *  Boost adds a warm shift. Speed lines belong on the exhaust, not in the sky. */
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
      float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
      float sat = mix(1.08, 1.16, uBoost);
      c = mix(vec3(luma), c, sat);
      c += vec3(0.02, 0.022, 0.015) * (1.0 - smoothstep(0.0, 0.42, luma)) * (1.0 - uBoost);
      c *= mix(vec3(1.0), vec3(1.05, 1.02, 0.96), uBoost);
      gl_FragColor = vec4(max(c, vec3(0.0)), 1.0);
    }
  `,
}
