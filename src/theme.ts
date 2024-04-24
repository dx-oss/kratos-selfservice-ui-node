import { defaultLightTheme } from "@ory/elements-markup"

export const theme = {
  ...defaultLightTheme,
  fontFamily: "Eudoxus sans",
  accent: {
    def: "#6E56D1",
    muted: "#6E56D1",
    emphasis: "#0077B6",
    disabled: "#BABABA",
    subtle: "#BDBDBD",
  },
  foreground: {
    def: "#293C4B",
    muted: "#293C4B",
    subtle: "#9E9E9E",
    disabled: "#BDBDBD",
    onDark: "#FFFFFF",
    onAccent: "#FFFFFF",
    onDisabled: "#e0e0e0",
  },
  background: {
    surface: "#FFFFFF",
    canvas: "#F3F4F6",
    subtle: "#EEEEEE",
  },
  error: {
    def: "#C91616",
    subtle: "#FFE2E2",
    muted: "#F25555",
    emphasis: "#DF1642",
  },
  success: {
    emphasis: "#1F8956",
  },
  border: {
    def: "#B4A4F8",
  },
  text: {
    def: "#FFFFFF",
    disabled: "#757575",
  },
  input: {
    background: "#FFFFFF",
    disabled: "#E0E0E0",
    placeholder: "#9E9E9E",
    text: "#293c4b",
  },
}
