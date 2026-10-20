/**
 * Locating and replacing the recipe block in an item description (C9). String regular expressions only: no DOM in
 * Vitest, and the recipe lists are never nested.
 */
import { BLOCK_CLASS } from "../constants.mjs";

const CLASS_ATTR = `class="[^"]*\\b${BLOCK_CLASS}\\b[^"]*"`;
/** One `<p>` or `<ul>` carrying the module class. */
const MODULE_ELEMENT = new RegExp(`<(p|ul)\\b[^>]*\\b${CLASS_ATTR}[^>]*>[\\s\\S]*?<\\/\\1>`, "g");
/**
 * Book paragraph ("Crafting." / "Artisanat.", em/strong optional) immediately followed by its list: the paragraph
 * body cannot span another `</p>`, so nothing between a stray "Crafting." and a distant list is swallowed.
 */
const BOOK_BLOCK = new RegExp(
  "<p(?:\\s[^>]*)?>(?:\\s*<(?:em|strong)(?:\\s[^>]*)?>)*\\s*(?:Crafting|Artisanat)\\.(?:(?!<\\/p>)[\\s\\S])*<\\/p>"
  + "\\s*<ul(?:\\s[^>]*)?>(?:(?!<\\/ul>)[\\s\\S])*<\\/ul>"
  + "(?:\\s*<p(?:\\s[^>]*)?>\\s*(?:Each item must come from a different monster\\.|Chaque Composant doit provenir d'un monstre différent\\.)\\s*<\\/p>)?"
);

/**
 * @param {string} html
 * @returns {{ start: number, end: number, source: "module"|"book" }|null}
 */
export function findRecipeBlock(html) {
  const text = String(html ?? "");
  MODULE_ELEMENT.lastIndex = 0;
  const first = MODULE_ELEMENT.exec(text);
  if (first) {
    let end = first.index + first[0].length;
    // Extend over the contiguous elements of the block (whitespace between them only)
    for (;;) {
      const gap = /^\s*/.exec(text.slice(end))[0].length;
      MODULE_ELEMENT.lastIndex = end + gap;
      const next = MODULE_ELEMENT.exec(text);
      if (!next || next.index !== end + gap) break;
      end = next.index + next[0].length;
    }
    return { start: first.index, end, source: "module" };
  }
  const book = BOOK_BLOCK.exec(text);
  if (book) return { start: book.index, end: book.index + book[0].length, source: "book" };
  return null;
}

/** Replace the existing block in place, or append `blockHtml` at the end. */
export function replaceRecipeBlock(html, blockHtml) {
  const text = String(html ?? "");
  const found = findRecipeBlock(text);
  if (!found) return text + blockHtml;
  return text.slice(0, found.start) + blockHtml + text.slice(found.end);
}

/** The description without its recipe block (and the whitespace around it). */
export function stripRecipeBlock(html) {
  const text = String(html ?? "");
  const found = findRecipeBlock(text);
  if (!found) return text;
  return (text.slice(0, found.start).replace(/\s+$/, "") + " " + text.slice(found.end).replace(/^\s+/, "")).trim();
}
