import { useCallback, useEffect, useState } from "react";
import type { StoredCreatorLink } from "./types";
import { loadStoredLinks, saveStoredLinks } from "./links-ui-helpers";

export function useCreatorLinks() {
  const [links, setLinks] = useState<StoredCreatorLink[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLinks(loadStoredLinks());
    setMounted(true);

    const onStorage = (e: StorageEvent) => {
      if (e.key === "mrv_creator_links") {
        setLinks(loadStoredLinks());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const addLink = useCallback((newLink: StoredCreatorLink) => {
    setLinks((prev) => {
      const next = [newLink, ...prev.filter((l) => l.code !== newLink.code)];
      saveStoredLinks(next);
      return next;
    });
  }, []);

  const removeLink = useCallback((code: string) => {
    setLinks((prev) => {
      const next = prev.filter((l) => l.code !== code);
      saveStoredLinks(next);
      return next;
    });
  }, []);

  const updateStoredLink = useCallback((code: string, patch: Partial<StoredCreatorLink>) => {
    setLinks((prev) => {
      const next = prev.map((l) => (l.code === code ? { ...l, ...patch } : l));
      saveStoredLinks(next);
      return next;
    });
  }, []);

  return {
    links,
    mounted,
    addLink,
    removeLink,
    updateStoredLink,
  };
}
