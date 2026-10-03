"use client";

import { useEffect } from "react";

/**
 * On a phone, the on-screen keyboard covers the bottom of the screen, and a tab bar fixed there floats in the middle of the page
 * above it. While a text box is focused, mark the page so the tab bar and the floating chat button step aside.
 */
export function KeyboardAware() {
  useEffect(() => {
    const root = document.documentElement;
    const isField = (el: EventTarget | null) => el instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(el.tagName) && !/^(checkbox|radio|file|button|submit)$/.test((el as HTMLInputElement).type ?? "");
    const on = (e: FocusEvent) => { if (isField(e.target)) root.dataset.kb = "1"; };
    const off = () => { delete root.dataset.kb; };
    document.addEventListener("focusin", on);
    document.addEventListener("focusout", off);
    return () => { document.removeEventListener("focusin", on); document.removeEventListener("focusout", off); off(); };
  }, []);
  return null;
}
