import React, {
  createContext,
  FC,
  PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { TreeNode } from "@/types";
import { collectUrls } from "@/utils/treeUtil";

export interface SideNavContextValue {
  isSideNavOpen: boolean;
  toggleSideNav: () => void;
  open: () => void;
  close: () => void;

  // SideNav variables
  pathHistory: string[];
  setPathHistory: React.Dispatch<React.SetStateAction<string[]>>;

  currentFolder?: TreeNode[];
  setCurrentFolder: React.Dispatch<React.SetStateAction<TreeNode[]>>;

  currentFolderImages?: string[];
}

const SideNavContext = createContext<SideNavContextValue | undefined>(
  undefined,
);

export const SideNavProvider: FC<
  PropsWithChildren<{ initialOpen?: boolean }>
> = ({ children, initialOpen = false }) => {
  const [isSideNavOpen, setIsSideNavOpen] = useState<boolean>(initialOpen);

  const [pathHistory, setPathHistory] = useState<string[]>([]);
  const [currentFolder, setCurrentFolder] = useState<TreeNode[]>([]);
  const currentFolderImages = useMemo(
    () => collectUrls(currentFolder),
    [currentFolder],
  );

  const open = useCallback(() => setIsSideNavOpen(true), []);
  const close = useCallback(() => setIsSideNavOpen(false), []);
  const toggleSideNav = useCallback(() => setIsSideNavOpen((s) => !s), []);

  const value = useMemo(
    () => ({
      isSideNavOpen,
      open,
      close,
      toggleSideNav,
      currentFolder,
      setCurrentFolder,
      currentFolderImages,
      pathHistory,
      setPathHistory,
    }),
    [
      isSideNavOpen,
      open,
      close,
      toggleSideNav,
      currentFolder,
      setCurrentFolder,
      currentFolderImages,
      pathHistory,
      setPathHistory,
    ],
  );

  return (
    <SideNavContext.Provider value={value}>{children}</SideNavContext.Provider>
  );
};

export function useSideNavBar(): SideNavContextValue {
  const ctx = useContext(SideNavContext);

  if (!ctx) {
    throw new Error("useSideNavBar must be used within a SideNavProvider");
  }

  return ctx;
}
