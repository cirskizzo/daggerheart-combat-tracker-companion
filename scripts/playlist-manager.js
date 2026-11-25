/**
 * Feature 1 - Combat playlist auto-play.
 *
 * On combat start a single configured playlist starts automatically; with 2+ the GM picks one (or cancels).
 * Music-channel sounds that are playing get paused (position saved), the chosen playlist starts.
 * On combat deletion the combat playlist stops and the paused sounds resume from the saved position.
 * State is stored in flags on the Combat document, so it survives a reload mid-combat.
 */

import { MODULE_ID, PLAYLIST_SETTING_KEYS } from "./daggerheart-combat-tracker-companion.js";

const FLAG_PAUSED = "pausedSounds";
const FLAG_COMBAT_PLAYLIST = "combatPlaylistId";

export class PlaylistManager {
  static registerHooks() {
    // Not `combatStart`: Daggerheart also starts a combat when the GM gives spotlight from the tracker
    // (DhCombatTracker#setCombatantSpotlight updates round 0 -> 1 directly, bypassing startCombat()).
    // Every start path goes through a round 0 -> 1+ update, so that transition is the single trigger.
    Hooks.on("preUpdateCombat", (combat, changed) => {
      if (!combat.round && (changed.round > 0)) this.#onCombatStart(combat);
    });
    Hooks.on("deleteCombat", combat => this.#onCombatEnd(combat));
  }

  /* -------------------------------------------- */

  /**
   * Called on combat start. `preUpdateCombat` only fires on the client that requested the update,
   * so the dialog appears once, on the GM who started the combat. Not awaited by the hook on purpose:
   * the combat update proceeds while the dialog is open.
   * @param {Combat} combat
   */
  static async #onCombatStart(combat) {
    if (!game.user.isGM) return;

    const playlists = this.#getConfiguredPlaylists();
    if (!playlists.length) return;

    // A single configured playlist starts automatically; the dialog is shown only for 2+
    const chosen = playlists.length === 1 ? playlists[0] : await this.#choosePlaylist(playlists);
    if (!chosen) return;

    // The combat may have been deleted while the dialog was open
    if (!game.combats.has(combat.id)) return;

    try {
      const paused = await this.#pauseMusic();
      await combat.update({
        [`flags.${MODULE_ID}`]: { [FLAG_PAUSED]: paused, [FLAG_COMBAT_PLAYLIST]: chosen.id }
      });
      await chosen.playAll();
    } catch (err) {
      console.error(`${MODULE_ID} | Failed to start combat playlist`, err);
    }
  }

  /* -------------------------------------------- */

  /**
   * `deleteCombat` fires on every client: only the active GM acts, to avoid duplicate updates.
   * @param {Combat} combat   The deleted combat (its flags are still readable)
   */
  static async #onCombatEnd(combat) {
    if (!game.users.activeGM?.isSelf) return;

    const combatPlaylistId = combat.getFlag(MODULE_ID, FLAG_COMBAT_PLAYLIST);
    const paused = combat.getFlag(MODULE_ID, FLAG_PAUSED) ?? [];
    if (!combatPlaylistId && !paused.length) return; // GM cancelled, or no playlist configured

    try {
      // Leave the combat playlist alone if the GM already stopped it manually
      const combatPlaylist = game.playlists.get(combatPlaylistId);
      if (combatPlaylist?.playing) await combatPlaylist.stopAll();

      await this.#resumeMusic(paused);
    } catch (err) {
      console.error(`${MODULE_ID} | Failed to restore music after combat`, err);
    }
  }

  /* -------------------------------------------- */

  /**
   * Playlists selected in the 3 setting slots, skipping empty slots, duplicates and deleted playlists.
   * @returns {Playlist[]}
   */
  static #getConfiguredPlaylists() {
    const ids = new Set(PLAYLIST_SETTING_KEYS.map(key => game.settings.get(MODULE_ID, key)).filter(Boolean));
    return [...ids].map(id => game.playlists.get(id)).filter(Boolean);
  }

  /* -------------------------------------------- */

  /**
   * Ask the GM which playlist to start.
   * @param {Playlist[]} playlists
   * @returns {Promise<Playlist|null>}  The chosen playlist, or null if cancelled / closed
   */
  static async #choosePlaylist(playlists) {
    const content = await foundry.applications.handlebars.renderTemplate(
      `modules/${MODULE_ID}/templates/playlist-choice.hbs`, {}
    );
    const buttons = playlists.map((p, i) => ({
      action: `playlist${i}`,
      icon: "fa-solid fa-music",
      label: p.name,
      callback: () => p.id
    }));
    buttons.push({
      action: "cancel",
      icon: "fa-solid fa-xmark",
      label: "DHCTC.PlaylistChoice.None",
      callback: () => null
    });

    const id = await foundry.applications.api.DialogV2.wait({
      window: { title: "DHCTC.PlaylistChoice.Title", icon: "fa-solid fa-music" },
      content,
      buttons,
      rejectClose: false
    });
    return id ? game.playlists.get(id) ?? null : null;
  }

  /* -------------------------------------------- */

  /**
   * Pause every playing sound whose effective channel is "music", saving its position.
   * @returns {Promise<{playlistId: string, soundId: string, pausedTime: number}[]>}
   */
  static async #pauseMusic() {
    const paused = [];
    for (const playlist of game.playlists) {
      if (!playlist.playing) continue;

      const toPause = playlist.sounds.filter(s => s.playing && (s.channel || playlist.channel) === "music");
      if (!toPause.length) continue;

      const updates = toPause.map(s => {
        const pausedTime = s.sound?.currentTime ?? s.pausedTime ?? 0;
        paused.push({ playlistId: playlist.id, soundId: s.id, pausedTime });
        return { _id: s.id, playing: false, pausedTime };
      });
      // Keep the playlist flagged as playing if it still has sounds on other channels
      const stillPlaying = playlist.sounds.some(s => s.playing && !toPause.includes(s));
      await playlist.update({ playing: stillPlaying, sounds: updates });
    }
    return paused;
  }

  /* -------------------------------------------- */

  /**
   * Resume the sounds paused by #pauseMusic from their saved position.
   * Sounds or playlists deleted in the meantime are skipped.
   * @param {{playlistId: string, soundId: string, pausedTime: number}[]} paused
   */
  static async #resumeMusic(paused) {
    const byPlaylist = Map.groupBy(paused, e => e.playlistId);
    for (const [playlistId, entries] of byPlaylist) {
      const playlist = game.playlists.get(playlistId);
      if (!playlist) continue;

      const sounds = entries
        .filter(e => playlist.sounds.has(e.soundId))
        .map(e => ({ _id: e.soundId, playing: true, pausedTime: e.pausedTime }));
      if (sounds.length) await playlist.update({ playing: true, sounds });
    }
  }
}
