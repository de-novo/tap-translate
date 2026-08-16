import { createContext, useContext, type ReactNode } from "react";

const ShadowPortalContext = createContext<HTMLElement | undefined>(undefined);

export function ShadowPortalProvider({
  container,
  children
}: {
  container?: HTMLElement;
  children: ReactNode;
}) {
  return <ShadowPortalContext.Provider value={container}>{children}</ShadowPortalContext.Provider>;
}

export function useShadowPortal(): HTMLElement | undefined {
  return useContext(ShadowPortalContext);
}
