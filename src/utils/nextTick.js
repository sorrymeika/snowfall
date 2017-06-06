var BrowserMutationObserver = window.MutationObserver || window.WebKitMutationObserver;

function useMutationObserver() {
    var iterations = 0;
    var queue = [];
    var observer = new BrowserMutationObserver(() => {
        for (var i = 0; i < queue.length; i++) {
            queue[i]();
        }
        queue = [];
    });
    var node = document.createTextNode('');

    observer.observe(node, { characterData: true });

    return function (next) {
        queue.push(next);
        node.data = (iterations = ++iterations % 2);
    };
}

function useSetTimeout() {
    return function (next) {
        setTimeout(next, 0);
    };
}

var nextTick = BrowserMutationObserver
    ? useMutationObserver()
    : useSetTimeout();

export default nextTick;