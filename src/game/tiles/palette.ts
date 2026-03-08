// Pico-8 inspired color palette
export const PICO8_COLORS = {
  black: 0x000000,
  darkBlue: 0x1d2b53,
  darkPurple: 0x7e2553,
  darkGreen: 0x008751,
  brown: 0xab5236,
  darkGray: 0x5f574f,
  lightGray: 0xc2c3c7,
  white: 0xfff1e8,
  red: 0xff004d,
  orange: 0xffa300,
  yellow: 0xffec27,
  green: 0x00e436,
  blue: 0x29adff,
  lavender: 0x83769c,
  pink: 0xff77a8,
  peach: 0xffccaa,
} as const;

// Tile IDs for the office tilemap
export const TILE_IDS = {
  // Floor tiles (0-9)
  FLOOR_LIGHT: 0,
  FLOOR_DARK: 1,
  FLOOR_CARPET: 2,
  
  // Wall tiles (10-19)
  WALL_TOP: 10,
  WALL_BOTTOM: 11,
  WALL_LEFT: 12,
  WALL_RIGHT: 13,
  WALL_CORNER_TL: 14,
  WALL_CORNER_TR: 15,
  WALL_CORNER_BL: 16,
  WALL_CORNER_BR: 17,
  
  // Furniture (20-39)
  DESK_TL: 20,
  DESK_TR: 21,
  DESK_BL: 22,
  DESK_BR: 23,
  CHAIR_UP: 24,
  CHAIR_DOWN: 25,
  CHAIR_LEFT: 26,
  CHAIR_RIGHT: 27,
  COMPUTER: 28,
  
  // Coffee area (40-49)
  COFFEE_MACHINE: 40,
  COUNTER_LEFT: 41,
  COUNTER_MID: 42,
  COUNTER_RIGHT: 43,
  PLANT: 44,
  
  // Meeting room (50-59)
  TABLE_TL: 50,
  TABLE_TR: 51,
  TABLE_BL: 52,
  TABLE_BR: 53,
  WHITEBOARD: 54,
  
  // Decorations (60-69)
  DOOR: 60,
  WINDOW: 61,
  POSTER: 62,
} as const;
