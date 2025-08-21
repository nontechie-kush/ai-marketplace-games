export const cfg = {
  creationEnabled: process.env.CREATION_ENABLED === 'true',
  quotaGamesPerDay: Number(process.env.QUOTA_GAMES_PER_DAY || 1),
  quotaMsgsPerGame: Number(process.env.QUOTA_MSGS_PER_GAME || 10),
  aiModel: process.env.AI_MODEL || 'claude-3-haiku-20240307',
};
