export type ThemeColors = {
  primary: string;
  planMode: string;
  selection: string;
  thinking: string;
  success: string;
  error: string;
  info: string;
  background: string;
  surface: string;
  dialogSurface: string;
  thinkingBorder: string;
  dimSeparator: string;
};

export type Theme = {
  name: string;
  colors: ThemeColors;
};

export const THEMES: Theme[] = [
  {
    name: "Slate",
    colors: {
      primary: "#56D6C2",
      planMode: "#CF8EF4",
      selection: "#89B4FA",
      thinking: "#CF8EF4",
      success: "#82E0AA",
      error: "#E74C5E",
      info: "#56D6C2",
      background: "#0D0D12",
      surface: "#1A1A24",
      dialogSurface: "#0A0A10",
      thinkingBorder: "#34344A",
      dimSeparator: "#4E4E66",
    },
  },
  {
    name: "Amethyst",
    colors: {
      primary: "#B48EAD",
      planMode: "#D3869B",
      selection: "#8FBCBB",
      thinking: "#D3869B",
      success: "#A3BE8C",
      error: "#BF616A",
      info: "#88C0D0",
      background: "#20182B",
      surface: "#2C2138",
      dialogSurface: "#171022",
      thinkingBorder: "#463A56",
      dimSeparator: "#5E4F70",
    },
  },
  {
    name: "Ember",
    colors: {
      primary: "#E8A33D",
      planMode: "#E0777A",
      selection: "#F0C36D",
      thinking: "#E0777A",
      success: "#9CB86E",
      error: "#D9534F",
      info: "#E8A33D",
      background: "#1A1310",
      surface: "#261C17",
      dialogSurface: "#120D0A",
      thinkingBorder: "#4A362A",
      dimSeparator: "#6B5240",
    },
  },
  {
    name: "Glacier",
    colors: {
      primary: "#5FA8D3",
      planMode: "#7B90D6",
      selection: "#8ECAE6",
      thinking: "#7B90D6",
      success: "#5FBFA0",
      error: "#E0616A",
      info: "#5FA8D3",
      background: "#0E1620",
      surface: "#16212E",
      dialogSurface: "#0A1017",
      thinkingBorder: "#2E4258",
      dimSeparator: "#41597A",
    },
  },
];

export const DEFAULT_THEME = THEMES.find((t) => t.name === "Slate")!;
