import { extendTheme, ThemeConfig } from "@chakra-ui/react";
import { mode, StyleFunctionProps } from "@chakra-ui/theme-tools";

const config: ThemeConfig = {
  initialColorMode: "light",
  useSystemColorMode: false,
};

const colors = {
  brand: {
    50: "#e3f2ff",
    100: "#b9dbff",
    200: "#8fc3ff",
    300: "#65abff",
    400: "#3b93ff",
    500: "#2079e6",
    600: "#155fb4",
    700: "#0a4582",
    800: "#032b51",
    900: "#001220",
  },
};

const fonts = {
  heading: "'Poppins', system-ui, sans-serif",
  body: "'Inter', system-ui, sans-serif",
};

const components = {
  Button: {
    defaultProps: {
      colorScheme: "brand",
    },
    variants: {
      solid: {
        borderRadius: "full",
        fontWeight: "600",
      },
      outline: {
        borderRadius: "full",
        fontWeight: "600",
      },
    },
  },
  Card: {
    baseStyle: {
      p: 6,
      borderRadius: "2xl",
      boxShadow: "lg",
    },
  },
};

const styles = {
  global: (props: StyleFunctionProps) => ({
    body: {
      backgroundColor: mode("rgba(255,255,255,0.75)", "rgba(2,6,23,0.85)")(props),
      color: mode("gray.800", "gray.100")(props),
      transitionProperty: "background-color",
      transitionDuration: "normal",
      minHeight: "100vh",
    },
  }),
};

export const theme = extendTheme({ config, colors, fonts, components, styles });

