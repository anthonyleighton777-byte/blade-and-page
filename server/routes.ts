import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertRatingSchema, insertBookSchema } from "@shared/schema";
import https from "https";
import crypto from "crypto";

// Persistent session — looks up token from DB, not memory
function getSession(token: string | undefined): number | null {
  if (!token) return null;
  const user = storage.getUserByToken(token);
  return user ? user.id : null;
}

const SEED_BOOKS = [
  // ═══════════════════════════════════════════════════
  // WUXIA
  // ═══════════════════════════════════════════════════
  {
    title: "The Art of Prophecy",
    author: "Wesley Chu",
    genre: "wuxia",
    subgenres: JSON.stringify(["wuxia", "high_fantasy"]),
    description: "A chosen hero trained his whole life—then the prophecy changes. Epic martial arts with deep character arcs and a sharp deconstruction of the chosen-one trope.",
    martialArtsScore: 5, magicScore: 3, characterScore: 5,
    seriesName: "War Arts Saga", seriesBook: 1,
    coverColor: "#0f2027", coverAccent: "#c94b4b",
    publishYear: 2022, tags: JSON.stringify(["chosen-one", "martial arts", "training", "deception", "eastern-inspired", "war"]),
  },
  {
    title: "Jade City",
    author: "Fonda Lee",
    genre: "wuxia",
    subgenres: JSON.stringify(["wuxia", "urban", "crime"]),
    description: "Clan warfare in a city where jade grants supernatural martial powers. The Godfather meets wuxia—exceptional character work across a sprawling cast.",
    martialArtsScore: 5, magicScore: 4, characterScore: 5,
    seriesName: "Green Bone Saga", seriesBook: 1,
    coverColor: "#134e5e", coverAccent: "#71b280",
    publishYear: 2017, tags: JSON.stringify(["jade", "clan", "crime", "family", "martial arts", "political", "urban", "gang"]),
  },
  {
    title: "Jade War",
    author: "Fonda Lee",
    genre: "wuxia",
    subgenres: JSON.stringify(["wuxia", "urban", "crime"]),
    description: "The No Peak clan fights for global dominance. Jade War expands the world to international stage with even richer political intrigue and character depth.",
    martialArtsScore: 5, magicScore: 4, characterScore: 5,
    seriesName: "Green Bone Saga", seriesBook: 2,
    coverColor: "#1a3a2a", coverAccent: "#71b280",
    publishYear: 2019, tags: JSON.stringify(["jade", "clan", "crime", "political", "war", "gang", "family"]),
  },
  {
    title: "The Poppy War",
    author: "R.F. Kuang",
    genre: "wuxia",
    subgenres: JSON.stringify(["wuxia", "high_fantasy", "grimdark"]),
    description: "A war orphan discovers shamanic powers at military academy. Brutal and brilliant—inspired by Chinese history with visceral combat and dark gods.",
    martialArtsScore: 4, magicScore: 4, characterScore: 5,
    seriesName: "The Poppy War", seriesBook: 1,
    coverColor: "#4a0000", coverAccent: "#ff6b6b",
    publishYear: 2018, tags: JSON.stringify(["shamanism", "war", "military", "grimdark", "eastern-inspired", "academy", "gods"]),
  },
  {
    title: "The Dragon Republic",
    author: "R.F. Kuang",
    genre: "wuxia",
    subgenres: JSON.stringify(["wuxia", "high_fantasy", "grimdark"]),
    description: "Rin fights in a civil war while struggling with addiction to shamanic power. Even darker and more complex than book one.",
    martialArtsScore: 4, magicScore: 4, characterScore: 5,
    seriesName: "The Poppy War", seriesBook: 2,
    coverColor: "#1a0a00", coverAccent: "#e74c3c",
    publishYear: 2019, tags: JSON.stringify(["shamanism", "war", "military", "grimdark", "addiction", "politics", "gods"]),
  },
  {
    title: "The Sword of Kaigen",
    author: "M.L. Wang",
    genre: "wuxia",
    subgenres: JSON.stringify(["wuxia", "high_fantasy"]),
    description: "A warrior mother and her son discover devastating truths about their empire. Emotionally devastating standalone with breathtaking ice-and-water combat.",
    martialArtsScore: 5, magicScore: 4, characterScore: 5,
    seriesName: null, seriesBook: null,
    coverColor: "#0a1a2e", coverAccent: "#a8d8ea",
    publishYear: 2019, tags: JSON.stringify(["standalone", "family", "ice magic", "warrior", "propaganda", "tragedy", "emotional"]),
  },
  {
    title: "The Order of the Pure Moon Reflected in Water",
    author: "Zen Cho",
    genre: "wuxia",
    subgenres: JSON.stringify(["wuxia"]),
    description: "A bandit crew and a nun on the run in a wuxia world. Short, elegant, witty—perfect entry-point novella.",
    martialArtsScore: 3, magicScore: 3, characterScore: 4,
    seriesName: null, seriesBook: null,
    coverColor: "#1a0d2e", coverAccent: "#c9b1ff",
    publishYear: 2020, tags: JSON.stringify(["novella", "bandit", "nun", "humor", "heist", "wuxia"]),
  },
  {
    title: "Legends & Lattes",
    author: "Travis Baldree",
    genre: "high_fantasy",
    subgenres: JSON.stringify(["high_fantasy", "slice-of-life"]),
    description: "An orc barbarian retires from adventuring to open a coffee shop. Cozy, warm, wonderful—perfect palate cleanser between intense series.",
    martialArtsScore: 2, magicScore: 2, characterScore: 5,
    seriesName: null, seriesBook: null,
    coverColor: "#2d1a0a", coverAccent: "#d4a574",
    publishYear: 2022, tags: JSON.stringify(["cozy", "orc", "retired-warrior", "slice-of-life", "found-family", "standalone", "wholesome"]),
  },
  {
    title: "The Brightest Shadow",
    author: "Sarah Lin",
    genre: "wuxia",
    subgenres: JSON.stringify(["wuxia", "high_fantasy"]),
    description: "A subversive wuxia—the Chosen Hero is someone else, and the real story is told from the periphery. Thoughtful and original.",
    martialArtsScore: 4, magicScore: 3, characterScore: 5,
    seriesName: "The Brightest Shadow", seriesBook: 1,
    coverColor: "#0d1a0d", coverAccent: "#57a773",
    publishYear: 2019, tags: JSON.stringify(["chosen-one", "subversive", "peripheral-pov", "wuxia", "eastern-inspired"]),
  },
  // ═══════════════════════════════════════════════════
  // CULTIVATION / XIANXIA
  // ═══════════════════════════════════════════════════
  {
    title: "Unsouled",
    author: "Will Wight",
    genre: "cultivation",
    subgenres: JSON.stringify(["cultivation", "xianxia", "progression"]),
    description: "Born unable to advance in sacred arts, Lindon finds an impossible path. Cradle is the gold standard of Western cultivation—fast-paced with escalating power.",
    martialArtsScore: 5, magicScore: 5, characterScore: 4,
    seriesName: "Cradle", seriesBook: 1,
    coverColor: "#0d0d0d", coverAccent: "#4facde",
    publishYear: 2016, tags: JSON.stringify(["cultivation", "underdog", "sacred arts", "fast-paced", "power scaling", "bonds"]),
  },
  {
    title: "Soulsmith",
    author: "Will Wight",
    genre: "cultivation",
    subgenres: JSON.stringify(["cultivation", "xianxia", "progression"]),
    description: "Lindon enters the broader world and begins crafting sacred tools. The power system deepens significantly in book two.",
    martialArtsScore: 5, magicScore: 5, characterScore: 4,
    seriesName: "Cradle", seriesBook: 2,
    coverColor: "#0d1520", coverAccent: "#f39c12",
    publishYear: 2016, tags: JSON.stringify(["cultivation", "crafting", "sacred arts", "power scaling"]),
  },
  {
    title: "Blackflame",
    author: "Will Wight",
    genre: "cultivation",
    subgenres: JSON.stringify(["cultivation", "xianxia", "progression"]),
    description: "Lindon embraces a forbidden path of destruction. The series hits its stride—brutal advancement, fierce rivals, and unforgettable training.",
    martialArtsScore: 5, magicScore: 5, characterScore: 4,
    seriesName: "Cradle", seriesBook: 3,
    coverColor: "#1a0000", coverAccent: "#ff4500",
    publishYear: 2017, tags: JSON.stringify(["cultivation", "forbidden-path", "rivals", "training", "power scaling"]),
  },
  {
    title: "Beware of Chicken",
    author: "Casualfarmer",
    genre: "cultivation",
    subgenres: JSON.stringify(["cultivation", "xianxia", "slice-of-life"]),
    description: "A cultivator rejects the violent path and becomes a farmer. Heartwarming, funny, and surprisingly deep—beloved for found-family and character warmth.",
    martialArtsScore: 3, magicScore: 4, characterScore: 5,
    seriesName: "Beware of Chicken", seriesBook: 1,
    coverColor: "#2d5a27", coverAccent: "#f9ca24",
    publishYear: 2021, tags: JSON.stringify(["farming", "slice-of-life", "found-family", "humor", "cultivation", "gentle", "animals"]),
  },
  {
    title: "Forge of Destiny",
    author: "Yrsillar",
    genre: "cultivation",
    subgenres: JSON.stringify(["cultivation", "xianxia"]),
    description: "A young woman navigates a cultivation sect with intelligence and compassion. Methodical, character-rich—praised for its thoughtful female protagonist.",
    martialArtsScore: 3, magicScore: 5, characterScore: 5,
    seriesName: "Forge of Destiny", seriesBook: 1,
    coverColor: "#1a0533", coverAccent: "#9b59b6",
    publishYear: 2020, tags: JSON.stringify(["cultivation", "sect", "female-protagonist", "political", "methodical", "found-family"]),
  },
  {
    title: "A Thousand Li",
    author: "Tao Wong",
    genre: "cultivation",
    subgenres: JSON.stringify(["cultivation", "xianxia"]),
    description: "A poor peasant's steady climb through the cultivation world. Faithful to Chinese xianxia structure with a likeable, determined protagonist.",
    martialArtsScore: 4, magicScore: 4, characterScore: 4,
    seriesName: "A Thousand Li", seriesBook: 1,
    coverColor: "#1a0a00", coverAccent: "#e67e22",
    publishYear: 2019, tags: JSON.stringify(["cultivation", "poverty", "steady-progress", "xianxia", "eastern-inspired", "underdog"]),
  },
  {
    title: "Dreadgod",
    author: "Will Wight",
    genre: "cultivation",
    subgenres: JSON.stringify(["cultivation", "xianxia", "progression"]),
    description: "Book 11 of Cradle—the culmination of years of power scaling and character bonds. The payoff book for one of cultivation fiction's best series.",
    martialArtsScore: 5, magicScore: 5, characterScore: 5,
    seriesName: "Cradle", seriesBook: 11,
    coverColor: "#0d0d0d", coverAccent: "#ff4500",
    publishYear: 2022, tags: JSON.stringify(["cultivation", "sacred arts", "power scaling", "payoff", "bonds", "epic"]),
  },
  {
    title: "Coiling Dragon",
    author: "I Eat Tomatoes",
    genre: "cultivation",
    subgenres: JSON.stringify(["cultivation", "xianxia"]),
    description: "The grandfather of translated xianxia in the West. Linley's journey from ordinary to legend is a foundational classic of the genre.",
    martialArtsScore: 4, magicScore: 5, characterScore: 4,
    seriesName: "Coiling Dragon", seriesBook: 1,
    coverColor: "#0d1a0d", coverAccent: "#27ae60",
    publishYear: 2009, tags: JSON.stringify(["classic", "cultivation", "xianxia", "legend", "dragon", "eastern-inspired", "foundational"]),
  },
  {
    title: "I Shall Seal the Heavens",
    author: "Er Gen",
    genre: "cultivation",
    subgenres: JSON.stringify(["cultivation", "xianxia"]),
    description: "Meng Hao is cunning, greedy, and deeply human—one of xianxia's most beloved protagonists. Epic scope with emotional resonance.",
    martialArtsScore: 4, magicScore: 5, characterScore: 5,
    seriesName: "I Shall Seal the Heavens", seriesBook: 1,
    coverColor: "#1a0a1a", coverAccent: "#8e44ad",
    publishYear: 2014, tags: JSON.stringify(["cultivation", "xianxia", "cunning", "emotional", "epic-scope", "classic"]),
  },
  {
    title: "A Will Eternal",
    author: "Er Gen",
    genre: "cultivation",
    subgenres: JSON.stringify(["cultivation", "xianxia"]),
    description: "Bai Xiaochun is hilariously cowardly but loveable. A comedic xianxia with surprising emotional depth and a legendary character voice.",
    martialArtsScore: 3, magicScore: 4, characterScore: 5,
    seriesName: "A Will Eternal", seriesBook: 1,
    coverColor: "#0a1a1a", coverAccent: "#1abc9c",
    publishYear: 2016, tags: JSON.stringify(["cultivation", "xianxia", "humor", "cowardly-mc", "emotional", "comedy"]),
  },
  {
    title: "Lord of the Mysteries",
    author: "Cuttlefish That Loves Diving",
    genre: "cultivation",
    subgenres: JSON.stringify(["cultivation", "progression", "steampunk"]),
    description: "A man gains a mysterious Tarot card in a Victorian steampunk world. Mystery, horror, and cultivation fused into something totally unique.",
    martialArtsScore: 3, magicScore: 5, characterScore: 5,
    seriesName: "Lord of the Mysteries", seriesBook: 1,
    coverColor: "#0d0d1a", coverAccent: "#f1c40f",
    publishYear: 2018, tags: JSON.stringify(["steampunk", "mystery", "horror", "tarot", "cultivation", "unique", "investigation"]),
  },
  {
    title: "Ave Xia Rem Y",
    author: "Mat Haz",
    genre: "cultivation",
    subgenres: JSON.stringify(["cultivation", "xianxia"]),
    description: "A deeply emotional cultivation story with trauma, recovery, and remarkable character depth. One of the community's most beloved hidden gems.",
    martialArtsScore: 4, magicScore: 4, characterScore: 5,
    seriesName: "Ave Xia Rem Y", seriesBook: 1,
    coverColor: "#1a0a0a", coverAccent: "#e74c3c",
    publishYear: 2020, tags: JSON.stringify(["cultivation", "trauma", "recovery", "emotional", "hidden-gem", "character-driven"]),
  },
  {
    title: "Battle Through the Heavens",
    author: "Heavenly Silkworm Potato",
    genre: "cultivation",
    subgenres: JSON.stringify(["cultivation", "xianxia"]),
    description: "Xiao Yan falls from prodigy to failure, then claws his way back. Classic underdog cultivation with fast-paced battles.",
    martialArtsScore: 5, magicScore: 4, characterScore: 3,
    seriesName: "Battle Through the Heavens", seriesBook: 1,
    coverColor: "#1a0a00", coverAccent: "#f39c12",
    publishYear: 2009, tags: JSON.stringify(["cultivation", "xianxia", "underdog", "revenge", "battles", "classic"]),
  },
  {
    title: "A Record of Mortal's Journey to Immortality",
    author: "Wang Yu",
    genre: "cultivation",
    subgenres: JSON.stringify(["cultivation", "xianxia"]),
    description: "Han Li—a nobody—slowly and methodically becomes a legend. One of the most realistic and satisfying cultivation journeys ever written.",
    martialArtsScore: 3, magicScore: 5, characterScore: 4,
    seriesName: "Mortal's Journey", seriesBook: 1,
    coverColor: "#0a1a1a", coverAccent: "#3498db",
    publishYear: 2013, tags: JSON.stringify(["cultivation", "xianxia", "methodical", "realistic", "steady-progress", "classic", "completed"]),
  },
  // ═══════════════════════════════════════════════════
  // LITRPG
  // ═══════════════════════════════════════════════════
  {
    title: "He Who Fights With Monsters",
    author: "Jason Cheyne",
    genre: "litrpg",
    subgenres: JSON.stringify(["litrpg", "progression", "isekai"]),
    description: "An Australian is dropped into a monster-filled world with RPG mechanics. Witty, action-packed with excellent character development and social dynamics.",
    martialArtsScore: 3, magicScore: 5, characterScore: 5,
    seriesName: "He Who Fights With Monsters", seriesBook: 1,
    coverColor: "#0a0a23", coverAccent: "#f39c12",
    publishYear: 2020, tags: JSON.stringify(["isekai", "rpg-mechanics", "magic", "team-dynamics", "humor", "progression", "looting"]),
  },
  {
    title: "Dungeon Crawler Carl",
    author: "Matt Dinniman",
    genre: "litrpg",
    subgenres: JSON.stringify(["litrpg", "dungeon", "dark-comedy"]),
    description: "The apocalypse turns Earth into a live-streamed dungeon. Wildly creative, hilarious, and brutal—Carl and Princess Donut are one of fantasy's best duos.",
    martialArtsScore: 3, magicScore: 4, characterScore: 5,
    seriesName: "Dungeon Crawler Carl", seriesBook: 1,
    coverColor: "#1a0000", coverAccent: "#e74c3c",
    publishYear: 2021, tags: JSON.stringify(["dungeon", "dark-comedy", "cat", "apocalypse", "creative", "duo", "satirical"]),
  },
  {
    title: "Carl's Doomsday Scenario",
    author: "Matt Dinniman",
    genre: "litrpg",
    subgenres: JSON.stringify(["litrpg", "dungeon", "dark-comedy"]),
    description: "Book 2 of DCC—deeper dungeon floors, more chaos, more Princess Donut. The creative brilliance escalates.",
    martialArtsScore: 3, magicScore: 4, characterScore: 5,
    seriesName: "Dungeon Crawler Carl", seriesBook: 2,
    coverColor: "#200a0a", coverAccent: "#e74c3c",
    publishYear: 2021, tags: JSON.stringify(["dungeon", "dark-comedy", "cat", "apocalypse", "satirical", "creative"]),
  },
  {
    title: "Defiance of the Fall",
    author: "TheFirstDefier",
    genre: "litrpg",
    subgenres: JSON.stringify(["litrpg", "cultivation", "progression"]),
    description: "System apocalypse meets cultivation grind. Massive scope, intense martial arts progression, and a protagonist who earns every power spike.",
    martialArtsScore: 5, magicScore: 5, characterScore: 3,
    seriesName: "Defiance of the Fall", seriesBook: 1,
    coverColor: "#0d1117", coverAccent: "#00d2ff",
    publishYear: 2020, tags: JSON.stringify(["system", "apocalypse", "cultivation", "power-scaling", "grind", "martial arts"]),
  },
  {
    title: "Shadow Slave",
    author: "Guiltythree",
    genre: "litrpg",
    subgenres: JSON.stringify(["litrpg", "progression", "dark"]),
    description: "A young man afflicted by a nightmare curse must fight in a shadow realm. Exceptional worldbuilding, horror atmosphere, and one of progression's most intriguing protagonists.",
    martialArtsScore: 4, magicScore: 5, characterScore: 5,
    seriesName: "Shadow Slave", seriesBook: 1,
    coverColor: "#0a0a0a", coverAccent: "#6c5ce7",
    publishYear: 2022, tags: JSON.stringify(["nightmare", "horror", "shadow", "dark", "mystery", "unique", "progression", "curse"]),
  },
  {
    title: "The Wandering Inn",
    author: "Pirateaba",
    genre: "litrpg",
    subgenres: JSON.stringify(["litrpg", "slice-of-life", "epic"]),
    description: "A girl from Earth ends up running an inn in a fantasy world. Monumental scope—exceptional character depth across hundreds of POVs over millions of words.",
    martialArtsScore: 2, magicScore: 4, characterScore: 5,
    seriesName: "The Wandering Inn", seriesBook: 1,
    coverColor: "#1c1c2e", coverAccent: "#a29bfe",
    publishYear: 2016, tags: JSON.stringify(["isekai", "inn", "epic-scope", "slice-of-life", "huge-cast", "management"]),
  },
  {
    title: "Path of Ascension",
    author: "C. Mantis",
    genre: "litrpg",
    subgenres: JSON.stringify(["litrpg", "cultivation", "progression"]),
    description: "A seemingly talentless boy finds a hidden path and builds an unconventional build. Excellent characters, comfortable pacing, and satisfying power synergies.",
    martialArtsScore: 4, magicScore: 5, characterScore: 5,
    seriesName: "Path of Ascension", seriesBook: 1,
    coverColor: "#0a1a2e", coverAccent: "#2980b9",
    publishYear: 2021, tags: JSON.stringify(["underdog", "hidden-talent", "dungeon", "team", "build-crafting", "comfortable", "progression"]),
  },
  {
    title: "Super Supportive",
    author: "Sleyca",
    genre: "litrpg",
    subgenres: JSON.stringify(["litrpg", "progression", "superhero"]),
    description: "A boy with a seemingly useless support ability in a superhero world finds creative ways to make it devastating. Excellent character writing and power design.",
    martialArtsScore: 3, magicScore: 5, characterScore: 5,
    seriesName: "Super Supportive", seriesBook: 1,
    coverColor: "#0d1a2e", coverAccent: "#3498db",
    publishYear: 2023, tags: JSON.stringify(["support-class", "superhero", "underdog", "creative-power", "team", "character-driven", "school"]),
  },
  {
    title: "12 Miles Below",
    author: "Mark Arrows",
    genre: "litrpg",
    subgenres: JSON.stringify(["litrpg", "dungeon", "progression"]),
    description: "An underground world of ancient machines and deadly dungeons. Standout for its unique setting and intensely satisfying progression.",
    martialArtsScore: 4, magicScore: 4, characterScore: 4,
    seriesName: "12 Miles Below", seriesBook: 1,
    coverColor: "#0a0a1a", coverAccent: "#e67e22",
    publishYear: 2022, tags: JSON.stringify(["underground", "dungeon", "machines", "unique-setting", "progression", "exploration"]),
  },
  {
    title: "Mage Errant",
    author: "John Bierce",
    genre: "litrpg",
    subgenres: JSON.stringify(["litrpg", "high_fantasy", "academy"]),
    description: "A talentless student finds a brilliant and bizarre mage mentor. Excellent magic system, loveable characters, and superb worldbuilding.",
    martialArtsScore: 2, magicScore: 5, characterScore: 5,
    seriesName: "Mage Errant", seriesBook: 1,
    coverColor: "#0d0d2e", coverAccent: "#9b59b6",
    publishYear: 2019, tags: JSON.stringify(["academy", "magic-system", "mentor", "unique-magic", "worldbuilding", "underdog"]),
  },
  {
    title: "Randidly Ghosthound",
    author: "puddles4263",
    genre: "litrpg",
    subgenres: JSON.stringify(["litrpg", "cultivation", "progression"]),
    description: "A man trapped in a tutorial gains incredible spear skills and cultivation. One of the original western cultivation LitRPG hybrids.",
    martialArtsScore: 5, magicScore: 4, characterScore: 3,
    seriesName: "Randidly Ghosthound", seriesBook: 1,
    coverColor: "#0a0a0a", coverAccent: "#27ae60",
    publishYear: 2016, tags: JSON.stringify(["spear", "tutorial", "cultivation", "system", "grind", "martial arts", "early-litrpg"]),
  },
  {
    title: "Beneath the Dragoneye Moons",
    author: "Selkie Myth",
    genre: "litrpg",
    subgenres: JSON.stringify(["litrpg", "progression", "isekai"]),
    description: "A woman reincarnates into a brutal RPG world and uses her knowledge to survive and thrive. Excellent long-form character development with a healer protagonist.",
    martialArtsScore: 2, magicScore: 5, characterScore: 5,
    seriesName: "Beneath the Dragoneye Moons", seriesBook: 1,
    coverColor: "#0a1a2e", coverAccent: "#48cae4",
    publishYear: 2021, tags: JSON.stringify(["isekai", "healer", "female-protagonist", "reincarnation", "progression", "medicine"]),
  },
  {
    title: "Azarinth Healer",
    author: "Rhaegar",
    genre: "litrpg",
    subgenres: JSON.stringify(["litrpg", "progression", "isekai"]),
    description: "A woman transmits to a fantasy world and discovers she's a healer who loves to fight. Combat-healer hybrid with satisfying aggression and grind.",
    martialArtsScore: 4, magicScore: 4, characterScore: 4,
    seriesName: "Azarinth Healer", seriesBook: 1,
    coverColor: "#1a0a1a", coverAccent: "#e74c3c",
    publishYear: 2019, tags: JSON.stringify(["healer", "isekai", "combat-healer", "female-protagonist", "grind", "aggression"]),
  },
  {
    title: "Heretical Fishing",
    author: "Haylock Jobson",
    genre: "litrpg",
    subgenres: JSON.stringify(["litrpg", "cultivation", "slice-of-life"]),
    description: "A man isekaied to a cultivation world wants to fish instead. Hilarious, wholesome, and full of heart—companion piece to Beware of Chicken lovers.",
    martialArtsScore: 2, magicScore: 3, characterScore: 5,
    seriesName: "Heretical Fishing", seriesBook: 1,
    coverColor: "#0a1a2e", coverAccent: "#1abc9c",
    publishYear: 2022, tags: JSON.stringify(["fishing", "slice-of-life", "humor", "isekai", "wholesome", "found-family", "laid-back"]),
  },
  {
    title: "Salvos",
    author: "MelasDelta",
    genre: "litrpg",
    subgenres: JSON.stringify(["litrpg", "progression"]),
    description: "A demon girl explores the mortal world seeking strength and understanding. Fresh perspective-flip on the genre with great character growth.",
    martialArtsScore: 4, magicScore: 4, characterScore: 5,
    seriesName: "Salvos", seriesBook: 1,
    coverColor: "#1a0a00", coverAccent: "#e74c3c",
    publishYear: 2020, tags: JSON.stringify(["demon-protagonist", "unique-pov", "growth", "exploration", "humor", "progression"]),
  },
  // ═══════════════════════════════════════════════════
  // URBAN FANTASY
  // ═══════════════════════════════════════════════════
  {
    title: "Street Cultivation",
    author: "Sarah Lin",
    genre: "urban",
    subgenres: JSON.stringify(["urban", "cultivation", "progression"]),
    description: "Cultivation in a modern city where qi is commodified. Gritty socioeconomic lens on the power system—underdog martial arts journey in urban USA.",
    martialArtsScore: 5, magicScore: 4, characterScore: 4,
    seriesName: "Street Cultivation", seriesBook: 1,
    coverColor: "#12192c", coverAccent: "#f0a500",
    publishYear: 2019, tags: JSON.stringify(["urban", "cultivation", "class-struggle", "modern", "underdog", "martial arts", "qi"]),
  },
  {
    title: "Storm Front",
    author: "Jim Butcher",
    genre: "urban",
    subgenres: JSON.stringify(["urban", "noir", "detective"]),
    description: "Chicago's only wizard-for-hire solves supernatural crimes. Classic urban fantasy—brilliant magic system, unforgettable protagonist, constant stakes.",
    martialArtsScore: 2, magicScore: 5, characterScore: 5,
    seriesName: "The Dresden Files", seriesBook: 1,
    coverColor: "#0a0a0a", coverAccent: "#4a90d9",
    publishYear: 2000, tags: JSON.stringify(["wizard", "detective", "noir", "chicago", "monsters", "sarcasm", "magic"]),
  },
  {
    title: "Cold Days",
    author: "Jim Butcher",
    genre: "urban",
    subgenres: JSON.stringify(["urban", "action"]),
    description: "Dresden becomes the Winter Knight and faces impossible odds. One of the series' best books—power, consequence, and Harry at his most desperate.",
    martialArtsScore: 3, magicScore: 5, characterScore: 5,
    seriesName: "The Dresden Files", seriesBook: 14,
    coverColor: "#0a0a1a", coverAccent: "#3498db",
    publishYear: 2012, tags: JSON.stringify(["wizard", "winter-court", "faerie", "action", "consequences", "payoff"]),
  },
  {
    title: "Battle Ground",
    author: "Jim Butcher",
    genre: "urban",
    subgenres: JSON.stringify(["urban", "action", "war"]),
    description: "An all-out supernatural war in Chicago. Best action and combat magic in the series, with years of character development paying off.",
    martialArtsScore: 3, magicScore: 5, characterScore: 5,
    seriesName: "The Dresden Files", seriesBook: 17,
    coverColor: "#0a0a0a", coverAccent: "#c0392b",
    publishYear: 2020, tags: JSON.stringify(["wizard", "war", "chicago", "payoff", "action", "epic"]),
  },
  {
    title: "The Combat Codes",
    author: "Alexander Darwin",
    genre: "urban",
    subgenres: JSON.stringify(["urban", "progression", "martial-arts-focus"]),
    description: "War is decided by champions in single combat. The most technically accurate and thrilling martial arts system in fantasy—a love letter to combat sports.",
    martialArtsScore: 5, magicScore: 2, characterScore: 4,
    seriesName: "The Combat Codes", seriesBook: 1,
    coverColor: "#1a1a1a", coverAccent: "#e74c3c",
    publishYear: 2016, tags: JSON.stringify(["combat sports", "MMA", "champion", "martial arts", "grappling", "technical", "BJJ"]),
  },
  {
    title: "Iron Widow",
    author: "Xiran Jay Zhao",
    genre: "urban",
    subgenres: JSON.stringify(["urban", "wuxia", "mecha"]),
    description: "A girl becomes a pilot to avenge her sister in a mecha-wuxia world. Furious, feminist, and deeply Chinese-influenced—martial arts meets giant robots.",
    martialArtsScore: 4, magicScore: 3, characterScore: 5,
    seriesName: "Iron Widow", seriesBook: 1,
    coverColor: "#2a0a0a", coverAccent: "#ff6b6b",
    publishYear: 2021, tags: JSON.stringify(["mecha", "female-protagonist", "revenge", "wuxia", "Chinese-mythology", "feminist", "action"]),
  },
  {
    title: "Ink Blood Sister Scribe",
    author: "Emma Törzs",
    genre: "urban",
    subgenres: JSON.stringify(["urban", "literary"]),
    description: "Two sisters, one kept secret, both bound to a house of magical books. Atmospheric, literary urban fantasy with exceptional character work.",
    martialArtsScore: 1, magicScore: 4, characterScore: 5,
    seriesName: null, seriesBook: null,
    coverColor: "#0a0a1a", coverAccent: "#6c5ce7",
    publishYear: 2023, tags: JSON.stringify(["literary", "sisters", "magic-books", "atmospheric", "standalone", "mystery"]),
  },
  {
    title: "Magic Bites",
    author: "Ilona Andrews",
    genre: "urban",
    subgenres: JSON.stringify(["urban", "action"]),
    description: "Kate Daniels—a mercenary with a magical sword—navigates a post-apocalyptic Atlanta where magic and technology trade waves. Addictive series with fantastic combat.",
    martialArtsScore: 4, magicScore: 4, characterScore: 5,
    seriesName: "Kate Daniels", seriesBook: 1,
    coverColor: "#1a0a00", coverAccent: "#c0392b",
    publishYear: 2007, tags: JSON.stringify(["sword", "mercenary", "female-protagonist", "post-apocalyptic", "magic", "action", "romance"]),
  },
  {
    title: "White Tiger",
    author: "Kylie Chan",
    genre: "urban",
    subgenres: JSON.stringify(["urban", "cultivation", "mythology"]),
    description: "A nanny discovers her employer is a Chinese god and begins martial arts training. Blends Chinese mythology, cultivation, and urban fantasy.",
    martialArtsScore: 4, magicScore: 4, characterScore: 4,
    seriesName: "Dark Heavens", seriesBook: 1,
    coverColor: "#1a1a2e", coverAccent: "#f0a500",
    publishYear: 2006, tags: JSON.stringify(["chinese-mythology", "cultivation", "urban", "gods", "martial arts", "female-protagonist"]),
  },
  // ═══════════════════════════════════════════════════
  // HIGH FANTASY
  // ═══════════════════════════════════════════════════
  {
    title: "The Way of Kings",
    author: "Brandon Sanderson",
    genre: "high_fantasy",
    subgenres: JSON.stringify(["high_fantasy", "epic", "progression"]),
    description: "A slave becomes a soldier becomes a legend. Stormlight has the best magic-as-martial-arts system and some of fantasy's most moving character arcs.",
    martialArtsScore: 5, magicScore: 5, characterScore: 5,
    seriesName: "Stormlight Archive", seriesBook: 1,
    coverColor: "#0a1628", coverAccent: "#00b4d8",
    publishYear: 2010, tags: JSON.stringify(["epic", "magic-system", "hard-magic", "trauma", "found-family", "worldbuilding", "shards"]),
  },
  {
    title: "Words of Radiance",
    author: "Brandon Sanderson",
    genre: "high_fantasy",
    subgenres: JSON.stringify(["high_fantasy", "epic", "progression"]),
    description: "Shallan and Kaladin converge on the Shattered Plains. Book 2 expands the magic, escalates the stakes, and deepens the character work.",
    martialArtsScore: 5, magicScore: 5, characterScore: 5,
    seriesName: "Stormlight Archive", seriesBook: 2,
    coverColor: "#0a0a28", coverAccent: "#7bed9f",
    publishYear: 2014, tags: JSON.stringify(["epic", "hard-magic", "worldbuilding", "shards", "stormlight", "payoff"]),
  },
  {
    title: "Mistborn: The Final Empire",
    author: "Brandon Sanderson",
    genre: "high_fantasy",
    subgenres: JSON.stringify(["high_fantasy", "progression"]),
    description: "Magic is swallowing metals for acrobatic combat powers. Heist story meets revolution—Allomancy is one of fantasy's most original martial magic systems.",
    martialArtsScore: 4, magicScore: 5, characterScore: 5,
    seriesName: "Mistborn", seriesBook: 1,
    coverColor: "#1a0a00", coverAccent: "#c0a060",
    publishYear: 2006, tags: JSON.stringify(["heist", "revolution", "allomancy", "hard-magic", "acrobatic-combat", "underdog", "metals"]),
  },
  {
    title: "The Well of Ascension",
    author: "Brandon Sanderson",
    genre: "high_fantasy",
    subgenres: JSON.stringify(["high_fantasy", "progression"]),
    description: "The heist succeeded—now what? Political turmoil and siege warfare with the magic system deepened. Vin grows into one of fantasy's great protagonists.",
    martialArtsScore: 4, magicScore: 5, characterScore: 5,
    seriesName: "Mistborn", seriesBook: 2,
    coverColor: "#1a0000", coverAccent: "#95a5a6",
    publishYear: 2007, tags: JSON.stringify(["politics", "siege", "allomancy", "hard-magic", "female-protagonist", "payoff"]),
  },
  {
    title: "The Name of the Wind",
    author: "Patrick Rothfuss",
    genre: "high_fantasy",
    subgenres: JSON.stringify(["high_fantasy", "literary"]),
    description: "A legend recounts his own story. The most beautifully written fantasy in recent memory—Kvothe's training and sympathy magic are stunning.",
    martialArtsScore: 3, magicScore: 4, characterScore: 5,
    seriesName: "Kingkiller Chronicle", seriesBook: 1,
    coverColor: "#1a0d00", coverAccent: "#d4a017",
    publishYear: 2007, tags: JSON.stringify(["literary", "bard", "magic-school", "prodigy", "storytelling", "sympathy"]),
  },
  {
    title: "The Lies of Locke Lamora",
    author: "Scott Lynch",
    genre: "high_fantasy",
    subgenres: JSON.stringify(["high_fantasy", "crime", "heist"]),
    description: "A gang of con artists in a fantasy Venice. Exceptional character chemistry, dark humor, and some of fantasy's cleverest plotting.",
    martialArtsScore: 2, magicScore: 2, characterScore: 5,
    seriesName: "Gentleman Bastard", seriesBook: 1,
    coverColor: "#1a1000", coverAccent: "#b8860b",
    publishYear: 2006, tags: JSON.stringify(["heist", "con-artist", "city", "humor", "brotherhood", "clever", "crime"]),
  },
  {
    title: "The Blade Itself",
    author: "Joe Abercrombie",
    genre: "high_fantasy",
    subgenres: JSON.stringify(["high_fantasy", "grimdark"]),
    description: "A crippled inquisitor, a barbarian, and a failed mage—Abercrombie's subversive take on fantasy with brutal, realistic combat.",
    martialArtsScore: 4, magicScore: 3, characterScore: 5,
    seriesName: "First Law", seriesBook: 1,
    coverColor: "#1a1a2e", coverAccent: "#888888",
    publishYear: 2006, tags: JSON.stringify(["grimdark", "subversive", "swordsmanship", "inquisitor", "political", "realistic-combat"]),
  },
  {
    title: "Best Served Cold",
    author: "Joe Abercrombie",
    genre: "high_fantasy",
    subgenres: JSON.stringify(["high_fantasy", "grimdark"]),
    description: "A mercenary general betrayed and left for dead hunts her betrayers. Brutal revenge fantasy with exceptional character turns.",
    martialArtsScore: 4, magicScore: 2, characterScore: 5,
    seriesName: "First Law World", seriesBook: null,
    coverColor: "#0a0a0a", coverAccent: "#c0392b",
    publishYear: 2009, tags: JSON.stringify(["revenge", "grimdark", "standalone", "female-protagonist", "betrayal", "mercenary"]),
  },
  {
    title: "Half a King",
    author: "Joe Abercrombie",
    genre: "high_fantasy",
    subgenres: JSON.stringify(["high_fantasy"]),
    description: "A prince born with a crippled hand must survive betrayal and slavery. Faster and more accessible than First Law—great entry to Abercrombie.",
    martialArtsScore: 3, magicScore: 2, characterScore: 5,
    seriesName: "Shattered Sea", seriesBook: 1,
    coverColor: "#0a1a2e", coverAccent: "#2c3e50",
    publishYear: 2014, tags: JSON.stringify(["betrayal", "underdog", "disabled-protagonist", "YA-friendly", "Viking-inspired"]),
  },
  {
    title: "The Priory of the Orange Tree",
    author: "Samantha Shannon",
    genre: "high_fantasy",
    subgenres: JSON.stringify(["high_fantasy", "epic"]),
    description: "A massive standalone epic with dragon riders, queens, and a world-spanning threat. Excellent character diversity and dragon lore.",
    martialArtsScore: 3, magicScore: 4, characterScore: 5,
    seriesName: null, seriesBook: null,
    coverColor: "#2a0a00", coverAccent: "#e74c3c",
    publishYear: 2019, tags: JSON.stringify(["dragons", "female-protagonist", "standalone", "epic", "diverse-cast", "political"]),
  },
  {
    title: "Rage of Dragons",
    author: "Evan Winter",
    genre: "high_fantasy",
    subgenres: JSON.stringify(["high_fantasy", "progression"]),
    description: "An African-inspired war epic where a lowborn man masters an ancient martial art to save his people. Intense combat with real emotional weight.",
    martialArtsScore: 5, magicScore: 3, characterScore: 5,
    seriesName: "The Burning", seriesBook: 1,
    coverColor: "#1a0000", coverAccent: "#e67e22",
    publishYear: 2019, tags: JSON.stringify(["African-inspired", "martial arts", "war", "underdog", "dragons", "revenge", "progression"]),
  },
  {
    title: "The Ruin of Kings",
    author: "Jenn Lyons",
    genre: "high_fantasy",
    subgenres: JSON.stringify(["high_fantasy", "epic"]),
    description: "A thief discovers he's the center of an ancient prophecy. Complex, layered storytelling with exceptional lore and power systems.",
    martialArtsScore: 3, magicScore: 5, characterScore: 4,
    seriesName: "A Chorus of Dragons", seriesBook: 1,
    coverColor: "#1a0a1a", coverAccent: "#8e44ad",
    publishYear: 2019, tags: JSON.stringify(["prophecy", "complex", "thief", "lore", "epic", "dragons", "layered"]),
  },
  {
    title: "The Ember Blade",
    author: "Chris Wooding",
    genre: "high_fantasy",
    subgenres: JSON.stringify(["high_fantasy"]),
    description: "A resistance fighter sets out to steal a legendary sword in an occupied kingdom. Swashbuckling adventure with standout character chemistry.",
    martialArtsScore: 4, magicScore: 3, characterScore: 5,
    seriesName: "Darkwater Legacy", seriesBook: 1,
    coverColor: "#1a0800", coverAccent: "#e67e22",
    publishYear: 2019, tags: JSON.stringify(["heist", "sword", "resistance", "adventure", "character-chemistry", "buddy-story"]),
  },
  {
    title: "The Stormlight Archive: Rhythm of War",
    author: "Brandon Sanderson",
    genre: "high_fantasy",
    subgenres: JSON.stringify(["high_fantasy", "epic", "progression"]),
    description: "Book 4 of Stormlight—deep dives into fabrials, mental health, and some of the most emotionally resonant chapters Sanderson has written.",
    martialArtsScore: 5, magicScore: 5, characterScore: 5,
    seriesName: "Stormlight Archive", seriesBook: 4,
    coverColor: "#1a0a1a", coverAccent: "#8e44ad",
    publishYear: 2020, tags: JSON.stringify(["hard-magic", "mental-health", "worldbuilding", "epic", "payoff", "stormlight"]),
  },
  // ═══════════════════════════════════════════════════
  // PROGRESSION FANTASY
  // ═══════════════════════════════════════════════════
  {
    title: "Sufficiently Advanced Magic",
    author: "Andrew Rowe",
    genre: "progression",
    subgenres: JSON.stringify(["progression", "litrpg", "high_fantasy"]),
    description: "A magic academy with attunements—powers granted by towers. Hard magic, excellent progression, and a protagonist with fascinating motivations.",
    martialArtsScore: 3, magicScore: 5, characterScore: 4,
    seriesName: "Arcane Ascension", seriesBook: 1,
    coverColor: "#0d0d2b", coverAccent: "#7b68ee",
    publishYear: 2017, tags: JSON.stringify(["academy", "hard-magic", "attunement", "tower", "puzzle", "mystery"]),
  },
  {
    title: "Mother of Learning",
    author: "Domagoj Kurmaic",
    genre: "progression",
    subgenres: JSON.stringify(["progression", "high_fantasy", "time-loop"]),
    description: "A magic student is trapped in a time loop and uses it to become the most powerful mage alive. Exceptional planning, character depth, and payoff.",
    martialArtsScore: 2, magicScore: 5, characterScore: 5,
    seriesName: "Mother of Learning", seriesBook: 1,
    coverColor: "#0d0d1a", coverAccent: "#9b59b6",
    publishYear: 2011, tags: JSON.stringify(["time-loop", "magic-school", "planning", "payoff", "web-serial", "completed"]),
  },
  {
    title: "Beneath the Dragoneye Moons",
    author: "Selkie Myth",
    genre: "progression",
    subgenres: JSON.stringify(["progression", "litrpg", "isekai"]),
    description: "A woman reincarnates into a brutal RPG world and uses her knowledge to survive and thrive. Excellent long-form character development.",
    martialArtsScore: 2, magicScore: 5, characterScore: 5,
    seriesName: "Beneath the Dragoneye Moons", seriesBook: 1,
    coverColor: "#0a1a2e", coverAccent: "#48cae4",
    publishYear: 2021, tags: JSON.stringify(["isekai", "healer", "female-protagonist", "reincarnation", "progression", "medicine"]),
  },
  {
    title: "Weirkey Chronicles",
    author: "Sarah Lin",
    genre: "progression",
    subgenres: JSON.stringify(["progression", "cultivation"]),
    description: "A unique cultivation world built on soulhouses and mental landscapes. Slower-burn but exceptional worldbuilding and character consistency.",
    martialArtsScore: 3, magicScore: 5, characterScore: 4,
    seriesName: "Weirkey Chronicles", seriesBook: 1,
    coverColor: "#0a0a1a", coverAccent: "#6c5ce7",
    publishYear: 2020, tags: JSON.stringify(["cultivation", "unique-magic", "soulhouse", "methodical", "worldbuilding"]),
  },
  {
    title: "Titan Hoppers",
    author: "Rob Hayes",
    genre: "progression",
    subgenres: JSON.stringify(["progression", "litrpg"]),
    description: "Humans fight interdimensional giants by jumping through portals. Fast progression, intense martial arts, and great ensemble cast.",
    martialArtsScore: 5, magicScore: 3, characterScore: 4,
    seriesName: "Titan Hoppers", seriesBook: 1,
    coverColor: "#0d1117", coverAccent: "#e74c3c",
    publishYear: 2022, tags: JSON.stringify(["portal", "giants", "martial arts", "team", "fast-paced", "ensemble"]),
  },
  {
    title: "The Iron Teeth",
    author: "Colin J.D. Donoghue",
    genre: "progression",
    subgenres: JSON.stringify(["progression", "grimdark"]),
    description: "A goblin struggles to survive in a brutal dark fantasy world. Unique underdog perspective—gritty progression from the very bottom of the food chain.",
    martialArtsScore: 3, magicScore: 3, characterScore: 5,
    seriesName: "The Iron Teeth", seriesBook: 1,
    coverColor: "#0a0a0a", coverAccent: "#27ae60",
    publishYear: 2015, tags: JSON.stringify(["goblin-protagonist", "grimdark", "underdog", "web-serial", "survival", "unique-pov"]),
  },
  {
    title: "Worth the Candle",
    author: "Alexander Wales",
    genre: "progression",
    subgenres: JSON.stringify(["progression", "litrpg", "literary"]),
    description: "A teenager transported into a world built from his own D&D campaigns must confront his own flaws. Psychological depth rarely seen in LitRPG.",
    martialArtsScore: 3, magicScore: 4, characterScore: 5,
    seriesName: "Worth the Candle", seriesBook: 1,
    coverColor: "#1a0d00", coverAccent: "#d4a017",
    publishYear: 2017, tags: JSON.stringify(["psychological", "D&D", "isekai", "literary", "trauma", "deconstructive", "completed"]),
  },
  {
    title: "Primal Hunter",
    author: "Zogarth",
    genre: "progression",
    subgenres: JSON.stringify(["progression", "litrpg"]),
    description: "A man survives the System's Tutorial and rises to become one of Earth's strongest. Satisfying power fantasy with good character moments.",
    martialArtsScore: 4, magicScore: 4, characterScore: 3,
    seriesName: "Primal Hunter", seriesBook: 1,
    coverColor: "#0a1a0a", coverAccent: "#27ae60",
    publishYear: 2021, tags: JSON.stringify(["system", "tutorial", "survival", "power-fantasy", "earth", "progression"]),
  },
  {
    title: "The Runesmith",
    author: "Kuropon",
    genre: "progression",
    subgenres: JSON.stringify(["progression", "litrpg"]),
    description: "A modern man reincarnates into a fantasy world and pursues the underrated runesmith class. Crafting and combat combined with steady progression.",
    martialArtsScore: 3, magicScore: 4, characterScore: 4,
    seriesName: "Runesmith", seriesBook: 1,
    coverColor: "#0d0d1a", coverAccent: "#e67e22",
    publishYear: 2021, tags: JSON.stringify(["crafting", "runesmith", "reincarnation", "underrated-class", "steady-progress"]),
  },
  {
    title: "Virtuous Sons",
    author: "Ya Boy Gorgut",
    genre: "progression",
    subgenres: JSON.stringify(["progression", "cultivation", "historical"]),
    description: "A Roman and a Chinese cultivator meet in the ancient world. Unique historical cultivation mashup—phenomenal prose and character voice.",
    martialArtsScore: 4, magicScore: 4, characterScore: 5,
    seriesName: "Virtuous Sons", seriesBook: 1,
    coverColor: "#1a0a00", coverAccent: "#c0a060",
    publishYear: 2021, tags: JSON.stringify(["Roman", "historical", "cultivation", "duo", "unique-premise", "prose", "character-voice"]),
  },
  {
    title: "Paranoid Mage",
    author: "Lume",
    genre: "progression",
    subgenres: JSON.stringify(["progression", "urban", "litrpg"]),
    description: "A man discovers he's a mage in a world where mages are secretly hunted. Fast-paced, tense, and surprisingly funny.",
    martialArtsScore: 2, magicScore: 5, characterScore: 4,
    seriesName: "Paranoid Mage", seriesBook: 1,
    coverColor: "#0d0d1a", coverAccent: "#3498db",
    publishYear: 2022, tags: JSON.stringify(["hidden-magic", "urban", "hunted", "tense", "humor", "conspiracy"]),
  },
  {
    title: "Manifest",
    author: "Samuel Hinton",
    genre: "progression",
    subgenres: JSON.stringify(["progression", "cultivation"]),
    description: "A martial artist discovers a unique manifestation power in a cultivation world. Strong combat writing with a lead who actually uses his martial arts background.",
    martialArtsScore: 5, magicScore: 4, characterScore: 4,
    seriesName: "Manifest", seriesBook: 1,
    coverColor: "#1a0a1a", coverAccent: "#9b59b6",
    publishYear: 2021, tags: JSON.stringify(["martial arts", "cultivation", "manifestation", "power-system", "combat"]),
  },
];

// ── Recommendation engine (shared) ────────────────────────────────────────────
function buildRecommendations(allBooks: any[], ratings: any[], excludeBookIds?: Set<number>) {
  if (ratings.length === 0) return [];

  const ratedBookIds = new Set(ratings.map((r: any) => r.bookId));
  const tagScores: Record<string, number> = {};
  const genreScores: Record<string, number> = {};
  const attrPrefs = { martial: 0, magic: 0, character: 0 };

  for (const rating of ratings) {
    const book = allBooks.find((b: any) => b.id === rating.bookId);
    if (!book) continue;
    const weight = (rating.rating - 5) / 5;
    genreScores[book.genre] = (genreScores[book.genre] || 0) + weight;
    const subgenres: string[] = JSON.parse(book.subgenres);
    for (const sg of subgenres) genreScores[sg] = (genreScores[sg] || 0) + weight * 0.5;
    const tags: string[] = JSON.parse(book.tags);
    for (const tag of tags) tagScores[tag] = (tagScores[tag] || 0) + weight;
    const nr = rating.rating / 10;
    attrPrefs.martial += book.martialArtsScore * nr;
    attrPrefs.magic += book.magicScore * nr;
    attrPrefs.character += book.characterScore * nr;
  }

  const rc = ratings.length;
  attrPrefs.martial /= rc;
  attrPrefs.magic /= rc;
  attrPrefs.character /= rc;

  const candidates = allBooks.filter((b: any) =>
    !ratedBookIds.has(b.id) && !(excludeBookIds?.has(b.id))
  );

  const scored = candidates.map((book: any) => {
    let score = 0;
    const tags: string[] = JSON.parse(book.tags);
    const subgenres: string[] = JSON.parse(book.subgenres);
    score += (genreScores[book.genre] || 0) * 3;
    for (const sg of subgenres) score += (genreScores[sg] || 0);
    for (const tag of tags) score += (tagScores[tag] || 0) * 1.5;
    score += (book.martialArtsScore / 5) * attrPrefs.martial * 2;
    score += (book.magicScore / 5) * attrPrefs.magic * 2;
    score += (book.characterScore / 5) * attrPrefs.character * 2;
    return { ...book, subgenres, tags, score: Math.round(score * 100) / 100 };
  });

  scored.sort((a: any, b: any) => b.score - a.score);
  return scored.slice(0, 10);
}

export function registerRoutes(httpServer: any, app: Express): Server {
  // Seed on startup if empty
  if (storage.getBooksCount() === 0) {
    storage.seedBooks(SEED_BOOKS as any);
  }

  // ── Auth (passwordless — email only) ──────────────────────────────────────

  // POST /api/auth/signin — creates account if new, signs in if existing, returns permanent token
  app.post("/api/auth/signin", (req, res) => {
    const { email } = req.body;
    const emailClean = (email || "").trim().toLowerCase();
    if (!emailClean || !/^[^@]+@[^@]+\.[^@]+$/.test(emailClean)) {
      res.status(400).json({ error: "Please enter a valid email address." });
      return;
    }
    try {
      const user = storage.findOrCreateUserByEmail(emailClean);
      const token = storage.createToken(user.id);
      res.json({ token, userId: user.id, username: user.username });
    } catch (e: any) {
      res.status(500).json({ error: "Sign in failed." });
    }
  });

  // GET /api/auth/me — validate persistent token
  app.get("/api/auth/me", (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const userId = getSession(token);
    if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
    const user = storage.getUserById(userId);
    if (!user) { res.status(401).json({ error: "User not found" }); return; }
    res.json({ userId: user.id, username: user.username });
  });

  // Keep old register/login endpoints returning a helpful message
  app.post("/api/auth/register", (req, res) => res.status(410).json({ error: "Use /api/auth/signin with your email." }));
  app.post("/api/auth/login", (req, res) => res.status(410).json({ error: "Use /api/auth/signin with your email." }));

  // ── Books ──────────────────────────────────────────────────────────────────

  // GET /api/books — returns books with community avg rating + current user's rating
  app.get("/api/books", (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const userId = getSession(token);

    const allBooks = storage.getAllBooks();
    const allRatings = storage.getAllRatings();

    // Build community avg map: bookId → { avg, count, raters: [{username, rating}] }
    const communityMap = new Map<number, { total: number; count: number; raters: { userId: number; rating: number }[] }>();
    for (const r of allRatings) {
      const entry = communityMap.get(r.bookId) || { total: 0, count: 0, raters: [] };
      entry.total += r.rating;
      entry.count++;
      entry.raters.push({ userId: r.userId, rating: r.rating });
      communityMap.set(r.bookId, entry);
    }

    // Build per-user rating map for current user
    const myRatingMap = new Map<number, any>();
    if (userId) {
      const myRatings = storage.getUserRatings(userId);
      for (const r of myRatings) myRatingMap.set(r.bookId, r);
    }

    // Resolve usernames for community raters
    const usernameCache = new Map<number, string>();
    const getUsername = (uid: number) => {
      if (!usernameCache.has(uid)) {
        usernameCache.set(uid, storage.getUserById(uid)?.username ?? "Unknown");
      }
      return usernameCache.get(uid)!;
    };

    const result = allBooks.map((b) => {
      const comm = communityMap.get(b.id);
      const communityRating = comm
        ? { avg: Math.round((comm.total / comm.count) * 10) / 10, count: comm.count,
            raters: comm.raters.map((r) => ({ username: getUsername(r.userId), rating: r.rating })) }
        : null;
      return {
        ...b,
        subgenres: JSON.parse(b.subgenres),
        tags: JSON.parse(b.tags),
        userRating: myRatingMap.get(b.id) || null,
        communityRating,
      };
    });
    res.json(result);
  });

  // POST /api/books — add a user-found book
  app.post("/api/books", (req, res) => {
    const parsed = insertBookSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error }); return; }
    const book = storage.addBook(parsed.data);
    res.json(book);
  });

  // ── Ratings ────────────────────────────────────────────────────────────────

  // POST /api/ratings — upsert rating for authenticated user
  app.post("/api/ratings", (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const userId = getSession(token);
    if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

    const { bookId, rating, notes } = req.body;
    const parsed = insertRatingSchema.safeParse({ userId, bookId, rating, notes, read: 1 });
    if (!parsed.success) { res.status(400).json({ error: parsed.error }); return; }
    const result = storage.upsertRating(parsed.data);
    res.json(result);
  });

  // DELETE /api/ratings/:bookId
  app.delete("/api/ratings/:bookId", (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const userId = getSession(token);
    if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
    storage.deleteRating(userId, parseInt(req.params.bookId));
    res.json({ success: true });
  });

  // ── Recommendations (community-pooled) ─────────────────────────────────────

  // GET /api/recommendations — powered by ALL users' ratings combined
  app.get("/api/recommendations", (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const userId = getSession(token);
    const allBooks = storage.getAllBooks();
    const allRatings = storage.getAllRatings();

    // Exclude books the current user has already read
    const myReadIds = userId
      ? new Set(storage.getUserRatings(userId).map((r) => r.bookId))
      : new Set<number>();

    res.json(buildRecommendations(allBooks, allRatings, myReadIds));
  });

  // GET /api/similar/:bookId
  app.get("/api/similar/:bookId", (req, res) => {
    const bookId = parseInt(req.params.bookId);
    const allBooks = storage.getAllBooks();
    const sourceBook = allBooks.find((b) => b.id === bookId);
    if (!sourceBook) { res.status(404).json({ error: "Book not found" }); return; }

    const sourceTags: string[] = JSON.parse(sourceBook.tags);
    const sourceSubgenres: string[] = JSON.parse(sourceBook.subgenres);

    const scored = allBooks
      .filter((b) => b.id !== bookId)
      .map((book) => {
        let score = 0;
        const tags: string[] = JSON.parse(book.tags);
        const subgenres: string[] = JSON.parse(book.subgenres);
        if (book.genre === sourceBook.genre) score += 4;
        for (const sg of subgenres) if (sourceSubgenres.includes(sg)) score += 1;
        for (const tag of tags) if (sourceTags.includes(tag)) score += 2;
        score -= Math.abs(book.martialArtsScore - sourceBook.martialArtsScore) * 0.5;
        score -= Math.abs(book.magicScore - sourceBook.magicScore) * 0.5;
        score -= Math.abs(book.characterScore - sourceBook.characterScore) * 0.5;
        return { ...book, subgenres, tags, score };
      });

    scored.sort((a, b) => b.score - a.score);
    res.json(scored.slice(0, 6));
  });

  // ── Auto-Discovery Engine ────────────────────────────────────────────────
  // ── Shared discovery helpers ─────────────────────────────────────────────────
  function inferGenre(subjects: string[]): string {
    const s = subjects.join(" ").toLowerCase();
    if (s.includes("wuxia") || s.includes("martial arts")) return "wuxia";
    if (s.includes("litrpg") || s.includes("dungeon") || s.includes("game")) return "litrpg";
    if (s.includes("urban fantasy") || s.includes("contemporary fantasy")) return "urban";
    if (s.includes("cultivation") || s.includes("xianxia") || s.includes("immortal")) return "cultivation";
    if (s.includes("progression")) return "progression";
    return "high_fantasy";
  }
  function coverColors(genre: string): [string, string] {
    const map: Record<string, [string, string]> = {
      wuxia: ["#0f2027", "#c94b4b"], cultivation: ["#0d1b2a", "#56a0d3"],
      litrpg: ["#0a1628", "#7c3aed"], urban: ["#1a1a2e", "#e94560"],
      progression: ["#0f1b0f", "#22c55e"], high_fantasy: ["#1e1433", "#c8973a"],
    };
    return map[genre] || ["#1a1a2e", "#c8973a"];
  }
  interface TasteProfile {
    tagScores: Record<string, number>;
    genreScores: Record<string, number>;
    topTags: string[];
    topGenres: string[];
  }
  function buildTasteProfile(ratings: any[], allBooks: any[]): TasteProfile {
    const tagScores: Record<string, number> = {};
    const genreScores: Record<string, number> = {};
    for (const rating of ratings) {
      const book = allBooks.find((b: any) => b.id === rating.bookId);
      if (!book) continue;
      const weight = (rating.rating - 5) / 5;
      genreScores[book.genre] = (genreScores[book.genre] || 0) + weight;
      const tags: string[] = JSON.parse(book.tags);
      for (const tag of tags) tagScores[tag] = (tagScores[tag] || 0) + weight;
    }
    const topTags = Object.entries(tagScores).filter(([, s]) => s > 0)
      .sort(([, a], [, b]) => b - a).slice(0, 3).map(([t]) => t);
    const topGenres = Object.entries(genreScores).filter(([, s]) => s > 0)
      .sort(([, a], [, b]) => b - a).slice(0, 2).map(([g]) => g.replace(/_/g, " "));
    return { tagScores, genreScores, topTags, topGenres };
  }
  function buildQueries(profile: TasteProfile): string[] {
    const queries: string[] = [];
    if (profile.topTags.length > 0) queries.push(profile.topTags.slice(0, 2).join(" "));
    if (profile.topGenres.length > 0) queries.push(profile.topGenres[0] + " fantasy");
    if (queries.length === 0) queries.push("martial arts fantasy");
    return queries;
  }
  function scoreCandidate(doc: any, profile: TasteProfile): { doc: any; genre: string; tags: string[]; subjects: string[]; score: number } {
    const subjects: string[] = (doc.subject || []).slice(0, 8);
    const tags = subjects.map((s: string) => s.toLowerCase());
    let score = 0;
    for (const tag of tags) score += (profile.tagScores[tag] || 0) * 1.5;
    const genre = inferGenre(subjects);
    score += (profile.genreScores[genre] || 0) * 3;
    return { doc, genre, tags, subjects, score };
  }
  function addDiscoveredBook(doc: any, genre: string, tags: string[], subjects: string[]): any {
    const [coverColor, coverAccent] = coverColors(genre);
    const s = subjects.join(" ").toLowerCase();
    const martialArtsScore = s.includes("martial") || s.includes("combat") || s.includes("fighting") ? 4 : 2;
    const magicScore = s.includes("magic") || s.includes("fantasy") || s.includes("power") ? 4 : 2;
    const characterScore = s.includes("character") || s.includes("coming of age") || s.includes("growth") ? 4 : 3;
    const book = storage.addBook({
      title: doc.title,
      author: (doc.author_name || ["Unknown Author"])[0],
      genre,
      subgenres: JSON.stringify([genre]),
      description: subjects.slice(0, 5).join(", ") || "Discovered by the recommendation engine.",
      martialArtsScore, magicScore, characterScore,
      seriesName: null, seriesBook: null,
      coverColor, coverAccent,
      publishYear: doc.first_publish_year || null,
      tags: JSON.stringify(tags.slice(0, 6)),
    });
    return { ...book, subgenres: [genre], tags: tags.slice(0, 6), userRating: null, communityRating: null };
  }
  // Fetch Open Library + process results, then call done(added, queries, profile)
  function runDiscovery(profile: TasteProfile, existingTitles: Set<string>, limit: number,
    done: (added: any[], queries: string[], profile: TasteProfile) => void) {
    const queries = buildQueries(profile);
    let completed = 0;
    const allDocs: any[] = [];
    const finish = () => {
      const seen = new Set<string>();
      const unique = allDocs.filter(doc => {
        const t = (doc.title || "").toLowerCase().trim();
        if (!t || seen.has(t) || existingTitles.has(t)) return false;
        seen.add(t); return true;
      });
      const scored = unique.map(doc => scoreCandidate(doc, profile));
      scored.sort((a, b) => b.score - a.score);
      const added: any[] = [];
      for (const { doc, genre, tags, subjects } of scored.slice(0, limit)) {
        try { added.push(addDiscoveredBook(doc, genre, tags, subjects)); } catch { /* skip dupes */ }
      }
      done(added, queries, profile);
    };
    for (const q of queries) {
      const encoded = encodeURIComponent(q);
      const url = `https://openlibrary.org/search.json?q=${encoded}&limit=15&fields=title,author_name,first_publish_year,subject,cover_i,key`;
      https.get(url, { headers: { "User-Agent": "BladeAndPage/1.0" } }, (olRes) => {
        let data = "";
        olRes.on("data", (chunk) => { data += chunk; });
        olRes.on("end", () => {
          try { allDocs.push(...(JSON.parse(data).docs || [])); } catch { }
          completed++;
          if (completed === queries.length) finish();
        });
      }).on("error", () => { completed++; if (completed === queries.length) finish(); });
    }
  }
  // Score an existing library book against a taste profile (for personal picks from existing library)
  function scoreLibraryBook(book: any, profile: TasteProfile): number {
    let score = 0;
    score += (profile.genreScores[book.genre] || 0) * 3;
    const tags: string[] = JSON.parse(book.tags);
    for (const tag of tags) score += (profile.tagScores[tag] || 0) * 1.5;
    return score;
  }

  // ── GET /api/discover/group — community taste profile → discover new books ──
  app.get("/api/discover/group", (req, res) => {
    const allBooks = storage.getAllBooks();
    const allRatings = storage.getAllRatings();
    if (allRatings.length < 3) {
      res.json({ added: [], personalPicks: [], message: "Need at least 3 community ratings." });
      return;
    }
    const profile = buildTasteProfile(allRatings, allBooks);
    const existingTitles = new Set(allBooks.map((b: any) => b.title.toLowerCase().trim()));
    runDiscovery(profile, existingTitles, 5, (added, queries, prof) => {
      res.json({ added, queriesUsed: queries, tasteProfile: { topTags: prof.topTags, topGenres: prof.topGenres } });
    });
  });

  // ── GET /api/discover/personal — YOUR taste profile → discover + recommend ──
  // Returns: { added (new books from Open Library), forYouIds (existing book IDs matching your taste) }
  app.get("/api/discover/personal", (req, res) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const userId = getSession(token);
    if (!userId) { res.json({ added: [], forYouIds: [], message: "Sign in to get personal picks." }); return; }

    const allBooks = storage.getAllBooks();
    const myRatings = storage.getUserRatings(userId);
    if (myRatings.length < 2) {
      res.json({ added: [], forYouIds: [], message: "Rate at least 2 books for personal discovery." });
      return;
    }

    const profile = buildTasteProfile(myRatings, allBooks);
    const existingTitles = new Set(allBooks.map((b: any) => b.title.toLowerCase().trim()));
    const myRatedIds = new Set(myRatings.map(r => r.bookId));

    // Score existing unread books against personal profile
    const existingScored = allBooks
      .filter((b: any) => !myRatedIds.has(b.id))
      .map((b: any) => ({ id: b.id, score: scoreLibraryBook(b, profile) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    const forYouIds = existingScored.map(x => x.id);

    // Also search Open Library for personal matches (top 3)
    runDiscovery(profile, existingTitles, 3, (added, queries, prof) => {
      // Include newly added book IDs in forYouIds too
      const allForYouIds = [...added.map((b: any) => b.id), ...forYouIds];
      res.json({ added, forYouIds: allForYouIds, queriesUsed: queries,
        tasteProfile: { topTags: prof.topTags, topGenres: prof.topGenres } });
    });
  });

  // Keep legacy /api/discover working (redirects to group)
  app.get("/api/discover", (req, res) => {
    res.redirect("/api/discover/group");
  });

  // ── Open Library search proxy ──────────────────────────────────────────────
  app.get("/api/search", (req, res) => {
    const q = (req.query.q as string || "").trim();
    if (!q) { res.json([]); return; }
    const encoded = encodeURIComponent(q + " fantasy");
    const url = `https://openlibrary.org/search.json?q=${encoded}&limit=20&fields=title,author_name,first_publish_year,subject,cover_i,key`;
    https.get(url, { headers: { "User-Agent": "BladeAndPage/1.0" } }, (olRes) => {
      let data = "";
      olRes.on("data", (chunk) => { data += chunk; });
      olRes.on("end", () => {
        try {
          const json = JSON.parse(data);
          const results = (json.docs || []).slice(0, 20).map((doc: any) => ({
            title: doc.title || "Unknown",
            author: (doc.author_name || ["Unknown Author"])[0],
            publishYear: doc.first_publish_year || null,
            subjects: (doc.subject || []).slice(0, 8),
            coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
            openLibraryKey: doc.key || null,
          }));
          res.json(results);
        } catch { res.status(500).json({ error: "Parse error" }); }
      });
    }).on("error", (err: any) => res.status(500).json({ error: err.message }));
  });

  // ── GET /api/books/:id/free-links — check Open Library availability + LibriVox ──
  app.get("/api/books/:id/free-links", (req, res) => {
    const book = storage.getBook(Number(req.params.id));
    if (!book) { res.status(404).json({ error: "Book not found" }); return; }

    const title = book.title;
    const author = book.author;
    const results: any = { ebookUrl: null, borrowUrl: null, audioUrl: null };
    let pending = 2;
    const done = () => { if (--pending === 0) res.json(results); };

    // 1) Open Library — search for this exact title+author, check availability
    const olQ = encodeURIComponent(`${title} ${author}`);
    const olUrl = `https://openlibrary.org/search.json?q=${olQ}&limit=5&fields=key,title,author_name,ia,ebook_access,lending_edition_s`;
    https.get(olUrl, { headers: { "User-Agent": "BladeAndPage/1.0" } }, (r) => {
      let d = "";
      r.on("data", c => d += c);
      r.on("end", () => {
        try {
          const json = JSON.parse(d);
          const docs = json.docs || [];
          // Find best match (title contains our title)
          const match = docs.find((doc: any) =>
            (doc.title || "").toLowerCase().includes(title.toLowerCase().slice(0, 15))
          ) || docs[0];
          if (match) {
            const access = match.ebook_access || "";
            if (access === "public") {
              // Freely readable on Open Library
              const ia = match.ia?.[0];
              results.ebookUrl = ia
                ? `https://archive.org/embed/${ia}`
                : `https://openlibrary.org${match.key}`;
            } else if (access === "borrowable" || match.lending_edition_s) {
              // Can borrow for free (1-hour loan)
              results.borrowUrl = `https://openlibrary.org${match.key}`;
            }
            // Also check Internet Archive directly
            if (!results.ebookUrl && match.ia?.[0]) {
              results.iaUrl = `https://archive.org/details/${match.ia[0]}`;
            }
          }
        } catch { }
        done();
      });
    }).on("error", () => done());

    // 2) LibriVox — free public domain audiobooks
    const lvQ = encodeURIComponent(title);
    const lvUrl = `https://librivox.org/api/feed/audiobooks?title=${lvQ}&format=json&extended=1&limit=3`;
    https.get(lvUrl, { headers: { "User-Agent": "BladeAndPage/1.0" } }, (r) => {
      let d = "";
      r.on("data", c => d += c);
      r.on("end", () => {
        try {
          const json = JSON.parse(d);
          const books = json.books || [];
          const match = books.find((b: any) =>
            (b.title || "").toLowerCase().includes(title.toLowerCase().slice(0, 12))
          );
          if (match) {
            results.audioUrl = match.url_librivox || `https://librivox.org/${match.id}`;
          }
        } catch { }
        done();
      });
    }).on("error", () => done());
  });

  return httpServer;
}
