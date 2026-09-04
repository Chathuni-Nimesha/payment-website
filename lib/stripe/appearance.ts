export const stripeAppearance = {
  theme: "stripe" as const,
  variables: {
    colorPrimary: "#1e4a86",
    colorBackground: "#ffffff",
    colorText: "#111111",
    colorDanger: "#b42318",
    colorTextSecondary: "#5c5c57",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
    borderRadius: "8px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": {
      border: "1px solid #e6e6e0",
      boxShadow: "none",
    },
    ".Input:focus": {
      border: "1px solid #1e4a86",
      boxShadow: "none",
    },
  },
};
