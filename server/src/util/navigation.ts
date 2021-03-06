class ElementQueue {
    elements: Array<Element>;

    constructor() {
        this.elements = [];
    }

    empty(): Boolean {
        return this.elements.length === 0;
    }

    length(): Number {
        return this.elements.length;
    }

    pop(): Element {
        return this.elements.shift() ?? new Element();
    }

    push(e: Element) {
        this.elements.push(e);
    }
    
}

enum ElementComparisonResult {
    First,
    Second,
    None
}

// Returns which element occurs first in the DOM
function compareElementOrder(
    parent: Element | null,
    e1: Element,
    e2: Element, 
    currResult: ElementComparisonResult = ElementComparisonResult.None
): ElementComparisonResult {
    if (currResult !== ElementComparisonResult.None) {
        return currResult;
    }

    if (parent === e1) {
        return ElementComparisonResult.First;
    }

    if (parent === e2) {
        return ElementComparisonResult.Second;
    }

    let comparisonResult = ElementComparisonResult.None;
    for (const child of parent?.children ?? []) {
        if (comparisonResult === ElementComparisonResult.None) {
            comparisonResult = compareElementOrder(child as Element, e1, e2, currResult);
        }
    }
    return comparisonResult;
}

export function detectMainContent(document: Document): Element | null {
    const main = document.querySelectorAll("main");
    if (main.length > 1) {
        // TODO: We shouldn't have multiple main areas
        return null;
    } else if (main.length === 1) {
        return main[0];
    } else {
        // Jusy take the largest top-level section
        const topLevelNodes = document.querySelector("body")?.children ?? [];
        return Array.from(topLevelNodes).sort((a, b) => b.outerHTML.length - a.outerHTML.length)[0];
    }
}

export function detectNavigationContent(document: Document): Element | null {
    const nav = document.querySelectorAll("nav");
    if (nav.length > 1) {
        // TODO: We shouldn't have multiple navigation areas
        return null;
    } else if (nav.length === 1) {
        return nav[0];
    } else {
        const q = new ElementQueue();
        for (const child of document.querySelectorAll("body > *:not(script)")) {
            q.push(child);
        }

        while (!q.empty()) {
            const e = q.pop();
            let aCount = 0;
            let aContent = "";
            for (const child of e?.children) {
                q.push(child);
                const node = child as HTMLAnchorElement;
                if (node.href) {
                    aCount++;
                    aContent += node.textContent?.replace(/\s/g, "");
                }
            }

            // Designating 3 links in close succession as a navigation area
            // We also compare the length of the link text to the length of the body to account for text content that contains hyperlinks
            if (aCount >= 3 && (e.textContent?.replace(/\s/g, "").length ?? 0) <= aContent.length) {
                return e;
            }
        }

        return null;
    }
}

export function isNavBeforeMain(document: Document, main: Element, nav: Element): Boolean {
    const body = document.querySelector("body");
    return compareElementOrder(body, nav, main) === ElementComparisonResult.First;
}

export function isMainFirst(document: Document, main: Element, navExists: Boolean = false): Boolean {
    const body = document.querySelector("body");
    const mainIndex = Array.prototype.indexOf.call(body?.children, main);
    // If there is no main content, we still want to return true to avoid sending a Diagnostic
    return mainIndex <= 0 || (navExists && mainIndex <= 1);
}
