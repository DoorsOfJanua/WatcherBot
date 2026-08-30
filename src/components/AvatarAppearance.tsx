import { createContext, useContext, type ReactNode } from "react";

export type AvatarStyle = "classic" | "spirits";

const AvatarAppearanceContext = createContext<AvatarStyle>("classic");

export function AvatarAppearanceProvider({
  style,
  children,
}: {
  style: AvatarStyle;
  children: ReactNode;
}) {
  return (
    <AvatarAppearanceContext.Provider value={style}>
      {children}
    </AvatarAppearanceContext.Provider>
  );
}

export function useAvatarStyle(): AvatarStyle {
  return useContext(AvatarAppearanceContext);
}
