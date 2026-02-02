import { Font } from "@react-pdf/renderer";
import DejaVuSans from "./DejaVuSans.ttf";
import DejaVuSansBold from "./DejaVuSans-Bold.ttf";

let registered = false;

export const registerFonts = () => {
  if (registered) return;
  Font.register({
    family: "DejaVu",
    fonts: [
      { src: DejaVuSans },
      { src: DejaVuSansBold, fontWeight: 700 },
    ],
  });
  registered = true;
};
