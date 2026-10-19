'use strict';

// Muscle data shared with app.js: the 18 groups, auto-fill rules for common
// exercises, and the shapes for the front/back body map.
window.SPINN_MUSCLES = (() => {
  const LIST = [
    ['chest', 'Chest', 'upper'],
    ['lats', 'Lats', 'upper'],
    ['upperback', 'Upper back', 'upper'],
    ['traps', 'Traps', 'upper'],
    ['frontdelts', 'Front delts', 'upper'],
    ['sidedelts', 'Side delts', 'upper'],
    ['reardelts', 'Rear delts', 'upper'],
    ['biceps', 'Biceps', 'upper'],
    ['triceps', 'Triceps', 'upper'],
    ['forearms', 'Forearms', 'upper'],
    ['quads', 'Quads', 'lower'],
    ['hamstrings', 'Hamstrings', 'lower'],
    ['glutes', 'Glutes', 'lower'],
    ['adductors', 'Adductors', 'lower'],
    ['calves', 'Calves', 'lower'],
    ['abs', 'Abs', 'core'],
    ['obliques', 'Obliques', 'core'],
    ['lowerback', 'Lower back', 'core'],
  ];
  const IDS = LIST.map(m => m[0]);
  const NAME = Object.fromEntries(LIST.map(m => [m[0], m[1]]));
  const GROUPS = [
    ['upper', 'Upper body'],
    ['lower', 'Lower body'],
    ['core', 'Core'],
  ].map(([id, label]) => ({ id, label, muscles: LIST.filter(m => m[2] === id).map(m => m[0]) }));

  // First match wins, so specific names come before general ones.
  // [pattern, primary, secondary]
  const RULES = [
    [/rear delt|reverse fly|reverse pec|face pull/, ['reardelts'], ['upperback', 'traps']],
    [/close.?grip.*(bench|press)|jm press/, ['triceps'], ['chest', 'frontdelts']],
    [/incline.*(press|bench)|(press|bench).*incline/, ['chest'], ['frontdelts', 'triceps']],
    [/decline.*(press|bench)/, ['chest'], ['triceps']],
    [/bench|chest press|floor press|push.?up|press.?up/, ['chest'], ['triceps', 'frontdelts']],
    [/\bfly|flye|pec deck|cable cross|crossover/, ['chest'], ['frontdelts']],
    [/\bdips?\b/, ['chest', 'triceps'], ['frontdelts']],
    [/lateral raise|side raise|lat raise|upright row|y.?raise/, ['sidedelts'], ['traps']],
    [/front raise/, ['frontdelts'], []],
    [/overhead press|shoulder press|military|\bohp\b|arnold|push press|landmine press/, ['frontdelts'], ['sidedelts', 'triceps']],
    [/pull.?up|chin.?up|pulldown|pull.?down|lat pull/, ['lats'], ['biceps', 'upperback']],
    [/pullover/, ['lats'], ['chest']],
    [/shrug/, ['traps'], []],
    [/rack pull/, ['upperback', 'traps'], ['lowerback', 'glutes']],
    [/\brows?\b|t.?bar/, ['upperback', 'lats'], ['biceps', 'reardelts']],
    [/romanian|\brdl\b|stiff.?leg|good morning/, ['hamstrings'], ['glutes', 'lowerback']],
    [/dead.?lift/, ['hamstrings', 'glutes', 'lowerback'], ['quads', 'traps', 'forearms']],
    [/hip thrust|glute bridge|\bbridge/, ['glutes'], ['hamstrings']],
    [/glute kickback|donkey kick|abduct/, ['glutes'], []],
    [/leg curl|hamstring curl|nordic/, ['hamstrings'], []],
    [/leg extension/, ['quads'], []],
    [/split squat|bulgarian|lunge|step.?up/, ['quads', 'glutes'], ['adductors', 'hamstrings']],
    [/front squat|hack squat|goblet|sissy/, ['quads'], ['glutes', 'adductors']],
    [/squat|leg press/, ['quads', 'glutes'], ['adductors', 'lowerback']],
    [/adduct|copenhagen/, ['adductors'], []],
    [/calf|calves/, ['calves'], []],
    [/skull|tricep|pushdown|push.?down|kickback|overhead extension|french press/, ['triceps'], []],
    [/hammer curl|reverse curl/, ['biceps', 'forearms'], []],
    [/wrist/, ['forearms'], []],
    [/farmer|carry|grip/, ['forearms'], ['traps']],
    [/curl/, ['biceps'], ['forearms']],
    [/back extension|hyperextension|superman/, ['lowerback'], ['glutes', 'hamstrings']],
    [/oblique|side plank|russian twist|wood.?chop|pallof/, ['obliques'], ['abs']],
    [/crunch|sit.?up|plank|leg raise|knee raise|ab wheel|rollout|hollow|v.?up|dead bug|toes to bar/, ['abs'], ['obliques']],
  ];

  function guess(normName) {
    for (const [re, p, s] of RULES) if (re.test(normName)) return { p: p.slice(), s: s.slice() };
    return null;
  }

  // Body map: one half of each figure (viewBox 0 0 120 250, centre line x = 60),
  // mirrored for the other side. `m` is the muscle id, or null for non-muscle parts.
  const HALF = {
    front: [
      [null, 'M55 26 L60 26 L60 37 L55 37 Z'],
      ['traps', 'M55 31 C51 35 46 37 41 38 L55 39 Z'],
      ['sidedelts', 'M37 38 C29 39 25 46 25 54 C25 58 26 61 27 63 C29 55 31 49 35 45 Z'],
      ['frontdelts', 'M41 38 C46 39 48 44 46 49 C40 51 34 56 29 63 C29 55 31 47 36 43 C37 41 39 39 41 38 Z'],
      ['chest', 'M59 41 L49 41 C48 47 46 52 43 56 C45 63 51 67 59 66 Z'],
      ['biceps', 'M28 66 C25 73 25 82 27 90 L34 90 C35 82 37 73 38 62 C35 61 31 63 28 66 Z'],
      ['forearms', 'M27 93 C23 103 22 115 23 127 L30 127 C32 116 34 104 35 93 Z'],
      [null, 'M23 130 L30 130 L31 139 C29 142 24 142 22 139 Z'],
      ['obliques', 'M48 69 C45 71 44 75 44 81 C44 91 45 99 47 106 L50 106 C49 94 48 82 49 69 Z'],
      ['abs', 'M59 69 L51 69 C50 82 50 95 51 106 L59 108 Z'],
      [null, 'M47 109 L59 111 L59 122 L53 124 C50 118 48 114 47 109 Z'],
      ['quads', 'M45 112 C41 125 40 145 42 165 C43 172 46 177 49 179 L53 178 C53 160 54 140 52 125 C50 120 47 116 45 112 Z'],
      ['adductors', 'M55 125 C57 134 58 143 59 151 L60 151 L60 126 Z'],
      [null, 'M43 181 C43 178 52 178 52 181 L52 189 C52 192 43 192 43 189 Z'],
      ['calves', 'M43 193 C41 205 42 219 44 231 L50 231 C52 219 53 205 51 193 Z'],
      [null, 'M44 233 L50 233 L53 242 L41 242 Z'],
    ],
    back: [
      [null, 'M55 26 L60 26 L60 34 L55 34 Z'],
      ['traps', 'M60 28 L60 72 C56 64 50 54 43 46 L39 40 C46 37 52 33 55 28 Z'],
      ['sidedelts', 'M37 38 C29 39 25 46 25 54 C25 58 26 61 27 63 C29 55 31 49 35 45 Z'],
      ['reardelts', 'M39 40 C43 43 44 46 42 50 C37 52 33 57 29 63 C29 55 31 47 36 43 Z'],
      ['upperback', 'M43 49 C48 56 53 64 57 73 L49 74 C46 68 44 60 42 53 Z'],
      ['lats', 'M41 56 C43 64 46 71 49 77 L59 78 L59 86 C53 91 48 96 46 101 C43 91 41 80 40 69 C40 63 40 59 41 56 Z'],
      ['triceps', 'M28 66 C25 73 25 82 27 90 L34 90 C35 82 37 73 38 62 C35 61 31 63 28 66 Z'],
      ['forearms', 'M27 93 C23 103 22 115 23 127 L30 127 C32 116 34 104 35 93 Z'],
      [null, 'M23 130 L30 130 L31 139 C29 142 24 142 22 139 Z'],
      ['lowerback', 'M59 89 L59 108 L50 108 C49 101 50 96 53 92 Z'],
      ['glutes', 'M59 111 L47 111 C43 117 42 125 44 132 C48 137 54 137 59 134 Z'],
      ['hamstrings', 'M44 136 C42 150 42 165 45 178 L53 178 C55 165 56 150 57 137 C53 139 48 139 44 136 Z'],
      [null, 'M44 181 C44 178 53 178 53 181 L53 189 C53 192 44 192 44 189 Z'],
      ['calves', 'M43 193 C39 203 40 215 43 227 L51 227 C53 215 54 203 52 193 Z'],
      [null, 'M44 229 L51 229 L53 242 L42 242 Z'],
    ],
  };
  const HEAD = { cx: 60, cy: 15, rx: 10, ry: 12 };

  return { LIST, IDS, NAME, GROUPS, guess, HALF, HEAD };
})();
