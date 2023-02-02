// The Omega Protocol
//   modified by Shirabe Tsuku-yomi @ Titan

const orderMode = 'htdh'; // 'htdh' or 'htd'
const cactbotSelfDllActivated = true; // A special addon for ACT

const jobText = {
  // Tank
  'PLD': { cn: '骑士', en: 'Paladin' },
  'WAR': { cn: '战士', en: 'Warrior' },
  'DRK': { cn: '黑骑', en: 'Dark Knight' },
  'GNB': { cn: '枪刃', en: 'Gunbreaker' },
  // Healer
  'WHM': { cn: '白魔', en: 'White Mage' },
  'SCH': { cn: '学者', en: 'Scholar' },
  'AST': { cn: '占星', en: 'Astrologian' },
  'SGE': { cn: '贤者', en: 'Sage' },
  // Melee DPS
  'MNK': { cn: '武僧', en: 'Monk' },
  'DRG': { cn: '龙骑', en: 'Dragoon' },
  'NIN': { cn: '忍者', en: 'Ninja' },
  'SAM': { cn: '武士', en: 'Samurai' },
  'RPR': { cn: '镰刀', en: 'Reaper' },
  // Physical Ranged DPS
  'BRD': { cn: '诗人', en: 'Bard' },
  'MCH': { cn: '机工', en: 'Machinist' },
  'DNC': { cn: '舞者', en: 'Dancer' },
  // Magical Ranged DPS
  'BLM': { cn: '黑魔', en: 'Black Mage' },
  'SMN': { cn: '召唤', en: 'Summoner' },
  'RDM': { cn: '赤魔', en: 'Red Mage' },
};

const jobOrderByRole = {
  healer: {
    'WHM': 0, 'AST': 1, 'SGE': 2, 'SCH': 3
  },
  tank: {
    'DRK': 0, 'GNB': 1, 'WAR': 2, 'PLD': 3
  },
  dps: {
    // 'BLM': 0, // For D1 BLM
    'SAM': 1, 'MNK': 2, 'RPR': 3,
    'DRG': 4, 'NIN': 5,
    // 'BLM': 5, // For D2 BLM
    'BRD': 7, 'DNC': 8, 'MCH': 9,
    'SMN': 10, 'RDM': 11,
    'BLM': 12, // For D4 BLM
  },
};

// Different Player Order Solution
function initPlayerOrder(data) {
  var playerOrderByRole = { healer: [], tank: [], dps: [] };
  var partyJobs = {};
  
  for (const p of data.party.details) { if (p.inParty) partyJobs[p.name] = Util.jobEnumToJob(p.job); }
  if (Object.keys(partyJobs).length === 0) return [data.me];

  for (const playerName in partyJobs) {
    playerOrderByRole[data.party.nameToRole_[playerName]].push(playerName)
  }
  for (const [role, roleOrder] of Object.entries(playerOrderByRole)) {
    roleOrder.sort( (a, b) => {
        var aIdx = jobOrderByRole[role][partyJobs[a]];
        var bIdx = jobOrderByRole[role][partyJobs[b]];
        return aIdx > bIdx ? 1 :
          aIdx < bIdx ? -1 :
          0;
      }
    )
  }

  switch (orderMode) {
  case 'htdh':
    return playerOrderByRole.healer.slice(0,1).concat(
      playerOrderByRole.tank, playerOrderByRole.dps, playerOrderByRole.healer.slice(1)
    );
  case 'htd':
    return playerOrderByRole.healer.concat(
      playerOrderByRole.tank, playerOrderByRole.dps
    );
  }
};

const playstationMarkers = ['circle', 'cross', 'triangle', 'square'];
// Due to changes introduced in patch 5.2, overhead markers now have a random offset
// added to their ID. This offset currently appears to be set per instance, so
// we can determine what it is from the first overhead marker we see.
const headmarkers = {
  // vfx/lockon/eff/lockon5_t0h.avfx
  spread: '0017',
  // vfx/lockon/eff/tank_lockonae_5m_5s_01k1.avfx
  buster: '0157',
  // vfx/lockon/eff/z3oz_firechain_01c.avfx through 04c
  firechainCircle: '01A0',
  firechainTriangle: '01A1',
  firechainSquare: '01A2',
  firechainX: '01A3',
  // vfx/lockon/eff/com_share2i.avfx
  stack: '0064',
  // vfx/lockon/eff/all_at8s_0v.avfx
  meteor: '015A',
};
const playstationHeadmarkerIds = [
  headmarkers.firechainCircle,
  headmarkers.firechainTriangle,
  headmarkers.firechainSquare,
  headmarkers.firechainX,
];
const playstationMarkerMap = {
  [headmarkers.firechainCircle]: 'circle',
  [headmarkers.firechainTriangle]: 'triangle',
  [headmarkers.firechainSquare]: 'square',
  [headmarkers.firechainX]: 'cross',
};
const firstMarker = parseInt('0017', 16);
const getHeadmarkerId = (data, matches) => {
  if (data.decOffset === undefined)
    data.decOffset = parseInt(matches.id, 16) - firstMarker;
  // The leading zeroes are stripped when converting back to string, so we re-add them here.
  // Fortunately, we don't have to worry about whether or not this is robust,
  // since we know all the IDs that will be present in the encounter.
  return (parseInt(matches.id, 16) - data.decOffset).toString(16).toUpperCase().padStart(4, '0');
};


Options.Triggers.push({
  // zoneId: 1122, // The Omega Protocol Zone ID
  zoneId: ZoneId.TheOmegaProtocolUltimate,
  initData: () => {
    return {
      playerOrder: [],
      synergyMarker: {},
      synergyFlag: false,
      synergyTransformTriggerOn: moreLogLineActivated,
      synergyTransformed: { m: false, f: false },
      synergyTransformOmegaFId: null,
    };
  },

  triggers: [
    {
      id: 'TOP Player Order Initialize',
      type: 'StartsUsing',
      // Initialize at 7B03 = Program Loop
      netRegex: { id: ['7B03'], source: 'Omega', capture: false },
      run: (data) => {
        if (data.playerOrder.length != 8) data.playerOrder = initPlayerOrder(data);
        console.log(data.playerOrder);
      }
    },
    {
      id: 'TOP Party Synergy Glitch',
      type: 'GainsEffect',
      // D63 = Mid Glitch
      // D64 = Remote Glitch
      netRegex: { effectId: ['D63', 'D64'] },
      suppressSeconds: 10,
      run: (data, matches) => data.glitch = matches.effectId === 'D63' ? 'mid' : 'remote',
    },
    {
      id: 'TOP Party Synergy Marker Collect',
      type: 'HeadMarker',
      netRegex: {},
      run: (data, matches) => {
        const id = getHeadmarkerId(data, matches);
        const marker = playstationMarkerMap[id];
        if (marker === undefined)
          return;
        data.synergyMarker[matches.target] = marker;
      },
    },
    {
      id: 'TOP Party Synergy Marker',
      type: 'GainsEffect',
      // In practice, glitch1 glitch2 marker1 marker2 glitch3 glitch4 etc ordering.
      netRegex: { effectId: ['D63', 'D64'], capture: false },
      delaySeconds: 7, // 0.5;
      durationSeconds: 8, // 14;
      suppressSeconds: 10,
      alarmText: (data, _matches, output) => {
        const glitch = data.glitch
          ? {
            mid: output.midGlitch(),
            remote: output.remoteGlitch(),
          }[data.glitch]
          : output.unknown();
        const myMarker = data.synergyMarker[data.me];
        // If something has gone awry, at least return something here.
        if (myMarker === undefined)
          return glitch;

        let partner = output.unknown();
        for (const [name, marker] of Object.entries(data.synergyMarker)) {
          if (marker === myMarker && name !== data.me) { partner = name; break; }
        }

        var partnerIndex = data.playerOrder.indexOf[partner];
        var myIndex = data.playerOrder.indexOf[data.me];
        var direction = (myIndex < partner) ? output.goLeft() : output.goRight();

        return {
          circle: output.circle({ glitch: glitch, direction: direction }),
          triangle: output.triangle({ glitch: glitch, direction: direction }),
          square: output.square({ glitch: glitch, direction: direction }),
          cross: output.cross({ glitch: glitch, direction: direction }),
        }[myMarker];
      },
      outputStrings: {
        midGlitch: {
          cn: '中间',
        },
        remoteGlitch: {
          cn: '远离',
        },
        goLeft: {
          cn: '左',
        },
        goRight: {
          cn: '右'
        },
        circle: {
          // cn: '${glitch} 圆圈 ${direction}',
          cn: '${glitch} 1 ${direction}',
        },
        cross: {
          // cn: '${glitch} 叉字 ${direction}',
          cn: '${glitch} 2 ${direction}',
        },
        triangle: {
          // cn: '${glitch} 三角 ${direction}',
          cn: '${glitch} 3 ${direction}',
        },
        square: {
          // cn: '${glitch} 方形 ${direction}',
          cn: '${glitch} 4 ${direction}',
        },
        unknown: Outputs.unknown,
      },
    },
    {
      id: 'TOP Party Synergy Omega M & F',
      type: 'AddedCombatant',
      netRegex: { npcNameId:'7634' }, // ID of BUNSHIN Omega-F
      // type: 'StartsUsing',
      // netRegex: { id: ['7B3E', '7B3F'], source: ['Omega', 'Omega-M', 'Omega-F'] },
      condition: (data) => data.synergyTransformTriggerOn,
      preRun: (data, matches) => {
        data.synergyTransformOmegaFId = matches.id;
      },
      // Omega-M and Omega-F (both with internal name 'Omega') cast Party Synergy.
      // At the same time, several invisible BUNSHINs (1 F and 5 M) are added to game.
      // 8s later, BUNSHINs show up and their forms are determined.
      // Then 4s later, 2 of BUNSHINs (1 M and 1 F) start casting AOEs.
      // Then 1s later, AOEs take their effects.
      delaySeconds: 9.5,
      suppressSeconds: 10,
      alarmText: (data, _mathces, output) => {
        // Alarm according to data.synergyTransformed
        if (data.synergyTransformed.m) {
          if (data.synergyTransformed.f) { return output.mCenter(); }
          else { return output.mSide(); }
        } else {
          if (data.synergyTransformed.f) { return output.fCenter(); }
          else { return output.mfAway(); }
        }
      },
      outputStrings: {
        mCenter: {
          cn: '靠近男人',
        },
        fCenter: {
          cn: '靠近女人',
        },
        mSide: {
          cn: '男人两边',
        },
        mfAway: {
          cn: '远离男女',
        }
      },
    },
    {
      id: 'TOP Party Synergy Omega M & F Transform',
      // This NetRegex is not compatible with CACTBOTSELF.DLL.
      // netRegex: /^.{14} (?:\w+ )00:0:106:(?<id>[^:]*):(?<source>[^:]*):0031:.{4}:.{8}:/,
      // This is compatible.
      netRegex: /] ChatLog 00:0:106:(?<id>[^:]*):(?<sourceRaw>[^:]*):0031:.{4}:.{8}:/,
      condition: (data) => { return (!data.synergyFlag && data.synergyTransformTriggerOn) },
      preRun: (data, matches) => {
        // DEBUG: Check by data.source
        const nameLocale = {
          omegaM: { ja: 'オメガM', en: 'Omega-M', fr: 'Omega-M', de: 'Omega-M' },
          omegaF: { ja: 'オメガF', en: 'Omega-F', fr: 'Omega-F', de: 'Omega-W' },
        }
        if (Object.values(nameLocale.omegaF).includes(matches.sourceRaw)) 
          data.synergyTransformed.f = true;
        if (Object.values(nameLocale.omegaM).includes(matches.sourceRaw))
          data.synergyTransformed.m = true;

        // DEBUG: Check by data.id
        // if (matches.id === data.synergyTransformOmegaFId) { data.synergyTransformed.f = true; }
        // else { data.synergyTransformed.m = true; }
      },
      delaySeconds: 10,
      run: (data) => { data.synergyFlag = true; }, // Clean up
    },

  ],

  timelineReplace: [
    {
      'locale': 'de',
      'replaceSync': {
        'Omega(?!-)': 'Omega',
        'Omega-F': 'Omega-W',
        'Omega-M': 'Omega-M',
        'Optical Unit': 'Optikmodul',
        'Right Arm Unit': 'recht(?:e|er|es|en) Arm',
      },
      'replaceText': {
        'Atomic Ray': 'Atomstrahlung',
        'Beyond Defense': 'Schildkombo S',
        'Beyond Strength': 'Schildkombo G',
        'Blaster': 'Blaster',
        'Colossal Blow': 'Kolossaler Hieb',
        'Condensed Wave Cannon Kyrios': 'Hochleistungswellenkanone P',
        'Cosmo Memory': 'Kosmosspeicher',
        'Critical Error': 'Schwerer Ausnahmefehler',
        'Diffuse Wave Cannon Kyrios': 'Streuende Wellenkanone P',
        'Discharger': 'Entlader',
        'Efficient Bladework': 'Effiziente Klingenführung',
        'Firewall': 'Sicherungssystem',
        'Flame Thrower': 'Flammensturm',
        'Guided Missile Kyrios': 'Lenkrakete P',
        'Hello, World': 'Hallo, Welt!',
        'High-powered Sniper Cannon': 'Wellengeschütz „Pfeil +”',
        'Ion Efflux': 'Ionenstrom',
        'Laser Shower': 'Laserschauer',
        'Latent Defect': 'Latenter Bug',
        'Left Arm Unit': 'link(?:e|er|es|en) Arm',
        'Limitless Synergy': 'Synergieprogramm LB',
        'Optical Laser': 'Optischer Laser F',
        'Optimized Bladedance': 'Omega-Schwertertanz',
        'Optimized Blizzard III': 'Omega-Eisga',
        'Optimized Fire III': 'Omega-Feuga',
        'Optimized Meteor': 'Omega-Meteor',
        'Optimized Passage of Arms': 'Optimierter Waffengang',
        'Optimized Sagittarius Arrow': 'Omega-Choral der Pfeile',
        'Oversampled Wave Cannon': 'Fokussierte Wellenkanone',
        'Pantokrator': 'Pantokrator',
        'Party Synergy': 'Synergieprogramm PT',
        'Patch': 'Regression',
        'Pile Pitch': 'Neigungsstoß',
        'Program Loop': 'Programmschleife',
        'Right Arm Unit': 'recht(?:e|er|es|en) Arm',
        '(?<! )Sniper Cannon': 'Wellengeschütz „Pfeil”',
        'Solar Ray': 'Sonnenstrahl',
        'Spotlight': 'Scheinwerfer',
        'Storage Violation': 'Speicherverletzung S',
        'Superliminal Steel': 'Klingenkombo B',
        'Synthetic Shield': 'Effiziente Klingenführung',
        '(?<! )Wave Cannon Kyrios': 'Wellenkanone P',
        'Wave Repeater': 'Schnellfeuer-Wellenkanone',
      },
    },
    {
      'locale': 'fr',
      'replaceSync': {
        'Omega(?!-)': 'Oméga',
        'Omega-F': 'Oméga-F',
        'Omega-M': 'Oméga-M',
        'Optical Unit': 'unité optique',
        'Right Arm Unit': 'unité bras droit',
      },
      'replaceText': {
        'Atomic Ray': 'Rayon atomique',
        'Beyond Defense': 'Combo bouclier S',
        'Beyond Strength': 'Combo bouclier G',
        'Blaster': 'Électrochoc',
        'Colossal Blow': 'Coup colossal',
        'Condensed Wave Cannon Kyrios': 'Canon plasma surchargé P',
        'Cosmo Memory': 'Cosmomémoire',
        'Critical Error': 'Erreur critique',
        'Diffuse Wave Cannon Kyrios': 'Canon plasma diffuseur P',
        'Discharger': 'Déchargeur',
        'Efficient Bladework': 'Lame active',
        'Firewall': 'Programme protecteur',
        'Flame Thrower': 'Crache-flammes',
        'Guided Missile Kyrios': 'Missile guidé P',
        'Hello, World': 'Bonjour, le monde',
        'High-powered Sniper Cannon': 'Canon plasma longue portée surchargé',
        'Ion Efflux': 'Fuite d\'ions',
        'Laser Shower': 'Pluie de lasers',
        'Latent Defect': 'Bogue latent',
        'Left Arm Unit': 'unité bras gauche',
        'Limitless Synergy': 'Programme synergique LB',
        'Optical Laser': 'Laser optique F',
        'Optimized Bladedance': 'Danse de la lame Oméga',
        'Optimized Blizzard III': 'Méga Glace Oméga',
        'Optimized Fire III': 'Méga Feu Oméga',
        'Optimized Meteor': 'Météore Oméga',
        'Optimized Passage of Arms': 'Passe d\'armes Oméga',
        'Optimized Sagittarius Arrow': 'Flèche du sagittaire Oméga',
        'Oversampled Wave Cannon': 'Canon plasma chercheur',
        'Pantokrator': 'Pantokrator',
        'Party Synergy': 'Programme synergique PT',
        'Patch': 'Bogue intentionnel',
        'Pile Pitch': 'Lancement de pieu',
        'Program Loop': 'Boucle de programme',
        'Right Arm Unit': 'unité bras droit',
        '(?<! )Sniper Cannon': 'Canon plasma longue portée',
        'Solar Ray': 'Rayon solaire',
        'Spotlight': 'Phare',
        'Storage Violation': 'Corruption de données S',
        'Superliminal Steel': 'Combo lame B',
        'Synthetic Shield': 'Bouclier optionnel',
        '(?<! )Wave Cannon Kyrios': 'Canon plasma P',
        'Wave Repeater': 'Canon plasma automatique',
      },
    },
    {
      'locale': 'ja',
      'replaceSync': {
        'Omega(?!-)': 'オメガ',
        'Omega-F': 'オメガF',
        'Omega-M': 'オメガM',
        'Optical Unit': 'オプチカルユニット',
        'Right Arm Unit': 'ライトアームユニット',
      },
      'replaceText': {
        'Atomic Ray': 'アトミックレイ',
        'Beyond Defense': 'シールドコンボS',
        'Beyond Strength': 'シールドコンボG',
        'Blaster': 'ブラスター',
        'Colossal Blow': 'コロッサスブロー',
        'Condensed Wave Cannon Kyrios': '高出力波動砲P',
        'Cosmo Memory': 'コスモメモリー',
        'Critical Error': 'クリティカルエラー',
        'Diffuse Wave Cannon Kyrios': '拡散波動砲P',
        'Discharger': 'ディスチャージャー',
        'Efficient Bladework': 'ソードアクション',
        'Firewall': 'ガードプログラム',
        'Flame Thrower': '火炎放射',
        'Guided Missile Kyrios': '誘導ミサイルP',
        'Hello, World': 'ハロー・ワールド',
        'High-powered Sniper Cannon': '狙撃式高出力波動砲',
        'Ion Efflux': 'イオンエフラクス',
        'Laser Shower': 'レーザーシャワー',
        'Latent Defect': 'レイテントバグ',
        'Left Arm Unit': 'レフトアームユニット',
        'Limitless Synergy': '連携プログラムLB',
        'Optical Laser': 'オプチカルレーザーF',
        'Optimized Bladedance': 'ブレードダンス・オメガ',
        'Optimized Blizzard III': 'ブリザガ・オメガ',
        'Optimized Fire III': 'ファイラ・オメガ',
        'Optimized Meteor': 'メテオ・オメガ',
        'Optimized Passage of Arms': 'パッセージ・オブ・オメガ',
        'Optimized Sagittarius Arrow': 'サジタリウスアロー・オメガ',
        'Oversampled Wave Cannon': '検知式波動砲',
        'Pantokrator': 'パントクラトル',
        'Party Synergy': '連携プログラムPT',
        'Patch': 'エンバグ',
        'Pile Pitch': 'パイルピッチ',
        'Program Loop': 'サークルプログラム',
        'Right Arm Unit': 'ライトアームユニット',
        '(?<! )Sniper Cannon': '狙撃式波動砲',
        'Solar Ray': 'ソーラレイ',
        'Spotlight': 'スポットライト',
        'Storage Violation': '記憶汚染除去S',
        'Superliminal Steel': 'ブレードコンボB',
        'Synthetic Shield': 'シールドオプション',
        '(?<! )Wave Cannon Kyrios': '波動砲P',
        'Wave Repeater': '速射式波動砲',
      },
    },
  ],
});
