// moderation.js – Slur and hate speech filter (blocks targeted insults, no regular profanity)

const slurs = [
  // Provided slurs + common variants, leetspeak, and evasions
  'retard', 'retarded', 'r3tard', 'r3t4rd', 'ret4rd', 'ret@rd', 'tard', 't4rd', 'downie',
  'kike', 'k1ke', 'kik3', 'kyke', 'kikey', 'jewboy', 'kike lover',
  'tranny', 'tr4nny', 'tr@nny', 'trannies', 'trann1es', 'trannie', 'tr4nn13', 'shemale', 'shem@le',
  'spic', 'sp1c', 'sp!c', 'spick', 'sp!ck', 'beaner', 'wetback',
  'hitler', 'h1tler', 'h!tler', 'heil hitler', 'hitlerjugend', 'nazihitler',
  'nazi', 'n4zi', 'n@zi', 'naz1', 'neo nazi', 'neonazi', 'nazism', 'nazi ss', '88', 'heil',
  'rape', 'r@pe', 'r4pe', 'raped', 'raper', 'rapist', 'rape her', 'rape fantasy', 'rape ape',
  'kill yourself', 'kys', 'k!ll yourself', 'kys yourself', 'kill ur self', 'k1ll y0urself',
  'hang yourself', 'rope yourself', 'neck yourself', 'self rope',

  // Additional heavy slurs
  'faggot', 'f4ggot', 'f@g', 'f@gg0t', 'fag',
  'nigger', 'n1gger', 'nigg4', 'nigga', 'coon', 'spook',
  'pedal', 'p3dal', 'ped@ł', 'ciota', 'c10ta', 'c!ota', 'pedzio', 'pedziu',
  'czarnuch', 'cz4rnuch', 'murzyn', // offensive usage
  'kacap', 'ruski chuj'
];

function normalizeText(text) {
  if (!text) return '';
  let normalized = text.toLowerCase()
    .replace(/[ąćęłńóśźż]/g, c => ({
      'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n',
      'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z'
    })[c] || c)
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized;
}

function containsSlur(text) {
  if (!text) return false;
  const normalized = normalizeText(text);

  const words = normalized.split(' ');
  for (const word of words) {
    if (slurs.includes(word)) return true;
  }

  for (const slur of slurs) {
    if (normalized.includes(slur)) return true;
  }

  return false;
}

function censorSlurs(text) {
  let censored = text;

  slurs.forEach(slur => {
    const regexWord = new RegExp(`\\b${escapeRegExp(slur)}\\b`, 'gi');
    censored = censored.replace(regexWord, '***');

    const regexPart = new RegExp(escapeRegExp(slur), 'gi');
    censored = censored.replace(regexPart, match => '*'.repeat(match.length));
  });

  return censored;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  containsSlur,
  censorSlurs
};
