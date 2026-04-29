/**
 * Petname word lists for deterministic human-readable identity generation
 * (SPEC §4.2)
 *
 * Word lists are carefully curated to be:
 * - Positive and friendly
 * - Easy to pronounce
 * - Culturally neutral
 * - Visually distinct (no similar-looking words)
 */

import type { PetnameWordLists } from "@/types/identity";

/**
 * Adjectives (256 entries)
 * Index range: 0x00 - 0xFF
 */
export const ADJECTIVES: string[] = [
  // Positive qualities (0x00-0x3F)
  "Swift", "Brave", "Calm", "Bright", "Noble", "Wise", "Kind", "Bold",
  "Gentle", "Clever", "Strong", "Quick", "Proud", "Free", "Pure", "Keen",
  "Alert", "Agile", "Lively", "Steady", "True", "Lucky", "Happy", "Jolly",
  "Merry", "Sunny", "Warm", "Cool", "Fresh", "Clear", "Crisp", "Smooth",
  "Sleek", "Silent", "Quiet", "Peaceful", "Tranquil", "Serene", "Calm", "Still",
  "Royal", "Grand", "Elegant", "Graceful", "Refined", "Polished", "Pristine", "Perfect",
  "Radiant", "Glowing", "Shining", "Sparkling", "Gleaming", "Brilliant", "Vivid", "Vibrant",
  "Mighty", "Powerful", "Sturdy", "Robust", "Resilient", "Enduring", "Lasting", "Eternal",

  // Natural elements (0x40-0x7F)
  "Azure", "Crimson", "Golden", "Silver", "Amber", "Jade", "Ruby", "Pearl",
  "Emerald", "Sapphire", "Crystal", "Diamond", "Onyx", "Opal", "Topaz", "Coral",
  "Misty", "Foggy", "Cloudy", "Stormy", "Windy", "Breezy", "Frosty", "Snowy",
  "Rainy", "Dewy", "Dusty", "Muddy", "Sandy", "Rocky", "Stony", "Pebbly",
  "Leafy", "Mossy", "Grassy", "Flowery", "Thorny", "Vined", "Rooted", "Branched",
  "Marine", "Coastal", "Tidal", "Ocean", "River", "Lake", "Forest", "Mountain",
  "Desert", "Prairie", "Meadow", "Valley", "Canyon", "Ridge", "Peak", "Summit",
  "Dawn", "Dusk", "Twilight", "Midnight", "Noon", "Sunrise", "Sunset", "Starlit",

  // Abstract qualities (0x80-0xBF)
  "Ancient", "Modern", "Classic", "Vintage", "Timeless", "Eternal", "Fleeting", "Brief",
  "Hidden", "Secret", "Mystic", "Cosmic", "Stellar", "Lunar", "Solar", "Astral",
  "Distant", "Near", "Remote", "Close", "Far", "Local", "Global", "Universal",
  "Infinite", "Boundless", "Endless", "Limitless", "Vast", "Immense", "Tiny", "Small",
  "Gentle", "Fierce", "Wild", "Tame", "Savage", "Docile", "Meek", "Humble",
  "Proud", "Modest", "Simple", "Complex", "Plain", "Fancy", "Ornate", "Bare",
  "Rich", "Poor", "Wealthy", "Scarce", "Abundant", "Plentiful", "Rare", "Common",
  "Unique", "Special", "Ordinary", "Exotic", "Strange", "Familiar", "Known", "Unknown",

  // Action-oriented (0xC0-0xFF)
  "Soaring", "Diving", "Flying", "Gliding", "Floating", "Drifting", "Sailing", "Cruising",
  "Running", "Racing", "Rushing", "Dashing", "Sprinting", "Jogging", "Walking", "Striding",
  "Jumping", "Leaping", "Bounding", "Hopping", "Skipping", "Dancing", "Twirling", "Spinning",
  "Rising", "Falling", "Climbing", "Descending", "Ascending", "Soaring", "Plunging", "Swooping",
  "Roaming", "Wandering", "Traveling", "Journeying", "Exploring", "Seeking", "Searching", "Finding",
  "Resting", "Sleeping", "Dreaming", "Waking", "Watching", "Waiting", "Listening", "Hearing",
  "Speaking", "Singing", "Chanting", "Whispering", "Shouting", "Calling", "Echoing", "Resounding",
  "Blazing", "Burning", "Smoldering", "Flickering", "Glowing", "Shimmering", "Twinkling", "Sparkling",
];

/**
 * Nouns (256 entries)
 * Index range: 0x00 - 0xFF
 */
export const NOUNS: string[] = [
  // Birds (0x00-0x1F)
  "Falcon", "Eagle", "Hawk", "Raven", "Crow", "Owl", "Swan", "Dove",
  "Robin", "Sparrow", "Finch", "Wren", "Lark", "Thrush", "Jay", "Cardinal",
  "Heron", "Crane", "Stork", "Ibis", "Pelican", "Gull", "Tern", "Albatross",
  "Phoenix", "Griffin", "Condor", "Vulture", "Kite", "Harrier", "Buzzard", "Kestrel",

  // Mammals (0x20-0x3F)
  "Wolf", "Fox", "Bear", "Lion", "Tiger", "Leopard", "Panther", "Lynx",
  "Deer", "Elk", "Moose", "Caribou", "Bison", "Buffalo", "Ox", "Bull",
  "Horse", "Stallion", "Mare", "Pony", "Zebra", "Donkey", "Mule", "Camel",
  "Otter", "Beaver", "Badger", "Weasel", "Mink", "Ferret", "Stoat", "Marten",

  // Aquatic (0x40-0x5F)
  "Dolphin", "Whale", "Seal", "Walrus", "Orca", "Narwhal", "Manatee", "Dugong",
  "Shark", "Ray", "Marlin", "Tuna", "Salmon", "Trout", "Bass", "Pike",
  "Octopus", "Squid", "Nautilus", "Jellyfish", "Starfish", "Urchin", "Coral", "Anemone",
  "Turtle", "Tortoise", "Crab", "Lobster", "Shrimp", "Prawn", "Clam", "Oyster",

  // Reptiles & Amphibians (0x60-0x6F)
  "Dragon", "Serpent", "Snake", "Viper", "Cobra", "Python", "Anaconda", "Boa",
  "Lizard", "Gecko", "Iguana", "Chameleon", "Komodo", "Monitor", "Skink", "Newt",

  // Mythical & Fantasy (0x70-0x7F)
  "Unicorn", "Pegasus", "Sphinx", "Chimera", "Hydra", "Kraken", "Basilisk", "Wyrm",
  "Gryphon", "Manticore", "Wyvern", "Gargoyle", "Golem", "Titan", "Colossus", "Leviathan",

  // Celestial (0x80-0x8F)
  "Star", "Comet", "Meteor", "Nova", "Nebula", "Galaxy", "Cosmos", "Void",
  "Moon", "Sun", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Neptune",

  // Nature (0x90-0xAF)
  "Oak", "Pine", "Maple", "Birch", "Willow", "Cedar", "Aspen", "Cypress",
  "Rose", "Lily", "Lotus", "Orchid", "Jasmine", "Violet", "Iris", "Dahlia",
  "Mountain", "Valley", "Canyon", "Ridge", "Peak", "Summit", "Cliff", "Crag",
  "River", "Stream", "Brook", "Creek", "Lake", "Pond", "Ocean", "Sea",

  // Weather & Elements (0xB0-0xBF)
  "Storm", "Thunder", "Lightning", "Rain", "Snow", "Frost", "Ice", "Hail",
  "Wind", "Breeze", "Gale", "Tempest", "Cyclone", "Typhoon", "Hurricane", "Tornado",

  // Minerals & Gems (0xC0-0xCF)
  "Diamond", "Ruby", "Sapphire", "Emerald", "Topaz", "Amethyst", "Quartz", "Opal",
  "Jade", "Pearl", "Amber", "Coral", "Onyx", "Obsidian", "Granite", "Marble",

  // Abstract Concepts (0xD0-0xEF)
  "Echo", "Shadow", "Spirit", "Dream", "Vision", "Whisper", "Silence", "Song",
  "Flame", "Ember", "Spark", "Blaze", "Inferno", "Pyre", "Torch", "Beacon",
  "Dawn", "Dusk", "Twilight", "Midnight", "Horizon", "Zenith", "Nadir", "Equinox",
  "Atlas", "Compass", "Anchor", "Helm", "Sentinel", "Guardian", "Warden", "Keeper",

  // Miscellaneous (0xF0-0xFF)
  "Arrow", "Blade", "Shield", "Spear", "Bow", "Lance", "Sword", "Axe",
  "Crown", "Throne", "Scepter", "Orb", "Sigil", "Crest", "Banner", "Standard",
];

/**
 * Combined word lists
 */
export const WORDLISTS: PetnameWordLists = {
  adjectives: ADJECTIVES,
  nouns: NOUNS,
};

/**
 * Validate word list sizes (must be exactly 256 entries each)
 */
if (ADJECTIVES.length !== 256) {
  throw new Error(
    `ADJECTIVES list must have exactly 256 entries, got ${ADJECTIVES.length}`,
  );
}

if (NOUNS.length !== 256) {
  throw new Error(`NOUNS list must have exactly 256 entries, got ${NOUNS.length}`);
}

/**
 * Get a petname from word list indices
 */
export function getPetnameFromIndices(
  adjectiveIndex: number,
  nounIndex: number,
): { adjective: string; noun: string; display: string } {
  if (adjectiveIndex < 0 || adjectiveIndex >= 256) {
    throw new Error(`Invalid adjective index: ${adjectiveIndex}`);
  }
  if (nounIndex < 0 || nounIndex >= 256) {
    throw new Error(`Invalid noun index: ${nounIndex}`);
  }

  const adjective = ADJECTIVES[adjectiveIndex];
  const noun = NOUNS[nounIndex];

  if (!adjective || !noun) {
    throw new Error(`Invalid word list lookup: adjective=${adjective}, noun=${noun}`);
  }

  return {
    adjective,
    noun,
    display: `${adjective} ${noun}`,
  };
}
