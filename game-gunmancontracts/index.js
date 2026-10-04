const path = require('path');
const { fs, util } = require('vortex-api');

// Nexus domain: https://www.nexusmods.com/gunmancontractsstandalone
const GAME_ID = 'gunmancontractsstandalone';
const STEAM_ID = '2421750';
const EXE_NAME = 'GunmanContracts.exe';
const MELON_URL = 'https://github.com/LavaGang/MelonLoader/releases';
const NOTIF_ID = 'gunmancontracts-melonloader-missing';

function findGame() {
  return util.GameStoreHelper.findByAppId([STEAM_ID])
    .then(game => game.gamePath);
}

// Mods are MelonLoader plugins: <game>\Mods\<Mod>.dll
async function setup(api, discovery) {
  try {
    await fs.ensureDirWritableAsync(path.join(discovery.path, 'Mods'));
  } catch (err) {
    api.showErrorNotification('Failed to set up Gunman Contracts', err);
    throw err;
  }

  // MelonLoader is a separate install; without it the Mods folder is ignored.
  try {
    await fs.statAsync(path.join(discovery.path, 'MelonLoader'));
    api.dismissNotification(NOTIF_ID);
  } catch (err) {
    api.sendNotification({
      id: NOTIF_ID,
      type: 'warning',
      title: 'MelonLoader is not installed',
      message: 'Gunman Contracts mods need MelonLoader 0.7.x (Unity 6; 0.6.x does not work).',
      actions: [
        { title: 'Get MelonLoader', action: () => util.opn(MELON_URL).catch(() => undefined) },
      ],
    });
  }
}

// Archives that already contain a Mods\ folder deploy as-is. A bare .dll at the
// top level is a MelonLoader mod too, so put it into Mods\.
function testSupportedBareDll(files, gameId) {
  const relevant = files.filter(f => !f.endsWith(path.sep) && !f.endsWith('/'));
  const bare = relevant.filter(f => !f.includes('/') && !f.includes('\\') && path.extname(f).toLowerCase() === '.dll');
  const hasModsDir = relevant.some(f => /^mods[\\/]/i.test(f));
  return Promise.resolve({
    supported: gameId === GAME_ID && bare.length > 0 && !hasModsDir,
    requiredFiles: [],
  });
}

function installBareDll(files) {
  const instructions = files
    .filter(f => !f.endsWith(path.sep) && !f.endsWith('/'))
    .map(f => ({
      type: 'copy',
      source: f,
      destination: path.join('Mods', f),
    }));
  return Promise.resolve({ instructions });
}

function main(context) {
  context.registerGame({
    id: GAME_ID,
    name: 'Gunman Contracts',
    mergeMods: true,
    logo: 'gameart.png',
    queryPath: findGame,
    queryModPath: () => '.',
    executable: () => EXE_NAME,
    requiredFiles: [EXE_NAME],
    setup: discovery => setup(context.api, discovery),
    environment: {
      SteamAPPId: STEAM_ID,
    },
    details: {
      steamAppId: parseInt(STEAM_ID, 10),
    },
  });

  context.registerInstaller('gunmancontracts-bare-dll', 25, testSupportedBareDll, installBareDll);

  return true;
}

module.exports = {
  default: main,
};
