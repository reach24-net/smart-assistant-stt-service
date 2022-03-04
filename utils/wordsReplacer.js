const words = [
  {
    from: ["jessi", "jesse", "chelsea"],
    to: "chassis",
  },
  {
    from: ["Jessi", "Jesse", "Chelsea"],
    to: "Chassis",
  },
  {
    from: ["Jessi", "Jesse", "Chelsea"],
    to: "Chassis",
  },
];

function wordsReplacer(text) {
  let tempText = text;

  for (let i = 0; i < words.length; i++) {
    let tempWord = words[i];
    for (let j = 0; j < tempWord.from.length; j++) {
      if (tempText.search(tempWord.from[j]) !== -1) {
        console.log("Replacing from ", tempWord.from[j], " to ", tempWord.to);
        tempText = tempText.replace(tempWord.from[j], tempWord.to);
      }
    }
  }
  return tempText;
}

module.exports = { wordsReplacer };
