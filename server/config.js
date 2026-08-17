require('dotenv').config({ quiet: true });

var path = require('path');

/**
 * Un solo servicio atiende a todas las personas: cada una entra con su usuario
 * y ve unicamente sus propios datos. Antes habia un proceso por persona; ahora
 * la separacion la hace el user_id en la base.
 */
function getConfig() {
  var dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

  return {
    port: Number(process.env.PORT) || 3001,
    dbPath: path.join(dataDir, process.env.DB_FILE || 'finanzas.db'),
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    botTokenEnv: 'TELEGRAM_BOT_TOKEN',
    hasAI: Boolean(process.env.ANTHROPIC_API_KEY),
    hasPrices: Boolean(process.env.CMC_API_KEY),
    isProduction: process.env.NODE_ENV === 'production'
  };
}

module.exports = { getConfig: getConfig };
