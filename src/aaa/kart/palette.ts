import * as THREE from 'three'

/** Candy-toy livery for the Palm Dart. Original Palm Prix colors. */
export const paint = {
  coral: new THREE.Color('#ff3d66'),
  coralDeep: new THREE.Color('#c81d45'),
  cream: new THREE.Color('#fff3e4'),
  blue: new THREE.Color('#2f6bff'),
  gold: new THREE.Color('#ffc83d'),
  plum: new THREE.Color('#24182f'),
  plumLite: new THREE.Color('#3a2a52'),
  palm: new THREE.Color('#14a35a'),
  palmDeep: new THREE.Color('#0c7a40'),
  tire: new THREE.Color('#121418'),
  sidewall: new THREE.Color('#8a8e98'),
  letter: new THREE.Color('#f6f1e6'),
  metal: new THREE.Color('#d5dee8'),
  glass: new THREE.Color('#d7fbff'),
  visor: new THREE.Color('#123044'),
  flame: new THREE.Color('#9dffc4'),
  flameCore: new THREE.Color('#fff6b0'),
  tail: new THREE.Color('#ff2d55'),
  lamp: new THREE.Color('#fff4c8'),
} as const

export const LAYOUT = {
  zTail: -1.06,
  zNose: 1.16,
  wheelX: 0.76,
  wheelY: 0.36,
  wheelR: 0.34,
  frontZ: 0.72,
  rearZ: -0.76,
} as const
