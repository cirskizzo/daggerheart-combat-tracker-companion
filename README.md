# Daggerheart Combat Tracker Companion

A Foundry VTT v14 module for the [Daggerheart](https://github.com/Foundryborne/daggerheart) system (Foundryborne) that adds the GM conveniences missing from the combat tracker, without touching the system's Spotlight flow.

## Features

### Combat playlist auto-play

- Configure up to **3 combat playlists** in the module settings.
- When a combat starts, music starts automatically:
  - **1 playlist configured** → it starts right away;
  - **2–3 playlists configured** → a dialog lets the GM pick one, or cancel to leave the music unchanged.
- Sounds playing on the **music** channel are **paused**, keeping their position.
- When the combat ends, the combat playlist stops and the paused music **resumes from the same track and position**.
- Works whether the combat is started with the *Begin Combat* button or by giving the Spotlight from the tracker.
- The music state is stored on the Combat, so it is restored correctly even after a page reload mid-combat.

### Inline resources in the combat tracker (GM only)

Under each combatant's name, the GM sees colored values with a tooltip on hover:

| Actor type | Values |
|---|---|
| Character | HP · Stress · Evasion |
| Adversary | HP · Stress · Difficulty |
| Companion | Stress · Evasion |
| NPC | Difficulty (if set) |

Values update live when the actor changes (damage, healing, equipment, effects). Players never see them.

## Installation

In Foundry: **Add-on Modules → Install Module**, paste this manifest URL:

```
https://github.com/cirskizzo/daggerheart-combat-tracker-companion/releases/latest/download/module.json
```

Then enable the module in a Daggerheart world.

## Settings

**Game Settings → Configure Settings → Daggerheart Combat Tracker Companion**

- **Combat playlist 1 / 2 / 3** — playlists offered as combat music. Leave a slot on *None* to disable it.

## Compatibility

- Foundry VTT v14 (verified on 14.369)
- Daggerheart system 2.13.2+

## Languages

English, Italiano.

## License

[MIT](LICENSE)
