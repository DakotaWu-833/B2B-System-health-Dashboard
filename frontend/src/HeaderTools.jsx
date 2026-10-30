import { createContext, useContext } from "react";
import { createPortal } from "react-dom";

const HeaderTarget = createContext(null);
export const HeaderToolsProvider = HeaderTarget.Provider;

export default function HeaderTools({ children }) {
  const target = useContext(HeaderTarget);
  return target ? createPortal(children, target) : children;
}
