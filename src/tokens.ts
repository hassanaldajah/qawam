// Brand tokens: single source for contrast tests. Mirrored in src/index.css (:root vars).
// One primary (teal, gradient to green/lime, never toward orange) + one accent (lime/green).
// Coral is a small alert/highlight accent only, never blended with the other hues.
export const light = {
  bg: "#F4F7F8", fg: "#101729", muted: "#4B5870", card: "#FFFFFF",
  primary: "#0E6577", primaryEnd: "#17703F", onPrimary: "#FFFFFF",
  accentText: "#B93A1F", green: "#2F7A12",
};
export const dark = {
  bg: "#0B1222", fg: "#FFFFFF", muted: "#A3AEC6", card: "#151D33",
  primary: "#2CC6DA", primaryEnd: "#8BE04E", onPrimary: "#0B1222",
  accentText: "#FF7A59", green: "#8BE04E",
};
