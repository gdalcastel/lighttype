import {
  Anton,
  Archivo_Black,
  Bebas_Neue,
  Dancing_Script,
  Great_Vibes,
  Inter,
  Libre_Baskerville,
  Lobster,
  Merriweather,
  Montserrat,
  Nunito,
  Oswald,
  Outfit,
  Pacifico,
  Playfair_Display,
  Poppins,
  Quicksand,
  Righteous,
  Varela_Round,
} from "next/font/google";

const montserrat = Montserrat({ subsets: ["latin", "latin-ext"], weight: "700", display: "swap" });
const poppins = Poppins({ subsets: ["latin", "latin-ext"], weight: "800", display: "swap" });
const interBold = Inter({ subsets: ["latin", "latin-ext"], weight: "700", display: "swap" });
const outfit = Outfit({ subsets: ["latin", "latin-ext"], weight: "700", display: "swap" });
const oswald = Oswald({ subsets: ["latin", "latin-ext"], weight: "700", display: "swap" });
const anton = Anton({ subsets: ["latin", "latin-ext"], weight: "400", display: "swap" });
const archivoBlack = Archivo_Black({ subsets: ["latin", "latin-ext"], weight: "400", display: "swap" });
const nunito = Nunito({ subsets: ["latin", "latin-ext"], weight: "800", display: "swap" });
const quicksand = Quicksand({ subsets: ["latin", "latin-ext"], weight: "700", display: "swap" });
const varela = Varela_Round({ subsets: ["latin", "latin-ext"], weight: "400", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin", "latin-ext"], weight: "700", display: "swap" });
const merriweather = Merriweather({ subsets: ["latin", "latin-ext"], weight: "700", display: "swap" });
const libre = Libre_Baskerville({ subsets: ["latin", "latin-ext"], weight: "700", display: "swap" });
const pacifico = Pacifico({ subsets: ["latin", "latin-ext"], weight: "400", display: "swap" });
const dancing = Dancing_Script({ subsets: ["latin", "latin-ext"], weight: "700", display: "swap" });
const vibes = Great_Vibes({ subsets: ["latin", "latin-ext"], weight: "400", display: "swap" });
const bebas = Bebas_Neue({ subsets: ["latin", "latin-ext"], weight: "400", display: "swap" });
const righteous = Righteous({ subsets: ["latin", "latin-ext"], weight: "400", display: "swap" });
const lobster = Lobster({ subsets: ["latin", "latin-ext"], weight: "400", display: "swap" });

export const FONT_CLASS: Record<string, string> = {
  "montserrat-bold": montserrat.className,
  "poppins-extrabold": poppins.className,
  "inter-bold": interBold.className,
  "outfit-bold": outfit.className,
  "oswald-bold": oswald.className,
  anton: anton.className,
  "archivo-black": archivoBlack.className,
  "nunito-extrabold": nunito.className,
  "quicksand-bold": quicksand.className,
  "varela-round": varela.className,
  "playfair-bold": playfair.className,
  "merriweather-bold": merriweather.className,
  "libre-baskerville-bold": libre.className,
  pacifico: pacifico.className,
  "dancing-script-bold": dancing.className,
  "great-vibes": vibes.className,
  "bebas-neue": bebas.className,
  righteous: righteous.className,
  lobster: lobster.className,
};
