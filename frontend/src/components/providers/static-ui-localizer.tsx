"use client";

import { useEffect, useRef } from "react";
import type { PublicLocale } from "@/lib/i18n/public-messages";
import { translateStaticText } from "@/lib/i18n/static-ui-translations";

const localizableAttributes = ["aria-label", "placeholder", "title"] as const;

export function StaticUiLocalizer({ locale }: { locale: PublicLocale }) {
  const textSourcesRef = useRef(new WeakMap<Text, string>());
  const attributeSourcesRef = useRef(new WeakMap<Element, Map<string, string>>());

  useEffect(() => {
    const textSources = textSourcesRef.current;
    const attributeSources = attributeSourcesRef.current;

    function localizeText(node: Text) {
      const parent = node.parentElement;
      if (!parent || parent.closest("script,style,[data-no-ui-translation]")) return;
      const stored = textSources.get(node);
      const current = node.data;
      const source = stored ?? current;
      textSources.set(node, source);
      node.data = translateStaticText(source, locale);
    }

    function localizeElement(element: Element) {
      if (element.closest("script,style,[data-no-ui-translation]")) return;
      let sources = attributeSources.get(element);
      if (!sources) { sources = new Map(); attributeSources.set(element, sources); }
      for (const attribute of localizableAttributes) {
        const current = element.getAttribute(attribute);
        if (current === null) continue;
        const stored = sources.get(attribute);
        const source = stored ?? current;
        sources.set(attribute, source);
        element.setAttribute(attribute, translateStaticText(source, locale));
      }
    }

    function localize(root: Node) {
      if (root.nodeType === Node.TEXT_NODE) localizeText(root as Text);
      if (root.nodeType === Node.ELEMENT_NODE) localizeElement(root as Element);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        if (node.nodeType === Node.TEXT_NODE) localizeText(node as Text);
        else localizeElement(node as Element);
        node = walker.nextNode();
      }
    }

    function apply(root: Node) {
      observer?.disconnect();
      localize(root);
      observer?.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [...localizableAttributes] });
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") mutation.addedNodes.forEach(apply);
        else if (mutation.type === "characterData") {
          textSources.set(mutation.target as Text, (mutation.target as Text).data);
          apply(mutation.target);
        } else {
          const element = mutation.target as Element;
          const attribute = mutation.attributeName;
          if (attribute) {
            let sources = attributeSources.get(element);
            if (!sources) { sources = new Map(); attributeSources.set(element, sources); }
            const value = element.getAttribute(attribute);
            if (value !== null) sources.set(attribute, value);
          }
          apply(element);
        }
      }
    });
    apply(document.body);
    return () => observer.disconnect();
  }, [locale]);

  return null;
}
