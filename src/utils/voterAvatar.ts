const boyImage = require("../../assets/icons/boy.png");
const girlImage = require("../../assets/icons/girl.png");
const manImage = require("../../assets/icons/man.png");
const womenImage = require("../../assets/icons/women.png");
const oldMenImage = require("../../assets/icons/old-man.png");
const oldWomenImage = require("../../assets/icons/old-women.png");

const femaleLabels = new Set([
  "f", "female", "woman", "women",
  "महिला", "स्त्री", "औरत", "मादा",
  "ਇਸਤਰੀ", "ਇਸਤ੍ਰੀ", "ਔਰਤ", "ਮਹਿਲਾ", "ਜਨਾਨੀ",
]);

export function getDefaultVoterAvatar(gender: string, age: number) {
  const label = String(gender ?? "")
    .normalize("NFC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase();
  const isFemale = femaleLabels.has(label);

  if (age < 35) return isFemale ? girlImage : boyImage;
  if (age <= 70) return isFemale ? womenImage : manImage;
  return isFemale ? oldWomenImage : oldMenImage;
}
