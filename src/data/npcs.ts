import { game } from '../state/gameStore';
import { saveNow } from '../state/session';
import { ui } from '../state/uiStore';
import type { Facing } from '../state/types';
import type { Dialogue } from './dialogue';
import { EMBERS, embersPlaced, GLOWCAP_GOAL, MASTERWORK_COST, SLIME_GOAL, slimesSlainForQuest } from './quests';

export interface NpcDef {
  id: string;
  name: string;
  /** Character sprite id (see art/registry CHARACTERS), or 'cat'. */
  sprite: string;
  facing?: Facing;
  /** Tiles the NPC may amble away from its post. */
  wander?: number;
  visible?: () => boolean;
  talk: () => Dialogue;
}

const has = (flag: string) => !!game.flag(flag);
const bye = { label: 'Goodbye.' };

function emberHint(): string {
  const d = game.data;
  const held = EMBERS.filter((e) => (d.inventory[e.id] ?? 0) > 0);
  if (held.length) return `You've got the ${held[0].name}! Set it in the Hearthlight, quick, before it forgets what it is.`;
  if (!d.flags['placed:verdant']) return 'Whisperwood first. North, past the old gate. I felt the Verdant Ember fall somewhere in the deep trees.';
  if (!d.flags['placed:stone']) return 'The Verdant Ember gave you fire. Use it. The east road to Hollowdeep is choked with Gloam-thorn, and thorn burns.';
  if (!d.flags['placed:tide']) return "The Stone Ember will carry you over gaps that would swallow anyone else. Ferrin's bridge in Saltmere is down. It won't stop you now.";
  return '';
}

export const NPCS: Record<string, NpcDef> = {
  maren: {
    id: 'maren',
    name: 'Keeper Maren',
    sprite: 'maren',
    facing: 'right',
    talk: () => {
      const d = game.data;
      if (game.questDone('main')) {
        return {
          lines: [
            'Dawn. Actual dawn. I had forgotten the colour of it.',
            "You did that. Don't let it go to your head, mind. Somebody still has to sweep the ash out of that brazier.",
          ],
        };
      }
      if ((d.quests.main?.stage ?? 0) >= 2) {
        return {
          lines: [
            'The shrine has torn open. You can feel it from here, like a draught under a door.',
            "The Hollow King waits beneath. Rest by the Hearthlight, stock up, and go when you're ready.",
            'And come back. That part is not optional.',
          ],
        };
      }
      return {
        lines: [emberHint() || 'The Hearthlight still holds. Just about.'],
        choices: [
          {
            label: 'Tell me about the Gloam.',
            then: {
              lines: [
                'Before the Hearthlight, this valley was dark nine months of the year. The Gloam is what lives in that dark. It is hungry, and patient, and very old.',
                'The first Keepers bound three Embers into the brazier: one of the green, one of the stone, one of the tide. Light enough to hold it back.',
                'Last night something reached up out of the dark and tore them loose. I saw a crown in the smoke. Make of that what you will.',
              ],
            },
          },
          {
            label: 'Where should I go?',
            then: {
              lines: [
                'Whisperwood lies north. Hollowdeep Mine lies east, along the old road. Saltmere and the Drowned Chapel are south.',
                emberHint() || 'You know the way as well as I do now.',
                'Rest by the Hearthlight whenever you need to. It still has enough warmth to mend you. And it remembers where you have been.',
              ],
            },
          },
          bye,
        ],
      };
    },
  },

  bram: {
    id: 'bram',
    name: 'Bram the Smith',
    sprite: 'bram',
    facing: 'down',
    talk: () => {
      const ringActive = game.questActive('ring');
      const hasRing = game.has('foremans_ring');
      if (ringActive && hasRing) {
        return {
          lines: [
            '...',
            "That's it. That's my ring. Thirty-one years Edda's been telling me I'd lose my head if it weren't screwed on.",
            "Here. A miner's glimmer-glass. Kept me alive down there more times than I'll say in front of my wife. And some coin. Don't argue.",
          ],
          onEnd: () => {
            game.takeItem('foremans_ring');
            game.giveItem('glimmer_charm');
            game.addGold(100);
            ui.toast('+100 gold', 'item', 'icon_charm_coin');
            game.completeQuest('ring');
          },
        };
      }
      const masterworkReady = game.questActive('masterwork') && game.has('starsilver');
      if (masterworkReady) {
        const canPay = game.data.gold >= MASTERWORK_COST;
        return {
          lines: ['Starsilver. Real starsilver. I could make you something with this that would make the old Keepers weep.', `I'll need ${MASTERWORK_COST} gold for the fuel and the flux, mind. Starsilver's fussy.`],
          choices: [
            {
              label: `Forge it. (${MASTERWORK_COST} gold)`,
              when: () => canPay,
              action: () => {
                game.spendGold(MASTERWORK_COST);
                game.takeItem('starsilver');
                game.giveItem('emberbrand');
                game.completeQuest('masterwork');
              },
              then: {
                lines: [
                  '(Bram works through the night. The hammering never stops. Neither, oddly, does his humming.)',
                  'There. The Emberbrand. Take it before I decide to keep it.',
                ],
              },
            },
            { label: "I don't have enough gold yet.", when: () => !canPay, then: { lines: ["It'll keep. Starsilver's patient. More patient than me."] } },
            bye,
          ],
        };
      }
      const choices = [
        { label: 'Show me your wares.', action: () => ui.openShop('forge') },
        {
          label: 'You seem troubled.',
          when: () => !game.quest('ring'),
          then: {
            lines: [
              "Troubled. Hah. I was foreman down at Hollowdeep before it closed. When the Gloam came up through the deep shafts, we ran. I lost my wedding ring in the scramble.",
              "Edda says it doesn't matter. It matters.",
            ],
            choices: [
              { label: "I'll look for it.", action: () => game.startQuest('ring'), then: { lines: ['...You would? Then mind the deep workings. And the skeletons. Some of them were good lads, once.'] } },
              { label: 'Sorry, Bram.', then: { lines: ["Aye. Me too."] } },
            ],
          },
        },
        {
          label: 'Ever worked starsilver?',
          when: () => !game.quest('masterwork') && (game.questDone('ring') || !!game.flag('boss:colossus')),
          then: {
            lines: [
              "Starsilver? Once, as an apprentice. My master nearly wept.",
              "There's a vein of it somewhere in the deepest part of Hollowdeep. Past where any sane miner would go. Bring me some and I'll make you something worth the name.",
            ],
            onEnd: () => game.startQuest('masterwork'),
          },
        },
        bye,
      ];
      return { lines: ['Forge is hot. What do you need?'], choices };
    },
  },

  edda: {
    id: 'edda',
    name: 'Edda',
    sprite: 'edda',
    wander: 2,
    talk: () => {
      if (game.questDone('ring')) {
        return { lines: ["He hasn't taken that ring off since you brought it back. He keeps looking at it when he thinks I'm not watching.", 'Thank you, love. Truly.'] };
      }
      if (!has('edda_gift')) {
        return {
          lines: [
            "You're off out there, aren't you? Into all that?",
            "Here. Take a draught. Ivo brews them, but I put the honey in, so they're half mine.",
          ],
          onEnd: () => {
            game.setFlag('edda_gift');
            game.giveItem('draught');
          },
        };
      }
      return { lines: ['Bram pretends he doesn\'t miss the mine. He talks about it in his sleep.', "If you're going down there, and you see a ring... well. Never mind."] };
    },
  },

  ivo: {
    id: 'ivo',
    name: 'Ivo the Herbalist',
    sprite: 'ivo',
    facing: 'down',
    talk: () => {
      const q = game.quest('glowcaps');
      if (q?.status === 'active' && game.count('glowcap') >= GLOWCAP_GOAL) {
        return {
          lines: [
            'Are those...? They ARE. Five perfect glowcaps. Do you know what I can do with these?',
            "Don't answer that, it's mostly explosions. But some of it is medicine! Here, this charm is dried glowcap set in silver. Sharpens the mind. And take a couple of my strongest draughts.",
            "I'll keep the good stuff on the shelf from now on. Greater draughts. Elixirs! Proper alchemy!",
          ],
          onEnd: () => {
            game.takeItem('glowcap', GLOWCAP_GOAL);
            game.giveItem('sage_charm');
            game.giveItem('greater_draught', 2);
            game.completeQuest('glowcaps');
          },
        };
      }
      const choices = [
        { label: 'Let me see your remedies.', action: () => ui.openShop('apothecary') },
        {
          label: 'Need anything?',
          when: () => !q,
          then: {
            lines: [
              'Need anything! Glowcaps, is what I need. Glow. Caps. They grow where it is damp and dark and frankly unpleasant.',
              `Bring me ${GLOWCAP_GOAL} and I'll brew you things that would make a corpse sit up and ask for seconds.`,
            ],
            onEnd: () => game.startQuest('glowcaps'),
          },
        },
        bye,
      ];
      const greet = q?.status === 'active' ? `Glowcaps! I need ${GLOWCAP_GOAL}. You have ${game.count('glowcap')}. I'm not counting. I'm absolutely counting.` : 'Tinctures! Tonics! Mostly safe!';
      return { lines: [greet], choices };
    },
  },

  tamsin: {
    id: 'tamsin',
    name: 'Old Tamsin',
    sprite: 'tamsin',
    facing: 'down',
    talk: () => {
      const q = game.quest('whiskers');
      if (q?.status === 'complete') {
        return { lines: ["He's been asleep on my good cushion since you brought him back. Sixteen hours. I've had to sit on the stool.", 'Worth it.'] };
      }
      if (q && q.stage >= 1) {
        return {
          lines: [
            "He came strolling in an hour ago like nothing had happened! Bold as brass, wanting his supper.",
            'You found him, didn\'t you? Of course you did. Here, take this. It was my Harold\'s. Made him quick on his feet, he always said. Quick to the pub, mostly.',
          ],
          onEnd: () => {
            game.giveItem('feather_charm');
            game.completeQuest('whiskers');
          },
        };
      }
      if (q) return { lines: ['Whisperwood. He\'ll be somewhere in Whisperwood. Ginger. Fat. Opinionated.', 'Bring him home. Please.'] };
      return {
        lines: [
          "You've not seen a cat, have you? Ginger. Fat. Answers to Whiskers, when he feels like it, which is never.",
          'He went off into Whisperwood after a squirrel three days ago. He is an idiot. But he is MY idiot.',
        ],
        choices: [
          { label: "I'll keep an eye out.", action: () => game.startQuest('whiskers'), then: { lines: ["Bless you. He likes being scratched behind the left ear. NOT the right. He'll take your hand off."] } },
          { label: "Sorry, I'm busy.", then: { lines: ['Busy. Hmph. Everyone\'s busy when the world\'s ending.'] } },
        ],
      };
    },
  },

  whiskers: {
    id: 'whiskers',
    name: 'Whiskers',
    sprite: 'cat',
    visible: () => !!game.flag('cat_found'),
    talk: () => ({ lines: [{ who: '', text: 'Whiskers regards you with magnificent indifference.' }, { who: 'Whiskers', text: 'Mrrp.' }] }),
  },

  wendell: {
    id: 'wendell',
    name: 'Farmer Wendell',
    sprite: 'wendell',
    facing: 'down',
    talk: () => {
      const q = game.quest('slimes');
      if (q?.status === 'complete') return { lines: ["Turnips are coming on lovely. Lovely.", "The slimes'll be back, mind. They always come back. Like weeds. Wet weeds."] };
      if (q?.status === 'active') {
        const n = slimesSlainForQuest(game.data);
        if (n >= SLIME_GOAL) {
          return {
            lines: [`${n} slimes? That'll do it. That'll do it nicely.`, "Here. Found this in a furrow years ago. Two heads, no tails. Lucky, I reckon. Never did me any good, but you look like you could use luck more than me."],
            onEnd: () => {
              game.giveItem('lucky_coin');
              game.addGold(50);
              ui.toast('+50 gold', 'item', 'icon_charm_coin');
              game.completeQuest('slimes');
            },
          };
        }
        return { lines: [`That's ${n} so far. Need ${SLIME_GOAL}, or they'll just come back. They're in the field there, and all over the woods besides.`] };
      }
      return {
        lines: ['Slimes.', 'In my turnips.', 'Again.'],
        choices: [
          {
            label: "I'll deal with them.",
            action: () => {
              game.setFlag('slimes_base', (game.data.killsByType['slime'] ?? 0) + (game.data.killsByType['bog_slime'] ?? 0) + (game.data.killsByType['cave_slime'] ?? 0));
              game.startQuest('slimes');
            },
            then: { lines: [`Kill ${SLIME_GOAL} and they'll leave off for a season. Any slimes, mind. They all talk to each other. Somehow.`] },
          },
          { label: 'Good luck with that.', then: { lines: ['...Aye.'] } },
        ],
      };
    },
  },

  pip: {
    id: 'pip',
    name: 'Pip',
    sprite: 'pip',
    wander: 3,
    talk: () => {
      const d = game.data;
      const lines: string[] = [];
      if (game.questDone('main')) lines.push("You beat the HOLLOW KING? With a SWORD? Can I hold it? I won't drop it. I'll probably drop it.");
      else if (!d.abilities.bolt) lines.push("If you hold down the shield— wait, you don't have a shield. Never mind. Just hit things! Press J or Space!");
      else if (!d.abilities.dash) lines.push('Can you really throw fire now?! Do it at the thorns on the east road! Do it at the well! ...Don\'t do it at the well.');
      else if (!d.abilities.radiance) lines.push("Mum says when you dash you can't get hurt. Like, for a second. I dashed into a door and got hurt, so I think it's only for you.");
      else lines.push("Mum says the Hollow King used to be a Keeper, a long time ago. Before he got all... crowny.");
      return { lines, next: { lines: ['Tip: Press Q for your journal, I for your bag, and M for the map. Esc to pause. I read that on a sign. There isn\'t a sign.'] } };
    },
  },

  holt: {
    id: 'holt',
    name: 'Guard Holt',
    sprite: 'holt',
    facing: 'down',
    talk: () => {
      const d = game.data;
      if (has('boss:abbess')) return { lines: ['They say the singing out at Saltmere has stopped. I slept the whole night through. First time in a year.'] };
      if (!d.abilities.dash) {
        return {
          lines: ["Saltmere's that way. Bridge is out, though. Storm took it.", "So unless you've learned to fly, I'd look elsewhere. Whisperwood's north. The mine's east."],
        };
      }
      return { lines: ['Learned to fly, have you? Well. Go on then.', 'The Drowned Chapel used to be beautiful. Now it\'s just drowned. Mind yourself.'] };
    },
  },

  ferrin: {
    id: 'ferrin',
    name: 'Ferrin',
    sprite: 'ferrin',
    facing: 'down',
    talk: () => {
      if (has('boss:abbess')) return { lines: ["The singing's stopped.", 'Forty years I fished under that sound. Now I can hear the gulls again. Noisy beggars.'] };
      const gift = !has('ferrin_gift');
      return {
        lines: [
          "Bridge went in the storm. Chapel's over there, past the ravine.",
          'Something sings in it at night. The Abbess, they say, though she drowned with the rest of them a hundred years back.',
          "I'd not go, if I were you. But I'm not you, am I.",
          ...(gift ? ["Here. Tonic. Sea air makes the head foggy. This'll clear it."] : []),
        ],
        onEnd: () => {
          if (gift) {
            game.setFlag('ferrin_gift');
            game.giveItem('tonic');
          }
        },
      };
    },
  },
};

/** Dialogue for the Hearthlight brazier in the village square. */
export function hearthDialogue(): Dialogue {
  const d = game.data;
  const held = EMBERS.filter((e) => (d.inventory[e.id] ?? 0) > 0 && !d.flags[`placed:${e.key}`]);
  if (held.length) {
    const lines: Dialogue['lines'] = [];
    for (const e of held) {
      lines.push({ who: '', text: `You set the ${e.name} into the brazier. The flame catches it, and leaps.` });
    }
    const willBe = embersPlaced(d) + held.length;
    if (willBe >= 3) {
      lines.push({ who: '', text: 'All three Embers burn together. The Hearthlight roars up white-gold, and for a moment the whole valley is lit like noon.' });
      lines.push({ who: '', text: 'Then, far to the north-east, stone groans. Something old has woken. The shrine...' });
      lines.push({ who: 'Keeper Maren', portrait: 'maren', text: 'The light has found him. Which means he has found us. The Hollow King is beneath the shrine.' });
      lines.push({ who: 'Keeper Maren', portrait: 'maren', text: 'Rest. Prepare. And then end this.' });
    } else {
      lines.push({ who: 'Keeper Maren', portrait: 'maren', text: willBe === 1 ? 'One. One is a start. One is a great deal more than none.' : 'Two. I can feel the cold backing away from the walls.' });
    }
    return {
      id: 'hearth_place',
      lines,
      onEnd: () => {
        for (const e of held) {
          game.takeItem(e.id);
          game.setFlag(`placed:${e.key}`);
        }
        const n = embersPlaced(game.data);
        if (n >= 3) {
          game.setFlag('rift_open');
          game.setStage('main', 2);
        } else {
          game.setStage('main', 1);
        }
      },
    };
  }
  const n = embersPlaced(d);
  const desc = n >= 3 ? 'The Hearthlight burns tall and steady, three Embers bright in its heart.' : `The Hearthlight burns low. ${n} of 3 Embers glow in its heart.`;
  return {
    lines: [{ who: '', text: desc }],
    choices: [
      {
        label: 'Rest by the fire. (Restore and save)',
        action: () => game.fullRestore(),
        then: { id: 'rest', lines: [{ who: '', text: 'You rest a while. The warmth soaks into your bones.' }], onEnd: () => void saveNow() },
      },
      { label: 'Move on.' },
    ],
  };
}

/** Dialogue for finding Whiskers in the wood. */
export function catDialogue(): Dialogue {
  return {
    lines: [
      { who: '', text: 'A fat ginger cat glares at you from a hollow log.' },
      { who: 'Whiskers', text: 'Mrrrow.' },
      { who: '', text: 'He allows exactly one scratch behind the left ear, then trots off toward the village with his tail in the air.' },
    ],
    onEnd: () => {
      game.setFlag('cat_found');
      game.setStage('whiskers', 1);
    },
  };
}
