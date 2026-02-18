// moderation.js – Slur and hate speech filter

const slurs = [
  'retard', 'retarded', 'r3tard', 'r3t4rd', 'ret4rd', 'ret@rd', 'tard', 't4rd', 'downie',
  'kike', 'k1ke', 'kik3', 'kyke', 'kikey', 'jewboy',
  'tranny', 'tr4nny', 'tr@nny', 'trannies', 'trann1es', 'trannie', 'shemale',
  'spic', 'sp1c', 'sp!c', 'spick', 'beaner', 'wetback',
  'hitler', 'h1tler', 'h!tler', 'heil hitler',
  'nazi', 'n4zi', 'n@zi', 'naz1', 'neo nazi', 'nazism', '88', 'heil',
  'rape', 'r@pe', 'r4pe', 'raped', 'raper', 'rapist',
  'kill yourself', 'kys', 'k!ll yourself', 'k1ll y0urself',
  'hang yourself', 'rope yourself', 'neck yourself',
  'faggot', 'f4ggot', 'f@g', 'f@gg0t', 'fag',
  'nigger', 'n1gger', 'nigg4', 'nigga', 'coon'
];

function normalizeText(text) {
  if (!text) return '';
  let normalized = text.toLowerCase()
    .replace(/[ąćęłńóśźż]/g, c => ({'ą':'a','ć':'c','ę':'e','ł':'l','ń':'n','ó':'o','ś':'s','ź':'z','ż':'z'})[c] || c)
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

module.exports = { containsSlur };
