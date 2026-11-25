/**
 * Daggerheart Combat Tracker Companion - entry point.
 * Registers settings and hooks, then delegates to the feature modules.
 */

import { PlaylistManager } from "./playlist-manager.js";

export const MODULE_ID = "daggerheart-combat-tracker-companion";

/** Setting keys of the combat playlist slots. */
export const PLAYLIST_SETTING_KEYS = ["combatPlaylist1", "combatPlaylist2", "combatPlaylist3"];

/**
 * Build the playlist dropdown for a slot in the settings panel.
 * Called on every render of the settings panel, so the list always reflects the current world playlists.
 * No `choices` on the field on purpose: an ID of a deleted playlist stays a valid string and is ignored later.
 * @param {foundry.data.fields.StringField} _field
 * @param {object} config   Form input config provided by SettingsConfig (name, value, ...)
 * @returns {HTMLSelectElement}
 */
function createPlaylistSelect(_field, config) {
  const options = game.playlists.contents
    .map(p => ({ value: p.id, label: p.name }))
    .sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));
  return foundry.applications.fields.createSelectInput({
    name: config.name,
    value: config.value ?? "",
    options,
    blank: game.i18n.localize("DHCTC.Settings.PlaylistNone"),
    localize: false
  });
}

function registerSettings() {
  PLAYLIST_SETTING_KEYS.forEach((key, i) => {
    game.settings.register(MODULE_ID, key, {
      name: `DHCTC.Settings.Playlist${i + 1}`,
      hint: "DHCTC.Settings.PlaylistHint",
      scope: "world",
      config: true,
      type: new foundry.data.fields.StringField({ required: true, blank: true, initial: "" }),
      default: "",
      input: createPlaylistSelect
    });
  });
}

Hooks.once("init", () => {
  registerSettings();
  PlaylistManager.registerHooks();
});
