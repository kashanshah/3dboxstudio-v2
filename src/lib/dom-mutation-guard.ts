// Browser translators and extensions (Google Translate, Grammarly, Dark Reader…)
// move or wrap text nodes that React owns. React's next update then calls
// removeChild/insertBefore with a node that is no longer where it left it, and
// the DOM throws NotFoundError, taking the whole editor down. Ignoring that one
// impossible operation leaves the page usable; React re-renders the content on
// its next update. See https://github.com/facebook/react/issues/11538.

type Report = (operation: 'removeChild' | 'insertBefore') => void;

let installed = false;

export function installDomMutationGuard(report: Report) {
  if (installed || typeof Node !== 'function' || !Node.prototype) return;
  installed = true;

  const removeChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function guardedRemoveChild<T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      report('removeChild');
      return child;
    }
    return removeChild.call(this, child) as T;
  };

  const insertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function guardedInsertBefore<T extends Node>(this: Node, node: T, reference: Node | null): T {
    if (reference && reference.parentNode !== this) {
      report('insertBefore');
      return node;
    }
    return insertBefore.call(this, node, reference) as T;
  };
}
