// The Omega Protocol
//   modified by Shirabe Tsuku-yomi @ Titan

const cactbotSelfDllActivated = true; // A special addon for ACT, may be deprecated

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
function initPlayerOrderByRole(data) {
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
  return playerOrderByRole;
};

function htdhOrder(playerOrderByRole) {
  return playerOrderByRole.healer.slice(0,1).concat(
    playerOrderByRole.tank, playerOrderByRole.dps, playerOrderByRole.healer.slice(1)
  );
};

function htdOrder(playerOrderByRole) {
  return playerOrderByRole.healer.concat(
    playerOrderByRole.tank, playerOrderByRole.dps
  );
};

function tdhOrder(playerOrderByRole) {
  return playerOrderByRole.tank.concat(
    playerOrderByRole.dps, playerOrderByRole.healer
  );
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
const playstationMarkerEnum = {
  'circle': 1, 'cross': 2, 'triangle': 3, 'square': 4
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
      // P2 Party Synergy
      synergyMarker: {},
      synergyGlitch: null,
      synergyTransformFlag: false,
      synergyTransformTriggerOn: cactbotSelfDllActivated,
      synergyTransformed: { m: false, f: false },
      synergyTransformOmegaFId: null,
      synergySpotlightFlag: false,
      synergySpotlightGroup: {},
      synergySpotlightMarkerPlayers: [],
      // P3 Hello World
      smellDefamation: [],
      smellRot: {},
      // P3 Oversampled Wave Cannon
      omegaWaveCannonDirection: null,
      waveCannonLoadingPlayer: [],
    };
  },

  triggers: [
    {
      id: 'TOP Player Order Initialize',
      type: 'StartsUsing',
      // Initialize at 7B03 = Program Loop
      netRegex: { id: ['7B03'], source: 'Omega', capture: false },
      run: (data) => {
        // if (data.playerOrder.length != 8)
        data.playerOrderByRole = initPlayerOrderByRole(data);
      }
    },
    {
      id: 'TOP Party Synergy Glitch',
      type: 'GainsEffect',
      // D63 = Mid Glitch
      // D64 = Remote Glitch
      netRegex: { effectId: ['D63', 'D64'] },
      suppressSeconds: 10,
      run: (data, matches) => data.synergyGlitch = matches.effectId === 'D63' ? 'mid' : 'remote',
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
        // console.log(Object.values(data.synergyMarker));
      },
    },
    {
      id: 'TOP Party Synergy Marker & Glitch Spread',
      type: 'GainsEffect',
      // In practice, glitch1 glitch2 marker1 marker2 glitch3 glitch4 etc ordering.
      netRegex: { effectId: ['D63', 'D64'] },
      delaySeconds: 5, // 0.5;
      durationSeconds: 8, // 14;
      suppressSeconds: 10, // Only Process Once
      alarmText: (data, _matches, output) => {
        const glitch = data.synergyGlitch
          ? {
            mid: output.midGlitch(),
            remote: output.remoteGlitch(),
          }[data.synergyGlitch]
          : output.unknown();
        // console.log(Object.keys(data.synergyMarker));
        // console.log(Object.values(data.synergyMarker));
        var playerOrder = htdhOrder(data.playerOrderByRole);
        
        // Initialize Group for Spotlight
        var markerInLeftGroup = [];
        for (const [name, marker] of Object.entries(data.synergyMarker)) {
          if (!markerInLeftGroup.includes(marker)) {
            markerInLeftGroup.push(marker);
            data.synergySpotlightGroup[name] = 'left';
          } else {
            data.synergySpotlightGroup[name] = 'right';
          }
        }

        // Dealing with Glitch Spread
        const myMarker = data.synergyMarker[data.me];
        // If something has gone awry, at least return something here.
        if (myMarker === undefined)
          return glitch;

        let partner = output.unknown();
        for (const [name, marker] of Object.entries(data.synergyMarker)) {
          if (marker === myMarker && name !== data.me) { partner = name; break; }
        }

        var partnerIndex = playerOrder.indexOf(partner);
        var myIndex = playerOrder.indexOf(data.me);
        var direction = (myIndex < partnerIndex) ? output.goLeft() : output.goRight();

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
          cn: '${glitch} 1 圆圈 ${direction}',
        },
        cross: {
          // cn: '${glitch} 叉字 ${direction}',
          cn: '${glitch} 2 叉字 ${direction}',
        },
        triangle: {
          // cn: '${glitch} 三角 ${direction}',
          cn: '${glitch} 3 三角 ${direction}',
        },
        square: {
          // cn: '${glitch} 方形 ${direction}',
          cn: '${glitch} 4 方形 ${direction}',
        },
        unknown: Outputs.unknown,
      },
    },
    {
      id: 'TOP Party Synergy Spotlight Stack Markers',
      type: 'HeadMarker',
      netRegex: {},
      condition: (data, matches) => {
        var isStack = (getHeadmarkerId(data, matches) === headmarkers.stack);
        return (!data.synergySpotlightFlag && isStack);
      },
      preRun: (data, matches) => {
        data.synergySpotlightMarkerPlayers.push(matches.target);
      },
    },
    {
      id: 'TOP Party Synergy Spotlight Marker Switch',
      type: 'HeadMarker',
      netRegex: {},
      condition: (data, matches) => {
        var isStack = (getHeadmarkerId(data, matches) === headmarkers.stack);
        return (!data.synergySpotlightFlag && isStack);
      },
      delaySeconds: 1,
      alarmText: (data, _matches, output) => {
        const glitch = data.synergyGlitch
          ? {
            mid: output.midGlitch(),
            remote: output.remoteGlitch(),
          }[data.synergyGlitch]
          : output.unknown();
        
        // There should be exactly 2 player in data.synergySpotlightMarkerPlayers
        const markerPlayers = data.synergySpotlightMarkerPlayers;
        if (markerPlayers.length != 2) return output.unknown();

        var mp0 = markerPlayers[0];
        var mp1 = markerPlayers[1];
        var me0 = playstationMarkerEnum[data.synergyMarker[mp0]];
        var me1 = playstationMarkerEnum[data.synergyMarker[mp1]];
        console.log(mp0, mp1);
        if (data.synergySpotlightGroup[mp0] === data.synergySpotlightGroup[mp1]) {
          // If right group, the enumeration order is reversed.
          var reverseEnum = (data.synergySpotlightGroup[mp0] === 'right' && data.synergyGlitch === 'remote');
          var switchPlayerMarker = ((me0 > me1) != reverseEnum) ? mp0 : mp1;
          var switchPlayerNoMarker = null;
          for (const [name, marker] of Object.entries(data.synergyMarker)) {
            if (marker === switchPlayerMarker && name !== switchPlayerMarker) {
              switchPlayerNoMarker = name;
              break;
            }
          }
          if (switchPlayerNoMarker === null) return output.switchNothing({ glitch: glitch });

          var switchMarkerShape = data.synergyMarker[mp0];
          console.log(switchMarkerShape, switchPlayerMarker, switchPlayerNoMarker);
          return {
            circle: output.switchCircle({ glitch: glitch }),
            triangle: output.switchTriangle({ glitch: glitch }),
            square: output.switchSquare({ glitch: glitch }),
            cross: output.switchCross({ glitch: glitch }),
          }[switchMarkerShape];
        }
        return output.switchNothing({ glitch: glitch });
      },
      run: (data) => {
        data.synergySpotlightFlag = true;
      },
      outputStrings: {
        midGlitch: {
          cn: '中间',
        },
        remoteGlitch: {
          cn: '远离',
        },
        switchCircle: {
          cn: '${glitch} 圆圈交换',
        },
        switchCross: {
          cn: '${glitch} 叉字交换',
        },
        switchTriangle: {
          cn: '${glitch} 三角交换',
        },
        switchSquare: {
          cn: '${glitch} 方形交换',
        },
        switchNothing: {
          cn: '${glitch}'
        },
        unknown: Outputs.unknown,
      },
    },
    {
      id: 'TOP Party Synergy Omega M & F (Overlay)',
      type: 'AddedCombatant',
      type: 'Ability',
      netRegex: { id: '7B3E', source: 'Omega', capture: false },
      // Untargetable 3s after this, things appear ~2 after this, 2.5 for safety.
      delaySeconds: 6,
      promise: async (data) => {
        data.combatantData = [];
        // TODO: filter this by the combatants added right before Party Synergy???
        data.combatantData = (await callOverlayHandler({
          call: 'getCombatants',
        })).combatants;
        console.log(JSON.stringify(data.combatantData));
      },
      alertText: (data, _matches, output) => {
        const omegaMNPCId = 15714;
        const omegaFNPCId = 15715;
        let countM = 0;
        let countF = 0;
        let isFIn = false;
        let isMIn = false;
        for (const c of data.combatantData) {
          if (c.BNpcID === omegaMNPCId) {
            countM++;
            console.log(`M=${countM}`)
            // console.log(c.WeaponId);
            if (c.WeaponId === 4)
              isMIn = true;
          }
          if (c.BNpcID === omegaFNPCId) {
            countF++;
            console.log(`F=${countF}`);
            // console.log(c.WeaponId);
            if (c.WeaponId === 4)
              isFIn = true;
          }
        }
        if (countM === 0 || countF === 0) {
          // console.error(`PartySynergy: missing m/f: ${JSON.stringify(data.combatantData)}`);
          return;
        }
        if (isFIn && isMIn)
          console.log('靠近男人');
        if (isFIn && !isMIn)
          console.log('靠近女人');
        if (!isFIn && isMIn)
          console.log('男人两边');
        if (!isFIn && !isMIn)
          console.log('远离男女');
        // if (isFIn && isMIn)
        //   return output.superliminalStrength();
        // if (isFIn && !isMIn)
        //   return output.superliminalBladework();
        // if (!isFIn && isMIn)
        //   return output.blizzardStrength();
        // if (!isFIn && !isMIn)
        //   return output.blizzardBladework();
      },
      // outputStrings: {
      //   blizzardBladework: {
      //     en: 'Out Out',
      //     de: 'Raus Raus',
      //     cn: '远离男女',
      //   },
      //   superliminalStrength: {
      //     en: 'In In on M',
      //     de: 'Rein Rein auf M',
      //     cn: '靠近男人',
      //   },
      //   superliminalBladework: {
      //     en: 'Under F',
      //     de: 'Unter W',
      //     cn: '靠近女人',
      //   },
      //   blizzardStrength: {
      //     en: 'M Sides',
      //     de: 'Seitlich von M',
      //     cn: '男人两边',
      //   },
      // },
    },
    {
      id: 'TOP Party Synergy Omega M & F (CactbotSelf)',
      type: 'AddedCombatant',
      netRegex: { npcNameId:'7634' }, // ID of BUNSHIN Omega-F
      // type: 'StartsUsing',
      // netRegex: { id: ['7B3E', '7B3F'], source: ['Omega', 'Omega-M', 'Omega-F'] },
      disable: true,
      condition: (data) => { return (!data.synergyTransformFlag && data.synergyTransformTriggerOn) },
      preRun: (data, matches) => {
        data.synergyTransformOmegaFId = matches.id;
      },
      // Omega-M and Omega-F (both with internal name 'Omega') cast Party Synergy.
      // At the same time, several invisible BUNSHINs (1 F and 5 M) are added to game.
      // 8s later, BUNSHINs show up and their forms are determined.
      // Then 4s later, 2 of BUNSHINs (1 M and 1 F) start casting AOEs.
      // Then 1s later, AOEs take their effects.
      delaySeconds: 9,
      suppressSeconds: 30,
      alarmText: (data, _mathces, output) => {
        // Alarm according to data.synergyTransformed
        if (data.synergyTransformFlag) return output.unknown;
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
          cn: '靠近男人', // = superliminalStrength
        },
        fCenter: {
          cn: '靠近女人', // = superliminalBladework
        },
        mSide: {
          cn: '男人两边', // = blizzardStrength
        },
        mfAway: {
          cn: '远离男女', // = blizzardBladework
        },
        unknown: Outputs.unknown,
      },
    },
    {
      id: 'TOP Party Synergy Omega M & F Transform (CactbotSelf)',
      // This NetRegex is not compatible with CACTBOTSELF.DLL.
      // netRegex: /^.{14} (?:\w+ )00:0:106:(?<id>[^:]*):(?<source>[^:]*):0031:.{4}:.{8}:/,
      // This is compatible.
      netRegex: /] ChatLog 00:0:106:(?<id>[^:]*):(?<sourceRaw>[^:]*):0031:.{4}:.{8}:/,
      disable: true,
      condition: (data) => { return (!data.synergyTransformFlag && data.synergyTransformTriggerOn) },
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
      delaySeconds: 15,
      run: (data) => { data.synergyTransformFlag = true; }, // Clean up
    },
    {
      id: 'TOP Code Smell Collector',
      type: 'GainsEffect',
      // D6C Synchronization Code Smell (stack)
      // D6D Overflow Code Smell (defamation)
      // D6E Underflow Code Smell (red)
      // D6F Performance Code Smell (blue)
      // D71 Remote Code Smell (far tethers)
      // DAF Local Code Smell (near tethers)
      // DC9 Local Regression (near tethers)
      // DCA Remote Regression (far tethers)
      // DC4 Critical Synchronization Bug (stack)
      // DC5 Critical Overflow Bug (defamation)
      // DC6 Critical Underflow Bug (red)
      // D65 Critical Performance Bug (blue)
      netRegex: { effectId: ['D6D', 'D6E', 'D6F'] },
      run: (data, matches) => {
        const isDefamation = matches.effectId === 'D6D';
        const isRed = matches.effectId === 'D6E';
        const isBlue = matches.effectId === 'D6F';
        if (isDefamation)
          data.smellDefamation.push(matches.target);
        else if (isRed)
          data.smellRot[matches.target] = 'red';
        else if (isBlue)
          data.smellRot[matches.target] = 'blue';
      },
    },
    {
      id: 'TOP Code Smell Defamation Color',
      type: 'GainsEffect',
      netRegex: { effectId: 'D6D', capture: false },
      delaySeconds: 0.5,
      suppressSeconds: 1,
      alertText: (data, _matches, output) => {
        let rotColor;
        if (data.smellDefamation.length !== 2) {
          console.error(
            `Defamation: missing person: ${JSON.stringify(data.smellDefamation)}, ${
              JSON.stringify(data.smellRot)
            }`,
          );
        }
        for (const target of data.smellDefamation) {
          const color = data.smellRot[target];
          if (color === undefined) {
            console.error(
              `Defamation: missing color: ${JSON.stringify(data.smellDefamation)}, ${
                JSON.stringify(data.smellRot)
              }`,
            );
            continue;
          }
          if (rotColor === undefined) {
            rotColor = color;
            continue;
          }
          if (rotColor !== color) {
            console.error(
              `Defamation: conflicting color: ${JSON.stringify(data.smellDefamation)}, ${
                JSON.stringify(data.smellRot)
              }`,
            );
            rotColor = undefined;
            break;
          }
        }
        data.defamationColor = rotColor;
        if (rotColor === 'red')
          return output.red();
        else if (rotColor === 'blue')
          return output.blue();
        return output.unknown();
      },
      outputStrings: {
        red: {
          en: 'Red Defamation',
          de: 'Rote Ehrenstrafe',
          ko: '빨강 광역',
          cn: '红色大圈',
        },
        blue: {
          en: 'Blue Defamation',
          de: 'Blaue Ehrenstrafe',
          ko: '파랑 광역',
          cn: '蓝色大圈',
        },
        unknown: {
          en: '??? Defamation',
          de: '??? Ehrenstrafe',
          ko: '??? 광역',
          cn: '??? 大圈',
        },
      },
    },
    {
      id: 'TOP Oversampled Wave Cannon Direction',
      type: 'StartsUsing',
      netRegex: { id: ['7B6B', '7B6C'], source: 'Omega' },
      preRun: (data, matches, output) => {
        const abilityId = matches.id;
        if (abilityId === '7B6B') 
          data.omegaWaveCannonDirection = 'east';
        else if (abilityId === '7B6C')
          data.omegaWaveCannonDirection = 'west';
      },
      alarmText: (data, matches, output) => {
        // Strategy: https://www.bilibili.com/video/BV1gA411C7xC/
        const abilityId = matches.id;
        if (abilityId == '7B6B')
          return output.waveCannon({ dir: output.east() });
        else if (abilityId == '7B6C')
          return output.waveCannon({ dir: output.west() });
        else
          return output.unknown();
      },
      outputStrings: {
        east: Outputs.east,
        west: Outputs.west,
        waveCannon: {
          cn: '波动炮打${dir}'
        },
        unknown: Outputs.unknown,
      },
    },
    {
      id: 'TOP Oversampled Wave Cannon Loading Collect',
      type: 'GainsEffect',
      netRegex: { effectId: ['D7C', 'D7D'] },
      run: (data, matches) => {
        data.waveCannonLoadingPlayer.push(matches.target);
      },
    },
    // {
    //   id: 'TOP Oversampled Wave Cannon (Bilibili Strat)',
    //   type: 'GainsEffect',
    //   netRegex: { effectId: ['D7C', 'D7D'] },
    //   delaySeconds: 1.0,
    //   suppressSeconds: 10.0,
    //   alarmText: (data, matches, output) => {
    //     // Strategy: https://www.bilibili.com/video/BV1gA411C7xC/
    //     //
    //     // Waymark:
    //     //     A
    //     //   4   1
    //     // D       B
    //     //   3   2
    //     //     C
    //     //
    //     // B: descend order, D: ascend order
    //     var playerOrder = tdhOrder(data.playerOrderByRole);
    //     var waymark = null;

    //     if (data.waveCannonLoadingPlayer.includes(data.me)) {
    //       var selectedPlayerOrder = [];
    //       if (data.omegaWaveCannonDirection === 'east')
    //         playerOrder.reverse();
    //       for (const player of playerOrder) {
    //         if (data.waveCannonLoadingPlayer.includes(player))
    //           selectedPlayerOrder.push(player);
    //       }
    //       var myIndex = selectedPlayerOrder.indexOf(data.me);
    //       if (data.omegaWaveCannonDirection === 'east') {
    //         switch (myIndex) {
    //         case 0:
    //           waymark = output.waymark1(); break;
    //         case 1:
    //           waymark = output.waymark2(); break;
    //         case 2:
    //           waymark = output.waymark3(); break;
    //         }
    //       }
    //       else {
    //         switch (myIndex) {
    //         case 0:
    //           waymark = output.waymark3(); break;
    //         case 1:
    //           waymark = output.waymark4(); break;
    //         case 2:
    //           waymark = output.waymark1(); break;
    //         }
    //       }
    //       return output.loadingOnMe({ waymark: waymark });
    //     }
    //     else {
    //       var unselectedPlayerOrder = [];
    //       var northMost = null;
    //       if (data.omegaWaveCannonDirection === 'east')
    //         playerOrder.reverse();
    //       for (const player of playerOrder) {
    //         if (!data.waveCannonLoadingPlayer.includes(player))
    //           unselectedPlayerOrder.push(player);
    //       }

    //       if (data.omegaWaveCannonDirection === 'east')
    //         northMost = unselectedPlayerOrder.shift();
    //       else
    //         northMost = unselectedPlayerOrder.pop();
    //       if (northMost === data.me) {
    //         waymark = (data.omegaWaveCannonDirection === 'east') ?
    //           output.waymarkD() : output.waymarkB();
    //       }
    //       else {
    //         if (data.omegaWaveCannonDirection === 'east') {
    //           switch (myIndex) {
    //           case 0:
    //             waymark = output.waymarkA(); break;
    //           case 1:
    //             waymark = output.waymark4(); break;
    //           case 2:
    //             waymark = output.waymarkD(); break;
    //           case 3:
    //             waymark = output.waymarkC(); break;
    //           }
    //         }
    //         else {
    //           switch (myIndex) {
    //           case 0:
    //             waymark = output.waymarkC(); break;
    //           case 1:
    //             waymark = output.waymark2(); break;
    //           case 2:
    //             waymark = output.waymarkB(); break;
    //           case 3:
    //             waymark = output.waymarkA(); break;
    //           }
    //         }
    //       }
    //       return output.loadingNotOnMe({ waymark: waymark });
    //     }
    //   },
    //   outputStrings: {
    //     loadingOnMe: {
    //       cn: '波动炮点名 去${waymark}',
    //     },
    //     loadingNotOnMe: {
    //       cn: '去${waymark}',
    //     },
    //     goFar: {
    //       cn: '去${waymark}外侧'
    //     },
    //     waymarkA: { cn: 'A', },
    //     waymarkB: { cn: 'Boy', },
    //     waymarkC: { cn: 'C', },
    //     waymarkD: { cn: 'Dog', },
    //     waymark1: { cn: '1', },
    //     waymark2: { cn: '2', },
    //     waymark3: { cn: '3', },
    //     waymark4: { cn: '4', },
    //     unknown: Outputs.unknown,
    //   },
    // }
    {
      id: 'TOP Oversampled Wave Cannon (Akito Strat)',
      type: 'GainsEffect',
      netRegex: { effectId: ['D7C', 'D7D'] },
      delaySeconds: 1.0,
      suppressSeconds: 10.0,
      alarmText: (data, matches, output) => {
        var playerOrder = tdhOrder(data.playerOrderByRole);
        var myOrder = null;

        if (data.waveCannonLoadingPlayer.includes(data.me)) {
          var selectedPlayerOrder = [];
          for (const player of playerOrder) {
            if (data.waveCannonLoadingPlayer.includes(player))
              selectedPlayerOrder.push(player);
          }
          var myIndex = selectedPlayerOrder.indexOf(data.me);
          myOrder = myIndex+1;
          return output.loadingOnMe({ order: myOrder });
        }
        else {
          var unselectedPlayerOrder = [];
          for (const player of playerOrder) {
            if (!data.waveCannonLoadingPlayer.includes(player))
              unselectedPlayerOrder.push(player);
          }
          var myIndex = selectedPlayerOrder.indexOf(data.me);
          myOrder = myIndex+1;
          return output.loadingNotOnMe({ order: myOrder });
        }
      },
      outputStrings: {
        loadingOnMe: {
          cn: '波动炮点名 ${order}',
        },
        loadingNotOnMe: {
          cn: '无点名 ${order}',
        },
        unknown: Outputs.unknown,
      },
    }
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
