// 章节注册表：顺序即学习路线。每个场景文件默认导出一个 chapter 对象（见 src/scenes/_TEMPLATE.md）。
import atom from './scenes/atom.js';
import staticElec from './scenes/static.js';
import coulomb from './scenes/coulomb.js';
import efield from './scenes/efield.js';
import potential from './scenes/potential.js';
import current from './scenes/current.js';
import resistance from './scenes/resistance.js';
import ohm from './scenes/ohm.js';
import seriesparallel from './scenes/seriesparallel.js';
import power from './scenes/power.js';
import battery from './scenes/battery.js';
import capacitor from './scenes/capacitor.js';
import semiconductor from './scenes/semiconductor.js';
import magnetism from './scenes/magnetism.js';
import motor from './scenes/motor.js';
import induction from './scenes/induction.js';
import generator from './scenes/generator.js';
import transformer from './scenes/transformer.js';
import emwave from './scenes/emwave.js';
import spectrum from './scenes/spectrum.js';
import antenna from './scenes/antenna.js';
import radio from './scenes/radio.js';
import telephone from './scenes/telephone.js';

export const GROUPS = [
  { id: 'basics', title: '电荷与电场', desc: '电从哪里来：原子、电荷、电场、电压', icon: 'atom' },
  { id: 'circuit', title: '电路', desc: '电流、电阻、欧姆定律、电池、电容、半导体', icon: 'circuit' },
  { id: 'magnet', title: '电与磁', desc: '电生磁、磁生电：电动机、发电机、变压器', icon: 'magnet' },
  { id: 'wave', title: '电磁波与通信', desc: '电磁波、天线、无线电广播、电话', icon: 'wave' },
];

export const CHAPTERS = [
  atom, staticElec, coulomb, efield, potential,
  current, resistance, ohm, seriesparallel, power, battery, capacitor, semiconductor,
  magnetism, motor, induction, generator, transformer,
  emwave, spectrum, antenna, radio, telephone,
];

export function chapterById(id) {
  return CHAPTERS.find((c) => c.id === id);
}
