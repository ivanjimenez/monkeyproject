"use strict";

function getFileName(url) {
    var anchor = url.indexOf("#");
    var query = url.indexOf("?");
    var end = Math.min(anchor > 0 ? anchor : url.length, query > 0 ? query : url.length);
    return url.substring(url.lastIndexOf("/", end) + 1, end);
}

function getOutputScale(ctx) {
    var devicePixelRatio = window.devicePixelRatio || 1;
    var backingStoreRatio = ctx.webkitBackingStorePixelRatio || ctx.mozBackingStorePixelRatio || ctx.msBackingStorePixelRatio || ctx.oBackingStorePixelRatio || ctx.backingStorePixelRatio || 1;
    var pixelRatio = devicePixelRatio / backingStoreRatio;
    return {
        sx: pixelRatio,
        sy: pixelRatio,
        scaled: 1 != pixelRatio
    };
}

function scrollIntoView(element, spot) {
    var parent = element.offsetParent;
    var offsetY = element.offsetTop + element.clientTop;
    if (!parent) {
        console.error("offsetParent is not set -- cannot scroll");
        return;
    }
    while (parent.clientHeight == parent.scrollHeight) {
        offsetY += parent.offsetTop;
        parent = parent.offsetParent;
        if (!parent) return;
    }
    spot && (offsetY += spot.top);
    parent.scrollTop = offsetY;
}

function noContextMenuHandler(e) {
    e.preventDefault();
}

function getPDFFileNameFromURL(url) {
    var reURI = /^(?:([^:]+:)?\/\/[^\/]+)?([^?#]*)(\?[^#]*)?(#.*)?$/;
    var reFilename = /[^\/?#=]+\.pdf\b(?!.*\.pdf\b)/i;
    var splitURI = reURI.exec(url);
    var suggestedFilename = reFilename.exec(splitURI[1]) || reFilename.exec(splitURI[2]) || reFilename.exec(splitURI[3]);
    if (suggestedFilename) {
        suggestedFilename = suggestedFilename[0];
        if (-1 != suggestedFilename.indexOf("%")) try {
            suggestedFilename = reFilename.exec(decodeURIComponent(suggestedFilename))[0];
        } catch (e) {}
    }
    return suggestedFilename || "document.pdf";
}

function updateViewarea() {
    if (!PDFView.initialized) return;
    var visible = PDFView.getVisiblePages();
    var visiblePages = visible.views;
    if (0 === visiblePages.length) return;
    PDFView.renderHighestPriority();
    var currentId = PDFView.page;
    var firstPage = visible.first;
    for (var i = 0, ii = visiblePages.length, stillFullyVisible = false; ii > i; ++i) {
        var page = visiblePages[i];
        if (100 > page.percent) break;
        if (page.id === PDFView.page) {
            stillFullyVisible = true;
            break;
        }
    }
    stillFullyVisible || (currentId = visiblePages[0].id);
    updateViewarea.inProgress = true;
    PDFView.page = currentId;
    updateViewarea.inProgress = false;
    var currentScale = PDFView.currentScale;
    var currentScaleValue = PDFView.currentScaleValue;
    var normalizedScaleValue = currentScaleValue == currentScale ? 100 * currentScale : currentScaleValue;
    var pageNumber = firstPage.id;
    var pdfOpenParams = "#page=" + pageNumber;
    pdfOpenParams += "&zoom=" + normalizedScaleValue;
    var currentPage = PDFView.pages[pageNumber - 1];
    var topLeft = currentPage.getPagePoint(PDFView.container.scrollLeft, PDFView.container.scrollTop - firstPage.y);
    pdfOpenParams += "," + Math.round(topLeft[0]) + "," + Math.round(topLeft[1]);
    var store = PDFView.store;
    store.initializedPromise.then(function() {
        store.set("exists", true);
        store.set("page", pageNumber);
        store.set("zoom", normalizedScaleValue);
        store.set("scrollLeft", Math.round(topLeft[0]));
        store.set("scrollTop", Math.round(topLeft[1]));
    });
    var href = PDFView.getAnchorUrl(pdfOpenParams);
    document.getElementById("viewBookmark").href = href;
    document.getElementById("secondaryViewBookmark").href = href;
    PDFHistory.updateCurrentBookmark(pdfOpenParams, pageNumber);
}

function selectScaleOption(value) {
    var options = document.getElementById("scaleSelect").options;
    var predefinedValueFound = false;
    for (var i = 0; options.length > i; i++) {
        var option = options[i];
        if (option.value != value) {
            option.selected = false;
            continue;
        }
        option.selected = true;
        predefinedValueFound = true;
    }
    return predefinedValueFound;
}

var DEFAULT_URL = "helloworld.pdf";

var DEFAULT_SCALE = "auto";

var DEFAULT_SCALE_DELTA = 1.1;

var UNKNOWN_SCALE = 0;

var CACHE_SIZE = 20;

var CSS_UNITS = 96 / 72;

var SCROLLBAR_PADDING = 40;

var VERTICAL_PADDING = 5;

var MIN_SCALE = .25;

var MAX_SCALE = 4;

var SETTINGS_MEMORY = 20;

var SCALE_SELECT_CONTAINER_PADDING = 8;

var SCALE_SELECT_PADDING = 22;

var USE_ONLY_CSS_ZOOM = false;

var RenderingStates = {
    INITIAL: 0,
    RUNNING: 1,
    PAUSED: 2,
    FINISHED: 3
};

var FindStates = {
    FIND_FOUND: 0,
    FIND_NOTFOUND: 1,
    FIND_WRAPPED: 2,
    FIND_PENDING: 3
};

PDFJS.imageResourcesPath = "./images/";

PDFJS.workerSrc = "../build/pdf.worker.js";

var mozL10n = document.mozL10n || document.webL10n;

var CustomStyle = function() {
    function CustomStyle() {}
    var prefixes = [ "ms", "Moz", "Webkit", "O" ];
    var _cache = {};
    CustomStyle.getProp = function(propName, element) {
        if (1 == arguments.length && "string" == typeof _cache[propName]) return _cache[propName];
        element = element || document.documentElement;
        var prefixed, uPropName, style = element.style;
        if ("string" == typeof style[propName]) return _cache[propName] = propName;
        uPropName = propName.charAt(0).toUpperCase() + propName.slice(1);
        for (var i = 0, l = prefixes.length; l > i; i++) {
            prefixed = prefixes[i] + uPropName;
            if ("string" == typeof style[prefixed]) return _cache[propName] = prefixed;
        }
        return _cache[propName] = "undefined";
    };
    CustomStyle.setProp = function(propName, element, str) {
        var prop = this.getProp(propName);
        "undefined" != prop && (element.style[prop] = str);
    };
    return CustomStyle;
}();

var ProgressBar = function() {
    function clamp(v, min, max) {
        return Math.min(Math.max(v, min), max);
    }
    function ProgressBar(id, opts) {
        this.div = document.querySelector(id + " .progress");
        this.bar = this.div.parentNode;
        this.height = opts.height || 100;
        this.width = opts.width || 100;
        this.units = opts.units || "%";
        this.div.style.height = this.height + this.units;
        this.percent = 0;
    }
    ProgressBar.prototype = {
        updateBar: function() {
            if (this._indeterminate) {
                this.div.classList.add("indeterminate");
                this.div.style.width = this.width + this.units;
                return;
            }
            this.div.classList.remove("indeterminate");
            var progressSize = this.width * this._percent / 100;
            this.div.style.width = progressSize + this.units;
        },
        get percent() {
            return this._percent;
        },
        set percent(val) {
            this._indeterminate = isNaN(val);
            this._percent = clamp(val, 0, 100);
            this.updateBar();
        },
        setWidth: function(viewer) {
            if (viewer) {
                var container = viewer.parentNode;
                var scrollbarWidth = container.offsetWidth - viewer.offsetWidth;
                scrollbarWidth > 0 && this.bar.setAttribute("style", "width: calc(100% - " + scrollbarWidth + "px);");
            }
        },
        hide: function() {
            this.bar.classList.add("hidden");
            this.bar.removeAttribute("style");
        }
    };
    return ProgressBar;
}();

var Cache = function(size) {
    var data = [];
    this.push = function(view) {
        var i = data.indexOf(view);
        i >= 0 && data.splice(i);
        data.push(view);
        data.length > size && data.shift().destroy();
    };
};

(function() {
    function dispatchEvent(eventType) {
        var event = document.createEvent("CustomEvent");
        event.initCustomEvent(eventType, false, false, "custom");
        window.dispatchEvent(event);
    }
    function next() {
        if (!canvases) return;
        renderProgress();
        if (++index < canvases.length) {
            var canvas = canvases[index];
            "function" == typeof canvas.mozPrintCallback ? canvas.mozPrintCallback({
                context: canvas.getContext("2d"),
                abort: abort,
                done: next
            }) : next();
        } else {
            renderProgress();
            print.call(window);
            setTimeout(abort, 20);
        }
    }
    function abort() {
        if (canvases) {
            canvases = null;
            renderProgress();
            dispatchEvent("afterprint");
        }
    }
    function renderProgress() {
        var progressContainer = document.getElementById("mozPrintCallback-shim");
        if (canvases) {
            var progress = Math.round(100 * index / canvases.length);
            var progressBar = progressContainer.querySelector("progress");
            var progressPerc = progressContainer.querySelector(".relative-progress");
            progressBar.value = progress;
            progressPerc.textContent = progress + "%";
            progressContainer.removeAttribute("hidden");
            progressContainer.onclick = abort;
        } else progressContainer.setAttribute("hidden", "");
    }
    if ("mozPrintCallback" in document.createElement("canvas")) return;
    HTMLCanvasElement.prototype.mozPrintCallback = void 0;
    var canvases;
    var index;
    var print = window.print;
    window.print = function print() {
        if (canvases) {
            console.warn("Ignored window.print() because of a pending print job.");
            return;
        }
        try {
            dispatchEvent("beforeprint");
        } finally {
            canvases = document.querySelectorAll("canvas");
            index = -1;
            next();
        }
    };
    var hasAttachEvent = !!document.attachEvent;
    window.addEventListener("keydown", function(event) {
        if (80 === event.keyCode && (event.ctrlKey || event.metaKey)) {
            window.print();
            if (hasAttachEvent) return;
            event.preventDefault();
            event.stopImmediatePropagation ? event.stopImmediatePropagation() : event.stopPropagation();
            return;
        }
        27 === event.keyCode && canvases && abort();
    }, true);
    hasAttachEvent && document.attachEvent("onkeydown", function(event) {
        event = event || window.event;
        if (80 === event.keyCode && event.ctrlKey) {
            event.keyCode = 0;
            return false;
        }
    });
    if ("onbeforeprint" in window) {
        var stopPropagationIfNeeded = function(event) {
            "custom" !== event.detail && event.stopImmediatePropagation && event.stopImmediatePropagation();
        };
        window.addEventListener("beforeprint", stopPropagationIfNeeded, false);
        window.addEventListener("afterprint", stopPropagationIfNeeded, false);
    }
})();

var DownloadManager = function() {
    function download(blobUrl, filename) {
        var a = document.createElement("a");
        if (a.click) {
            a.href = blobUrl;
            a.target = "_parent";
            "download" in a && (a.download = filename);
            (document.body || document.documentElement).appendChild(a);
            a.click();
            a.parentNode.removeChild(a);
        } else {
            if (window.top === window && blobUrl.split("#")[0] === window.location.href.split("#")[0]) {
                var padCharacter = -1 === blobUrl.indexOf("?") ? "?" : "&";
                blobUrl = blobUrl.replace(/#|$/, padCharacter + "$&");
            }
            window.open(blobUrl, "_parent");
        }
    }
    function DownloadManager() {}
    DownloadManager.prototype = {
        downloadUrl: function(url, filename) {
            if (!PDFJS.isValidUrl(url, true)) return;
            download(url + "#pdfjs.action=download", filename);
        },
        download: function(blob, url, filename) {
            if (!URL) {
                this.downloadUrl(url, filename);
                return;
            }
            if (navigator.msSaveBlob) {
                navigator.msSaveBlob(blob, filename) || this.downloadUrl(url, filename);
                return;
            }
            var blobUrl = URL.createObjectURL(blob);
            download(blobUrl, filename);
        }
    };
    return DownloadManager;
}();

var cache = new Cache(CACHE_SIZE);

var currentPageNumber = 1;

var Settings = function() {
    function Settings(fingerprint) {
        this.fingerprint = fingerprint;
        this.initializedPromise = new PDFJS.Promise();
        var resolvePromise = function(db) {
            this.initialize(db || "{}");
            this.initializedPromise.resolve();
        }.bind(this);
        isLocalStorageEnabled && resolvePromise(localStorage.getItem("database"));
    }
    var isLocalStorageEnabled = function() {
        try {
            return "localStorage" in window && null !== window["localStorage"] && localStorage;
        } catch (e) {
            return false;
        }
    }();
    Settings.prototype = {
        initialize: function(database) {
            database = JSON.parse(database);
            "files" in database || (database.files = []);
            database.files.length >= SETTINGS_MEMORY && database.files.shift();
            var index;
            for (var i = 0, length = database.files.length; length > i; i++) {
                var branch = database.files[i];
                if (branch.fingerprint === this.fingerprint) {
                    index = i;
                    break;
                }
            }
            "number" != typeof index && (index = database.files.push({
                fingerprint: this.fingerprint
            }) - 1);
            this.file = database.files[index];
            this.database = database;
        },
        set: function(name, val) {
            if (!this.initializedPromise.isResolved) return;
            var file = this.file;
            file[name] = val;
            var database = JSON.stringify(this.database);
            isLocalStorageEnabled && localStorage.setItem("database", database);
        },
        get: function(name, defaultValue) {
            if (!this.initializedPromise.isResolved) return defaultValue;
            return this.file[name] || defaultValue;
        }
    };
    return Settings;
}();

var PDFFindBar = {
    opened: false,
    bar: null,
    toggleButton: null,
    findField: null,
    highlightAll: null,
    caseSensitive: null,
    findMsg: null,
    findStatusIcon: null,
    findPreviousButton: null,
    findNextButton: null,
    initialize: function(options) {
        if ("undefined" == typeof PDFFindController || null === PDFFindController) throw "PDFFindBar cannot be initialized without a PDFFindController instance.";
        this.bar = options.bar;
        this.toggleButton = options.toggleButton;
        this.findField = options.findField;
        this.highlightAll = options.highlightAllCheckbox;
        this.caseSensitive = options.caseSensitiveCheckbox;
        this.findMsg = options.findMsg;
        this.findStatusIcon = options.findStatusIcon;
        this.findPreviousButton = options.findPreviousButton;
        this.findNextButton = options.findNextButton;
        var self = this;
        this.toggleButton.addEventListener("click", function() {
            self.toggle();
        });
        this.findField.addEventListener("input", function() {
            self.dispatchEvent("");
        });
        this.bar.addEventListener("keydown", function(evt) {
            switch (evt.keyCode) {
              case 13:
                evt.target === self.findField && self.dispatchEvent("again", evt.shiftKey);
                break;

              case 27:
                self.close();
            }
        });
        this.findPreviousButton.addEventListener("click", function() {
            self.dispatchEvent("again", true);
        });
        this.findNextButton.addEventListener("click", function() {
            self.dispatchEvent("again", false);
        });
        this.highlightAll.addEventListener("click", function() {
            self.dispatchEvent("highlightallchange");
        });
        this.caseSensitive.addEventListener("click", function() {
            self.dispatchEvent("casesensitivitychange");
        });
    },
    dispatchEvent: function(aType, aFindPrevious) {
        var event = document.createEvent("CustomEvent");
        event.initCustomEvent("find" + aType, true, true, {
            query: this.findField.value,
            caseSensitive: this.caseSensitive.checked,
            highlightAll: this.highlightAll.checked,
            findPrevious: aFindPrevious
        });
        return window.dispatchEvent(event);
    },
    updateUIState: function(state, previous) {
        var notFound = false;
        var findMsg = "";
        var status = "";
        switch (state) {
          case FindStates.FIND_FOUND:
            break;

          case FindStates.FIND_PENDING:
            status = "pending";
            break;

          case FindStates.FIND_NOTFOUND:
            findMsg = mozL10n.get("find_not_found", null, "Phrase not found");
            notFound = true;
            break;

          case FindStates.FIND_WRAPPED:
            findMsg = previous ? mozL10n.get("find_reached_top", null, "Reached top of document, continued from bottom") : mozL10n.get("find_reached_bottom", null, "Reached end of document, continued from top");
        }
        notFound ? this.findField.classList.add("notFound") : this.findField.classList.remove("notFound");
        this.findField.setAttribute("data-status", status);
        this.findMsg.textContent = findMsg;
    },
    open: function() {
        if (this.opened) return;
        this.opened = true;
        this.toggleButton.classList.add("toggled");
        this.bar.classList.remove("hidden");
        this.findField.select();
        this.findField.focus();
    },
    close: function() {
        if (!this.opened) return;
        this.opened = false;
        this.toggleButton.classList.remove("toggled");
        this.bar.classList.add("hidden");
        PDFFindController.active = false;
    },
    toggle: function() {
        this.opened ? this.close() : this.open();
    }
};

var PDFFindController = {
    startedTextExtraction: false,
    extractTextPromises: [],
    pendingFindMatches: {},
    active: false,
    pageContents: [],
    pageMatches: [],
    selected: {
        pageIdx: -1,
        matchIdx: -1
    },
    offset: {
        pageIdx: null,
        matchIdx: null
    },
    resumePageIdx: null,
    resumeCallback: null,
    state: null,
    dirtyMatch: false,
    findTimeout: null,
    pdfPageSource: null,
    integratedFind: false,
    firstPagePromise: new PDFJS.Promise(),
    initialize: function(options) {
        if ("undefined" == typeof PDFFindBar || null === PDFFindBar) throw "PDFFindController cannot be initialized without a PDFFindController instance";
        this.pdfPageSource = options.pdfPageSource;
        this.integratedFind = options.integratedFind;
        var events = [ "find", "findagain", "findhighlightallchange", "findcasesensitivitychange" ];
        this.handleEvent = this.handleEvent.bind(this);
        for (var i = 0; events.length > i; i++) window.addEventListener(events[i], this.handleEvent);
    },
    reset: function() {
        this.startedTextExtraction = false;
        this.extractTextPromises = [];
        this.active = false;
    },
    calcFindMatch: function(pageIndex) {
        var pageContent = this.pageContents[pageIndex];
        var query = this.state.query;
        var caseSensitive = this.state.caseSensitive;
        var queryLen = query.length;
        if (0 === queryLen) return;
        if (!caseSensitive) {
            pageContent = pageContent.toLowerCase();
            query = query.toLowerCase();
        }
        var matches = [];
        var matchIdx = -queryLen;
        while (true) {
            matchIdx = pageContent.indexOf(query, matchIdx + queryLen);
            if (-1 === matchIdx) break;
            matches.push(matchIdx);
        }
        this.pageMatches[pageIndex] = matches;
        this.updatePage(pageIndex);
        if (this.resumePageIdx === pageIndex) {
            var callback = this.resumeCallback;
            this.resumePageIdx = null;
            this.resumeCallback = null;
            callback();
        }
    },
    extractText: function() {
        function extractPageText(pageIndex) {
            self.pdfPageSource.pages[pageIndex].getTextContent().then(function(data) {
                var bidiTexts = data.bidiTexts;
                var str = "";
                for (var i = 0; bidiTexts.length > i; i++) str += bidiTexts[i].str;
                self.pageContents.push(str);
                self.extractTextPromises[pageIndex].resolve(pageIndex);
                self.pdfPageSource.pages.length > pageIndex + 1 && extractPageText(pageIndex + 1);
            });
        }
        if (this.startedTextExtraction) return;
        this.startedTextExtraction = true;
        this.pageContents = [];
        for (var i = 0, ii = this.pdfPageSource.pdfDocument.numPages; ii > i; i++) this.extractTextPromises.push(new PDFJS.Promise());
        var self = this;
        extractPageText(0);
    },
    handleEvent: function(e) {
        (null === this.state || "findagain" !== e.type) && (this.dirtyMatch = true);
        this.state = e.detail;
        this.updateUIState(FindStates.FIND_PENDING);
        this.firstPagePromise.then(function() {
            this.extractText();
            clearTimeout(this.findTimeout);
            "find" === e.type ? this.findTimeout = setTimeout(this.nextMatch.bind(this), 250) : this.nextMatch();
        }.bind(this));
    },
    updatePage: function(idx) {
        var page = this.pdfPageSource.pages[idx];
        this.selected.pageIdx === idx && page.scrollIntoView();
        page.textLayer && page.textLayer.updateMatches();
    },
    nextMatch: function() {
        this.pdfPageSource.pages;
        var previous = this.state.findPrevious;
        var numPages = this.pdfPageSource.pages.length;
        this.active = true;
        if (this.dirtyMatch) {
            this.dirtyMatch = false;
            this.selected.pageIdx = this.selected.matchIdx = -1;
            this.offset.pageIdx = previous ? numPages - 1 : 0;
            this.offset.matchIdx = null;
            this.hadMatch = false;
            this.resumeCallback = null;
            this.resumePageIdx = null;
            this.pageMatches = [];
            var self = this;
            for (var i = 0; numPages > i; i++) {
                this.updatePage(i);
                if (!(i in this.pendingFindMatches)) {
                    this.pendingFindMatches[i] = true;
                    this.extractTextPromises[i].then(function(pageIdx) {
                        delete self.pendingFindMatches[pageIdx];
                        self.calcFindMatch(pageIdx);
                    });
                }
            }
        }
        if ("" === this.state.query) {
            this.updateUIState(FindStates.FIND_FOUND);
            return;
        }
        if (this.resumeCallback) return;
        var offset = this.offset;
        if (null !== offset.matchIdx) {
            var numPageMatches = this.pageMatches[offset.pageIdx].length;
            if (!previous && numPageMatches > offset.matchIdx + 1 || previous && offset.matchIdx > 0) {
                this.hadMatch = true;
                offset.matchIdx = previous ? offset.matchIdx - 1 : offset.matchIdx + 1;
                this.updateMatch(true);
                return;
            }
            this.advanceOffsetPage(previous);
        }
        this.nextPageMatch();
    },
    nextPageMatch: function() {
        null !== this.resumePageIdx && console.error("There can only be one pending page.");
        var matchesReady = function(matches) {
            var offset = this.offset;
            var numMatches = matches.length;
            var previous = this.state.findPrevious;
            if (numMatches) {
                this.hadMatch = true;
                offset.matchIdx = previous ? numMatches - 1 : 0;
                this.updateMatch(true);
            } else {
                this.advanceOffsetPage(previous);
                if (offset.wrapped) {
                    offset.matchIdx = null;
                    if (!this.hadMatch) {
                        this.updateMatch(false);
                        return;
                    }
                }
                this.nextPageMatch();
            }
        }.bind(this);
        var pageIdx = this.offset.pageIdx;
        var pageMatches = this.pageMatches;
        if (!pageMatches[pageIdx]) {
            this.resumeCallback = function() {
                matchesReady(pageMatches[pageIdx]);
            };
            this.resumePageIdx = pageIdx;
            return;
        }
        matchesReady(pageMatches[pageIdx]);
    },
    advanceOffsetPage: function(previous) {
        var offset = this.offset;
        var numPages = this.extractTextPromises.length;
        offset.pageIdx = previous ? offset.pageIdx - 1 : offset.pageIdx + 1;
        offset.matchIdx = null;
        if (offset.pageIdx >= numPages || 0 > offset.pageIdx) {
            offset.pageIdx = previous ? numPages - 1 : 0;
            offset.wrapped = true;
            return;
        }
    },
    updateMatch: function(found) {
        var state = FindStates.FIND_NOTFOUND;
        var wrapped = this.offset.wrapped;
        this.offset.wrapped = false;
        if (found) {
            var previousPage = this.selected.pageIdx;
            this.selected.pageIdx = this.offset.pageIdx;
            this.selected.matchIdx = this.offset.matchIdx;
            state = wrapped ? FindStates.FIND_WRAPPED : FindStates.FIND_FOUND;
            -1 !== previousPage && previousPage !== this.selected.pageIdx && this.updatePage(previousPage);
        }
        this.updateUIState(state, this.state.findPrevious);
        -1 !== this.selected.pageIdx && this.updatePage(this.selected.pageIdx, true);
    },
    updateUIState: function(state, previous) {
        if (this.integratedFind) {
            FirefoxCom.request("updateFindControlState", {
                result: state,
                findPrevious: previous
            });
            return;
        }
        PDFFindBar.updateUIState(state, previous);
    }
};

var PDFHistory = {
    initialized: false,
    initialDestination: null,
    initialize: function(fingerprint) {
        function pdfHistoryBeforeUnload() {
            var previousParams = self._getPreviousParams(null, true);
            if (previousParams) {
                var replacePrevious = !self.current.dest && self.current.hash !== self.previousHash;
                self._pushToHistory(previousParams, false, replacePrevious);
                self._updatePreviousBookmark();
            }
            window.removeEventListener("beforeunload", pdfHistoryBeforeUnload, false);
        }
        if (PDFJS.disableHistory || PDFView.isViewerEmbedded) return;
        this.initialized = true;
        this.reInitialized = false;
        this.allowHashChange = true;
        this.historyUnlocked = true;
        this.previousHash = window.location.hash.substring(1);
        this.currentBookmark = "";
        this.currentPage = 0;
        this.updatePreviousBookmark = false;
        this.previousBookmark = "";
        this.previousPage = 0;
        this.nextHashParam = "";
        this.fingerprint = fingerprint;
        this.currentUid = this.uid = 0;
        this.current = {};
        var state = window.history.state;
        if (this._isStateObjectDefined(state)) {
            state.target.dest ? this.initialDestination = state.target.dest : PDFView.initialBookmark = state.target.hash;
            this.currentUid = state.uid;
            this.uid = state.uid + 1;
            this.current = state.target;
        } else {
            state && state.fingerprint && this.fingerprint !== state.fingerprint && (this.reInitialized = true);
            window.history.replaceState({
                fingerprint: this.fingerprint
            }, "", document.URL);
        }
        var self = this;
        window.addEventListener("popstate", function(evt) {
            evt.preventDefault();
            evt.stopPropagation();
            if (!self.historyUnlocked) return;
            if (evt.state) self._goTo(evt.state); else {
                self.previousHash = window.location.hash.substring(1);
                if (0 === self.uid) {
                    var previousParams = self.previousHash && self.currentBookmark && self.previousHash !== self.currentBookmark ? {
                        hash: self.currentBookmark,
                        page: self.currentPage
                    } : {
                        page: 1
                    };
                    self.historyUnlocked = false;
                    self.allowHashChange = false;
                    window.history.back();
                    self._pushToHistory(previousParams, false, true);
                    window.history.forward();
                    self.historyUnlocked = true;
                }
                self._pushToHistory({
                    hash: self.previousHash
                }, false, true);
                self._updatePreviousBookmark();
            }
        }, false);
        window.addEventListener("beforeunload", pdfHistoryBeforeUnload, false);
        window.addEventListener("pageshow", function() {
            window.addEventListener("beforeunload", pdfHistoryBeforeUnload, false);
        }, false);
    },
    _isStateObjectDefined: function(state) {
        return state && state.uid >= 0 && state.fingerprint && this.fingerprint === state.fingerprint && state.target && state.target.hash ? true : false;
    },
    get isHashChangeUnlocked() {
        if (!this.initialized) return true;
        var temp = this.allowHashChange;
        this.allowHashChange = true;
        return temp;
    },
    _updatePreviousBookmark: function() {
        if (this.updatePreviousBookmark && this.currentBookmark && this.currentPage) {
            this.previousBookmark = this.currentBookmark;
            this.previousPage = this.currentPage;
            this.updatePreviousBookmark = false;
        }
    },
    updateCurrentBookmark: function(bookmark, pageNum) {
        if (this.initialized) {
            this.currentBookmark = bookmark.substring(1);
            this.currentPage = 0 | pageNum;
            this._updatePreviousBookmark();
        }
    },
    updateNextHashParam: function(param) {
        this.initialized && (this.nextHashParam = param);
    },
    push: function(params, isInitialBookmark) {
        if (!(this.initialized && this.historyUnlocked)) return;
        params.dest && !params.hash && (params.hash = this.current.hash && this.current.dest && this.current.dest === params.dest ? this.current.hash : PDFView.getDestinationHash(params.dest).split("#")[1]);
        params.page && (params.page |= 0);
        if (isInitialBookmark) {
            var target = window.history.state.target;
            if (!target) {
                this._pushToHistory(params, false);
                this.previousHash = window.location.hash.substring(1);
            }
            this.updatePreviousBookmark = this.nextHashParam ? false : true;
            target && this._updatePreviousBookmark();
            return;
        }
        if (this.nextHashParam) {
            if (this.nextHashParam === params.hash) {
                this.nextHashParam = null;
                this.updatePreviousBookmark = true;
                return;
            }
            this.nextHashParam = null;
        }
        if (params.hash) if (this.current.hash) if (this.current.hash !== params.hash) this._pushToHistory(params, true); else {
            !this.current.page && params.page && this._pushToHistory(params, false, true);
            this.updatePreviousBookmark = true;
        } else this._pushToHistory(params, true); else this.current.page && params.page && this.current.page !== params.page && this._pushToHistory(params, true);
    },
    _getPreviousParams: function(onlyCheckPage, beforeUnload) {
        if (!this.currentBookmark || !this.currentPage) return null;
        this.updatePreviousBookmark && (this.updatePreviousBookmark = false);
        if (this.uid > 0 && !(this.previousBookmark && this.previousPage)) return null;
        if (!this.current.dest && !onlyCheckPage || beforeUnload) {
            if (this.previousBookmark === this.currentBookmark) return null;
        } else {
            if (!this.current.page && !onlyCheckPage) return null;
            if (this.previousPage === this.currentPage) return null;
        }
        var params = {
            hash: this.currentBookmark,
            page: this.currentPage
        };
        PresentationMode.active && (params.hash = null);
        return params;
    },
    _stateObj: function(params) {
        return {
            fingerprint: this.fingerprint,
            uid: this.uid,
            target: params
        };
    },
    _pushToHistory: function(params, addPrevious, overwrite) {
        if (!this.initialized) return;
        !params.hash && params.page && (params.hash = "page=" + params.page);
        if (addPrevious && !overwrite) {
            var previousParams = this._getPreviousParams();
            if (previousParams) {
                var replacePrevious = !this.current.dest && this.current.hash !== this.previousHash;
                this._pushToHistory(previousParams, false, replacePrevious);
            }
        }
        overwrite || 0 === this.uid ? window.history.replaceState(this._stateObj(params), "", document.URL) : window.history.pushState(this._stateObj(params), "", document.URL);
        this.currentUid = this.uid++;
        this.current = params;
        this.updatePreviousBookmark = true;
    },
    _goTo: function(state) {
        if (!(this.initialized && this.historyUnlocked && this._isStateObjectDefined(state))) return;
        if (!this.reInitialized && state.uid < this.currentUid) {
            var previousParams = this._getPreviousParams(true);
            if (previousParams) {
                this._pushToHistory(this.current, false);
                this._pushToHistory(previousParams, false);
                this.currentUid = state.uid;
                window.history.back();
                return;
            }
        }
        this.historyUnlocked = false;
        state.target.dest ? PDFView.navigateTo(state.target.dest) : PDFView.setHash(state.target.hash);
        this.currentUid = state.uid;
        state.uid > this.uid && (this.uid = state.uid);
        this.current = state.target;
        this.updatePreviousBookmark = true;
        var currentHash = window.location.hash.substring(1);
        this.previousHash !== currentHash && (this.allowHashChange = false);
        this.previousHash = currentHash;
        this.historyUnlocked = true;
    },
    back: function() {
        this.go(-1);
    },
    forward: function() {
        this.go(1);
    },
    go: function(direction) {
        if (this.initialized && this.historyUnlocked) {
            var state = window.history.state;
            -1 === direction && state && state.uid > 0 ? window.history.back() : 1 === direction && state && state.uid < this.uid - 1 && window.history.forward();
        }
    }
};

var SecondaryToolbar = {
    opened: false,
    previousContainerHeight: null,
    newContainerHeight: null,
    initialize: function(options) {
        this.toolbar = options.toolbar;
        this.toggleButton = options.toggleButton;
        this.buttonContainer = this.toolbar.firstElementChild;
        this.presentationMode = options.presentationMode;
        this.openFile = options.openFile;
        this.print = options.print;
        this.download = options.download;
        this.firstPage = options.firstPage;
        this.lastPage = options.lastPage;
        this.pageRotateCw = options.pageRotateCw;
        this.pageRotateCcw = options.pageRotateCcw;
        this.toggleButton.addEventListener("click", this.toggle.bind(this));
        this.presentationMode.addEventListener("click", this.presentationModeClick.bind(this));
        this.openFile.addEventListener("click", this.openFileClick.bind(this));
        this.print.addEventListener("click", this.printClick.bind(this));
        this.download.addEventListener("click", this.downloadClick.bind(this));
        this.firstPage.addEventListener("click", this.firstPageClick.bind(this));
        this.lastPage.addEventListener("click", this.lastPageClick.bind(this));
        this.pageRotateCw.addEventListener("click", this.pageRotateCwClick.bind(this));
        this.pageRotateCcw.addEventListener("click", this.pageRotateCcwClick.bind(this));
    },
    presentationModeClick: function() {
        PresentationMode.request();
        this.close();
    },
    openFileClick: function(evt) {
        document.getElementById("fileInput").click();
        this.close(evt.target);
    },
    printClick: function(evt) {
        window.print();
        this.close(evt.target);
    },
    downloadClick: function(evt) {
        PDFView.download();
        this.close(evt.target);
    },
    firstPageClick: function() {
        PDFView.page = 1;
    },
    lastPageClick: function() {
        PDFView.page = PDFView.pdfDocument.numPages;
    },
    pageRotateCwClick: function() {
        PDFView.rotatePages(90);
    },
    pageRotateCcwClick: function() {
        PDFView.rotatePages(-90);
    },
    setMaxHeight: function(container) {
        if (!container) return;
        this.newContainerHeight = container.clientHeight;
        if (this.previousContainerHeight === this.newContainerHeight) return;
        this.buttonContainer.setAttribute("style", "max-height: " + (this.newContainerHeight - SCROLLBAR_PADDING) + "px;");
        this.previousContainerHeight = this.newContainerHeight;
    },
    open: function() {
        if (this.opened) return;
        this.opened = true;
        this.toggleButton.classList.add("toggled");
        this.toolbar.classList.remove("hidden");
    },
    close: function(target) {
        if (!this.opened) return;
        if (target && !this.toolbar.contains(target)) return;
        this.opened = false;
        this.toolbar.classList.add("hidden");
        this.toggleButton.classList.remove("toggled");
    },
    toggle: function() {
        this.opened ? this.close() : this.open();
    },
    get isOpen() {
        return this.opened;
    }
};

var PasswordPrompt = {
    visible: false,
    updatePassword: null,
    reason: null,
    overlayContainer: null,
    passwordField: null,
    passwordText: null,
    passwordSubmit: null,
    passwordCancel: null,
    initialize: function(options) {
        this.overlayContainer = options.overlayContainer;
        this.passwordField = options.passwordField;
        this.passwordText = options.passwordText;
        this.passwordSubmit = options.passwordSubmit;
        this.passwordCancel = options.passwordCancel;
        this.passwordSubmit.addEventListener("click", this.verifyPassword.bind(this));
        this.passwordCancel.addEventListener("click", this.hide.bind(this));
        this.passwordField.addEventListener("keydown", function(e) {
            13 === e.keyCode && this.verifyPassword();
        }.bind(this));
        this.overlayContainer.addEventListener("keydown", function(e) {
            27 === e.keyCode && this.hide();
        }.bind(this));
    },
    show: function() {
        if (this.visible) return;
        this.visible = true;
        this.overlayContainer.classList.remove("hidden");
        this.passwordField.focus();
        var promptString = mozL10n.get("password_label", null, "Enter the password to open this PDF file.");
        this.reason === PDFJS.PasswordResponses.INCORRECT_PASSWORD && (promptString = mozL10n.get("password_invalid", null, "Invalid password. Please try again."));
        this.passwordText.textContent = promptString;
    },
    hide: function() {
        if (!this.visible) return;
        this.visible = false;
        this.passwordField.value = "";
        this.overlayContainer.classList.add("hidden");
    },
    verifyPassword: function() {
        var password = this.passwordField.value;
        if (password && password.length > 0) {
            this.hide();
            return this.updatePassword(password);
        }
    }
};

var DELAY_BEFORE_HIDING_CONTROLS = 3e3;

var SELECTOR = "presentationControls";

var PresentationMode = {
    active: false,
    args: null,
    contextMenuOpen: false,
    initialize: function(options) {
        this.container = options.container;
        this.secondaryToolbar = options.secondaryToolbar;
        this.firstPage = options.firstPage;
        this.lastPage = options.lastPage;
        this.pageRotateCw = options.pageRotateCw;
        this.pageRotateCcw = options.pageRotateCcw;
        this.firstPage.addEventListener("click", function() {
            this.contextMenuOpen = false;
            this.secondaryToolbar.firstPageClick();
        }.bind(this));
        this.lastPage.addEventListener("click", function() {
            this.contextMenuOpen = false;
            this.secondaryToolbar.lastPageClick();
        }.bind(this));
        this.pageRotateCw.addEventListener("click", function() {
            this.contextMenuOpen = false;
            this.secondaryToolbar.pageRotateCwClick();
        }.bind(this));
        this.pageRotateCcw.addEventListener("click", function() {
            this.contextMenuOpen = false;
            this.secondaryToolbar.pageRotateCcwClick();
        }.bind(this));
    },
    get isFullscreen() {
        return document.fullscreenElement || document.mozFullScreen || document.webkitIsFullScreen || document.msFullscreenElement;
    },
    request: function() {
        if (!PDFView.supportsFullscreen || this.isFullscreen) return false;
        if (this.container.requestFullscreen) this.container.requestFullscreen(); else if (this.container.mozRequestFullScreen) this.container.mozRequestFullScreen(); else if (this.container.webkitRequestFullScreen) this.container.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT); else {
            if (!this.container.msRequestFullscreen) return false;
            this.container.msRequestFullscreen();
        }
        this.args = {
            page: PDFView.page,
            previousScale: PDFView.currentScaleValue
        };
        return true;
    },
    enter: function() {
        this.active = true;
        PDFView.page = this.args.page;
        PDFView.parseScale("page-fit", true);
        window.addEventListener("mousemove", this.mouseMove, false);
        window.addEventListener("mousedown", this.mouseDown, false);
        window.addEventListener("contextmenu", this.contextMenu, false);
        this.showControls();
        this.contextMenuOpen = false;
        this.container.setAttribute("contextmenu", "viewerContextMenu");
    },
    exit: function() {
        this.active = false;
        var page = PDFView.page;
        PDFView.parseScale(this.args.previousScale);
        PDFView.page = page;
        window.removeEventListener("mousemove", this.mouseMove, false);
        window.removeEventListener("mousedown", this.mouseDown, false);
        window.removeEventListener("contextmenu", this.contextMenu, false);
        this.hideControls();
        this.args = null;
        PDFView.clearMouseScrollState();
        this.container.removeAttribute("contextmenu");
        this.contextMenuOpen = false;
        scrollIntoView(document.getElementById("thumbnailContainer" + page));
    },
    showControls: function() {
        this.controlsTimeout ? clearTimeout(this.controlsTimeout) : this.container.classList.add(SELECTOR);
        this.controlsTimeout = setTimeout(function() {
            this.container.classList.remove(SELECTOR);
            delete this.controlsTimeout;
        }.bind(this), DELAY_BEFORE_HIDING_CONTROLS);
    },
    hideControls: function() {
        if (!this.controlsTimeout) return;
        this.container.classList.remove(SELECTOR);
        clearTimeout(this.controlsTimeout);
        delete this.controlsTimeout;
    },
    mouseMove: function() {
        PresentationMode.showControls();
    },
    mouseDown: function(evt) {
        var self = PresentationMode;
        if (self.contextMenuOpen) {
            self.contextMenuOpen = false;
            evt.preventDefault();
            return;
        }
        if (0 === evt.button) {
            var isInternalLink = evt.target.href && evt.target.classList.contains("internalLink");
            if (!isInternalLink) {
                evt.preventDefault();
                PDFView.page += evt.shiftKey ? -1 : 1;
            }
        }
    },
    contextMenu: function() {
        PresentationMode.contextMenuOpen = true;
    }
};

(function() {
    function presentationModeChange() {
        PresentationMode.isFullscreen ? PresentationMode.enter() : PresentationMode.exit();
    }
    window.addEventListener("fullscreenchange", presentationModeChange, false);
    window.addEventListener("mozfullscreenchange", presentationModeChange, false);
    window.addEventListener("webkitfullscreenchange", presentationModeChange, false);
    window.addEventListener("MSFullscreenChange", presentationModeChange, false);
})();

var PDFView = {
    pages: [],
    thumbnails: [],
    currentScale: UNKNOWN_SCALE,
    currentScaleValue: null,
    initialBookmark: document.location.hash.substring(1),
    container: null,
    thumbnailContainer: null,
    initialized: false,
    fellback: false,
    pdfDocument: null,
    sidebarOpen: false,
    pageViewScroll: null,
    thumbnailViewScroll: null,
    pageRotation: 0,
    mouseScrollTimeStamp: 0,
    mouseScrollDelta: 0,
    lastScroll: 0,
    previousPageNumber: 1,
    isViewerEmbedded: window.parent !== window,
    initialize: function() {
        var self = this;
        var container = this.container = document.getElementById("viewerContainer");
        this.pageViewScroll = {};
        this.watchScroll(container, this.pageViewScroll, updateViewarea);
        var thumbnailContainer = this.thumbnailContainer = document.getElementById("thumbnailView");
        this.thumbnailViewScroll = {};
        this.watchScroll(thumbnailContainer, this.thumbnailViewScroll, this.renderHighestPriority.bind(this));
        PDFFindBar.initialize({
            bar: document.getElementById("findbar"),
            toggleButton: document.getElementById("viewFind"),
            findField: document.getElementById("findInput"),
            highlightAllCheckbox: document.getElementById("findHighlightAll"),
            caseSensitiveCheckbox: document.getElementById("findMatchCase"),
            findMsg: document.getElementById("findMsg"),
            findStatusIcon: document.getElementById("findStatusIcon"),
            findPreviousButton: document.getElementById("findPrevious"),
            findNextButton: document.getElementById("findNext")
        });
        PDFFindController.initialize({
            pdfPageSource: this,
            integratedFind: this.supportsIntegratedFind
        });
        SecondaryToolbar.initialize({
            toolbar: document.getElementById("secondaryToolbar"),
            toggleButton: document.getElementById("secondaryToolbarToggle"),
            presentationMode: document.getElementById("secondaryPresentationMode"),
            openFile: document.getElementById("secondaryOpenFile"),
            print: document.getElementById("secondaryPrint"),
            download: document.getElementById("secondaryDownload"),
            firstPage: document.getElementById("firstPage"),
            lastPage: document.getElementById("lastPage"),
            pageRotateCw: document.getElementById("pageRotateCw"),
            pageRotateCcw: document.getElementById("pageRotateCcw")
        });
        PasswordPrompt.initialize({
            overlayContainer: document.getElementById("overlayContainer"),
            passwordField: document.getElementById("password"),
            passwordText: document.getElementById("passwordText"),
            passwordSubmit: document.getElementById("passwordSubmit"),
            passwordCancel: document.getElementById("passwordCancel")
        });
        PresentationMode.initialize({
            container: container,
            secondaryToolbar: SecondaryToolbar,
            firstPage: document.getElementById("contextFirstPage"),
            lastPage: document.getElementById("contextLastPage"),
            pageRotateCw: document.getElementById("contextPageRotateCw"),
            pageRotateCcw: document.getElementById("contextPageRotateCcw")
        });
        this.initialized = true;
        container.addEventListener("scroll", function() {
            self.lastScroll = Date.now();
        }, false);
    },
    getPage: function(n) {
        return this.pdfDocument.getPage(n);
    },
    watchScroll: function(viewAreaElement, state, callback) {
        state.down = true;
        state.lastY = viewAreaElement.scrollTop;
        viewAreaElement.addEventListener("scroll", function() {
            var currentY = viewAreaElement.scrollTop;
            var lastY = state.lastY;
            currentY > lastY ? state.down = true : lastY > currentY && (state.down = false);
            state.lastY = currentY;
            callback();
        }, true);
    },
    setScale: function(val, resetAutoSettings, noScroll) {
        if (val == this.currentScale) return;
        var pages = this.pages;
        for (var i = 0; pages.length > i; i++) pages[i].update(val);
        noScroll || this.currentScale == val || this.pages[this.page - 1].scrollIntoView();
        this.currentScale = val;
        var event = document.createEvent("UIEvents");
        event.initUIEvent("scalechange", false, false, window, 0);
        event.scale = val;
        event.resetAutoSettings = resetAutoSettings;
        window.dispatchEvent(event);
    },
    parseScale: function(value, resetAutoSettings, noScroll) {
        if ("custom" == value) return;
        var scale = parseFloat(value);
        this.currentScaleValue = value;
        if (scale) {
            this.setScale(scale, true, noScroll);
            return;
        }
        var container = this.container;
        var currentPage = this.pages[this.page - 1];
        if (!currentPage) return;
        var pageWidthScale = (container.clientWidth - SCROLLBAR_PADDING) / currentPage.width * currentPage.scale;
        var pageHeightScale = (container.clientHeight - VERTICAL_PADDING) / currentPage.height * currentPage.scale;
        switch (value) {
          case "page-actual":
            scale = 1;
            break;

          case "page-width":
            scale = pageWidthScale;
            break;

          case "page-height":
            scale = pageHeightScale;
            break;

          case "page-fit":
            scale = Math.min(pageWidthScale, pageHeightScale);
            break;

          case "auto":
            scale = Math.min(1, pageWidthScale);
        }
        this.setScale(scale, resetAutoSettings, noScroll);
        selectScaleOption(value);
    },
    zoomIn: function(ticks) {
        var newScale = this.currentScale;
        do {
            newScale = (newScale * DEFAULT_SCALE_DELTA).toFixed(2);
            newScale = Math.ceil(10 * newScale) / 10;
            newScale = Math.min(MAX_SCALE, newScale);
        } while (--ticks && MAX_SCALE > newScale);
        this.parseScale(newScale, true);
    },
    zoomOut: function(ticks) {
        var newScale = this.currentScale;
        do {
            newScale = (newScale / DEFAULT_SCALE_DELTA).toFixed(2);
            newScale = Math.floor(10 * newScale) / 10;
            newScale = Math.max(MIN_SCALE, newScale);
        } while (--ticks && newScale > MIN_SCALE);
        this.parseScale(newScale, true);
    },
    set page(val) {
        var pages = this.pages;
        document.getElementById("pageNumber");
        var event = document.createEvent("UIEvents");
        event.initUIEvent("pagechange", false, false, window, 0);
        if (!(val > 0 && pages.length >= val)) {
            this.previousPageNumber = val;
            event.pageNumber = this.page;
            window.dispatchEvent(event);
            return;
        }
        pages[val - 1].updateStats();
        this.previousPageNumber = currentPageNumber;
        currentPageNumber = val;
        event.pageNumber = val;
        window.dispatchEvent(event);
        if (updateViewarea.inProgress) return;
        if (this.loading && 1 == val) return;
        pages[val - 1].scrollIntoView();
    },
    get page() {
        return currentPageNumber;
    },
    get supportsPrinting() {
        var canvas = document.createElement("canvas");
        var value = "mozPrintCallback" in canvas;
        Object.defineProperty(this, "supportsPrinting", {
            value: value,
            enumerable: true,
            configurable: true,
            writable: false
        });
        return value;
    },
    get supportsFullscreen() {
        var doc = document.documentElement;
        var support = doc.requestFullscreen || doc.mozRequestFullScreen || doc.webkitRequestFullScreen || doc.msRequestFullscreen;
        false === document.fullscreenEnabled || false === document.mozFullScreenEnabled || false === document.webkitFullscreenEnabled || false === document.msFullscreenEnabled ? support = false : this.isViewerEmbedded && (support = false);
        Object.defineProperty(this, "supportsFullscreen", {
            value: support,
            enumerable: true,
            configurable: true,
            writable: false
        });
        return support;
    },
    get supportsIntegratedFind() {
        var support = false;
        Object.defineProperty(this, "supportsIntegratedFind", {
            value: support,
            enumerable: true,
            configurable: true,
            writable: false
        });
        return support;
    },
    get supportsDocumentFonts() {
        var support = true;
        Object.defineProperty(this, "supportsDocumentFonts", {
            value: support,
            enumerable: true,
            configurable: true,
            writable: false
        });
        return support;
    },
    get supportsDocumentColors() {
        var support = true;
        Object.defineProperty(this, "supportsDocumentColors", {
            value: support,
            enumerable: true,
            configurable: true,
            writable: false
        });
        return support;
    },
    get loadingBar() {
        var bar = new ProgressBar("#loadingBar", {});
        Object.defineProperty(this, "loadingBar", {
            value: bar,
            enumerable: true,
            configurable: true,
            writable: false
        });
        return bar;
    },
    get isHorizontalScrollbarEnabled() {
        var div = document.getElementById("viewerContainer");
        return div.scrollWidth > div.clientWidth;
    },
    initPassiveLoading: function() {
        var pdfDataRangeTransport = {
            rangeListeners: [],
            progressListeners: [],
            addRangeListener: function(listener) {
                this.rangeListeners.push(listener);
            },
            addProgressListener: function(listener) {
                this.progressListeners.push(listener);
            },
            onDataRange: function(begin, chunk) {
                var listeners = this.rangeListeners;
                for (var i = 0, n = listeners.length; n > i; ++i) listeners[i](begin, chunk);
            },
            onDataProgress: function(loaded) {
                var listeners = this.progressListeners;
                for (var i = 0, n = listeners.length; n > i; ++i) listeners[i](loaded);
            },
            requestDataRange: function(begin, end) {
                FirefoxCom.request("requestDataRange", {
                    begin: begin,
                    end: end
                });
            }
        };
        window.addEventListener("message", function(e) {
            var args = e.data;
            if ("object" != typeof args || !("pdfjsLoadAction" in args)) return;
            switch (args.pdfjsLoadAction) {
              case "supportsRangedLoading":
                PDFView.open(args.pdfUrl, 0, void 0, pdfDataRangeTransport, {
                    length: args.length
                });
                break;

              case "range":
                pdfDataRangeTransport.onDataRange(args.begin, args.chunk);
                break;

              case "rangeProgress":
                pdfDataRangeTransport.onDataProgress(args.loaded);
                break;

              case "progress":
                PDFView.progress(args.loaded / args.total);
                break;

              case "complete":
                if (!args.data) {
                    PDFView.error(mozL10n.get("loading_error", null, "An error occurred while loading the PDF."), e);
                    break;
                }
                PDFView.open(args.data, 0);
            }
        });
        FirefoxCom.requestSync("initPassiveLoading", null);
    },
    setTitleUsingUrl: function(url) {
        this.url = url;
        try {
            this.setTitle(decodeURIComponent(getFileName(url)) || url);
        } catch (e) {
            this.setTitle(url);
        }
    },
    setTitle: function(title) {
        document.title = title;
    },
    open: function(url, scale, password, pdfDataRangeTransport, args) {
        function getDocumentProgress(progressData) {
            self.progress(progressData.loaded / progressData.total);
        }
        var parameters = {
            password: password
        };
        if ("string" == typeof url) {
            this.setTitleUsingUrl(url);
            parameters.url = url;
        } else url && "byteLength" in url && (parameters.data = url);
        if (args) for (var prop in args) parameters[prop] = args[prop];
        this.pdfDocument = null;
        var self = this;
        self.loading = true;
        var passwordNeeded = function passwordNeeded(updatePassword, reason) {
            PasswordPrompt.updatePassword = updatePassword;
            PasswordPrompt.reason = reason;
            PasswordPrompt.show();
        };
        PDFJS.getDocument(parameters, pdfDataRangeTransport, passwordNeeded, getDocumentProgress).then(function(pdfDocument) {
            self.load(pdfDocument, scale);
            self.loading = false;
        }, function(message, exception) {
            var loadingErrorMessage = mozL10n.get("loading_error", null, "An error occurred while loading the PDF.");
            if (exception && "InvalidPDFException" === exception.name) var loadingErrorMessage = mozL10n.get("invalid_file_error", null, "Invalid or corrupted PDF file.");
            if (exception && "MissingPDFException" === exception.name) var loadingErrorMessage = mozL10n.get("missing_file_error", null, "Missing PDF file.");
            var moreInfo = {
                message: message
            };
            self.error(loadingErrorMessage, moreInfo);
            self.loading = false;
        });
    },
    download: function() {
        function noData() {
            downloadManager.downloadUrl(url, filename);
        }
        var url = this.url.split("#")[0];
        var filename = getPDFFileNameFromURL(url);
        var downloadManager = new DownloadManager();
        downloadManager.onerror = function() {
            PDFView.error("PDF failed to download.");
        };
        if (!this.pdfDocument) {
            noData();
            return;
        }
        this.pdfDocument.getData().then(function(data) {
            var blob = PDFJS.createBlob(data, "application/pdf");
            downloadManager.download(blob, url, filename);
        }, noData).then(null, noData);
    },
    fallback: function() {
        return;
    },
    navigateTo: function(dest) {
        var destString = "";
        var self = this;
        var goToDestination = function(destRef) {
            self.pendingRefStr = null;
            var pageNumber = destRef instanceof Object ? self.pagesRefMap[destRef.num + " " + destRef.gen + " R"] : destRef + 1;
            if (pageNumber) {
                pageNumber > self.pages.length && (pageNumber = self.pages.length);
                var currentPage = self.pages[pageNumber - 1];
                currentPage.scrollIntoView(dest);
                PDFHistory.push({
                    dest: dest,
                    hash: destString,
                    page: pageNumber
                });
            } else {
                self.pendingRefStrLoaded = new PDFJS.Promise();
                self.pendingRefStr = destRef.num + " " + destRef.gen + " R";
                self.pendingRefStrLoaded.then(function() {
                    goToDestination(destRef);
                });
            }
        };
        this.destinationsPromise.then(function() {
            if ("string" == typeof dest) {
                destString = dest;
                dest = self.destinations[dest];
            }
            if (!(dest instanceof Array)) return;
            goToDestination(dest[0]);
        });
    },
    getDestinationHash: function(dest) {
        if ("string" == typeof dest) return PDFView.getAnchorUrl("#" + escape(dest));
        if (dest instanceof Array) {
            var destRef = dest[0];
            var pageNumber = destRef instanceof Object ? this.pagesRefMap[destRef.num + " " + destRef.gen + " R"] : destRef + 1;
            if (pageNumber) {
                var pdfOpenParams = PDFView.getAnchorUrl("#page=" + pageNumber);
                var destKind = dest[1];
                if ("object" == typeof destKind && "name" in destKind && "XYZ" == destKind.name) {
                    var scale = dest[4] || this.currentScaleValue;
                    var scaleNumber = parseFloat(scale);
                    scaleNumber && (scale = 100 * scaleNumber);
                    pdfOpenParams += "&zoom=" + scale;
                    (dest[2] || dest[3]) && (pdfOpenParams += "," + (dest[2] || 0) + "," + (dest[3] || 0));
                }
                return pdfOpenParams;
            }
        }
        return "";
    },
    getAnchorUrl: function(anchor) {
        return anchor;
    },
    error: function(message, moreInfo) {
        var moreInfoText = mozL10n.get("error_version_info", {
            version: PDFJS.version || "?",
            build: PDFJS.build || "?"
        }, "PDF.js v{{version}} (build: {{build}})") + "\n";
        if (moreInfo) {
            moreInfoText += mozL10n.get("error_message", {
                message: moreInfo.message
            }, "Message: {{message}}");
            if (moreInfo.stack) moreInfoText += "\n" + mozL10n.get("error_stack", {
                stack: moreInfo.stack
            }, "Stack: {{stack}}"); else {
                moreInfo.filename && (moreInfoText += "\n" + mozL10n.get("error_file", {
                    file: moreInfo.filename
                }, "File: {{file}}"));
                moreInfo.lineNumber && (moreInfoText += "\n" + mozL10n.get("error_line", {
                    line: moreInfo.lineNumber
                }, "Line: {{line}}"));
            }
        }
        var errorWrapper = document.getElementById("errorWrapper");
        errorWrapper.removeAttribute("hidden");
        var errorMessage = document.getElementById("errorMessage");
        errorMessage.textContent = message;
        var closeButton = document.getElementById("errorClose");
        closeButton.onclick = function() {
            errorWrapper.setAttribute("hidden", "true");
        };
        var errorMoreInfo = document.getElementById("errorMoreInfo");
        var moreInfoButton = document.getElementById("errorShowMore");
        var lessInfoButton = document.getElementById("errorShowLess");
        moreInfoButton.onclick = function() {
            errorMoreInfo.removeAttribute("hidden");
            moreInfoButton.setAttribute("hidden", "true");
            lessInfoButton.removeAttribute("hidden");
            errorMoreInfo.style.height = errorMoreInfo.scrollHeight + "px";
        };
        lessInfoButton.onclick = function() {
            errorMoreInfo.setAttribute("hidden", "true");
            moreInfoButton.removeAttribute("hidden");
            lessInfoButton.setAttribute("hidden", "true");
        };
        moreInfoButton.oncontextmenu = noContextMenuHandler;
        lessInfoButton.oncontextmenu = noContextMenuHandler;
        closeButton.oncontextmenu = noContextMenuHandler;
        moreInfoButton.removeAttribute("hidden");
        lessInfoButton.setAttribute("hidden", "true");
        errorMoreInfo.value = moreInfoText;
    },
    progress: function(level) {
        var percent = Math.round(100 * level);
        percent > PDFView.loadingBar.percent && (PDFView.loadingBar.percent = percent);
    },
    load: function(pdfDocument, scale) {
        function bindOnAfterDraw(pageView, thumbnailView) {
            pageView.onAfterDraw = function() {
                thumbnailView.setImage(pageView.canvas);
            };
        }
        PDFFindController.reset();
        this.pdfDocument = pdfDocument;
        var errorWrapper = document.getElementById("errorWrapper");
        errorWrapper.setAttribute("hidden", "true");
        pdfDocument.dataLoaded().then(function() {
            PDFView.loadingBar.hide();
            var outerContainer = document.getElementById("outerContainer");
            outerContainer.classList.remove("loadingInProgress");
        });
        var thumbsView = document.getElementById("thumbnailView");
        thumbsView.parentNode.scrollTop = 0;
        while (thumbsView.hasChildNodes()) thumbsView.removeChild(thumbsView.lastChild);
        "_loadingInterval" in thumbsView && clearInterval(thumbsView._loadingInterval);
        var container = document.getElementById("viewer");
        while (container.hasChildNodes()) container.removeChild(container.lastChild);
        var pagesCount = pdfDocument.numPages;
        var id = pdfDocument.fingerprint;
        document.getElementById("numPages").textContent = mozL10n.get("page_of", {
            pageCount: pagesCount
        }, "of {{pageCount}}");
        document.getElementById("pageNumber").max = pagesCount;
        PDFView.documentFingerprint = id;
        var store = PDFView.store = new Settings(id);
        this.pageRotation = 0;
        var pages = this.pages = [];
        var pagesRefMap = this.pagesRefMap = {};
        var thumbnails = this.thumbnails = [];
        var pagesPromise = this.pagesPromise = new PDFJS.Promise();
        var self = this;
        var firstPagePromise = pdfDocument.getPage(1);
        firstPagePromise.then(function(pdfPage) {
            var viewport = pdfPage.getViewport((scale || 1) * CSS_UNITS);
            var pagePromises = [];
            for (var pageNum = 1; pagesCount >= pageNum; ++pageNum) {
                var viewportClone = viewport.clone();
                var pageView = new PageView(container, pageNum, scale, self.navigateTo.bind(self), viewportClone);
                var thumbnailView = new ThumbnailView(thumbsView, pageNum, viewportClone);
                bindOnAfterDraw(pageView, thumbnailView);
                pages.push(pageView);
                thumbnails.push(thumbnailView);
            }
            var event = document.createEvent("CustomEvent");
            event.initCustomEvent("documentload", true, true, {});
            window.dispatchEvent(event);
            PDFView.loadingBar.setWidth(container);
            for (var pageNum = 1; pagesCount >= pageNum; ++pageNum) {
                var pagePromise = pdfDocument.getPage(pageNum);
                pagePromise.then(function(pdfPage) {
                    var pageNum = pdfPage.pageNumber;
                    var pageView = pages[pageNum - 1];
                    pageView.pdfPage || pageView.setPdfPage(pdfPage);
                    var thumbnailView = thumbnails[pageNum - 1];
                    thumbnailView.pdfPage || thumbnailView.setPdfPage(pdfPage);
                    var pageRef = pdfPage.ref;
                    var refStr = pageRef.num + " " + pageRef.gen + " R";
                    pagesRefMap[refStr] = pdfPage.pageNumber;
                    self.pendingRefStr && self.pendingRefStr === refStr && self.pendingRefStrLoaded.resolve();
                });
                pagePromises.push(pagePromise);
            }
            PDFFindController.firstPagePromise.resolve();
            PDFJS.Promise.all(pagePromises).then(function(pages) {
                pagesPromise.resolve(pages);
            });
        });
        var storePromise = store.initializedPromise;
        PDFJS.Promise.all([ firstPagePromise, storePromise ]).then(function() {
            var storedHash = null;
            if (store.get("exists", false)) {
                var pageNum = store.get("page", "1");
                var zoom = store.get("zoom", PDFView.currentScale);
                var left = store.get("scrollLeft", "0");
                var top = store.get("scrollTop", "0");
                storedHash = "page=" + pageNum + "&zoom=" + zoom + "," + left + "," + top;
            }
            PDFHistory.initialize(self.documentFingerprint);
            self.setInitialView(storedHash, scale);
            self.isViewerEmbedded || self.container.focus();
        });
        pagesPromise.then(function() {
            PDFView.supportsPrinting && pdfDocument.getJavaScript().then(function(javaScript) {
                if (javaScript.length) {
                    console.warn("Warning: JavaScript is not supported");
                    PDFView.fallback();
                }
                var regex = /\bprint\s*\(/g;
                for (var i = 0, ii = javaScript.length; ii > i; i++) {
                    var js = javaScript[i];
                    if (js && regex.test(js)) {
                        setTimeout(function() {
                            window.print();
                        });
                        return;
                    }
                }
            });
        });
        var destinationsPromise = this.destinationsPromise = pdfDocument.getDestinations();
        destinationsPromise.then(function(destinations) {
            self.destinations = destinations;
        });
        var promises = [ pagesPromise, destinationsPromise, PDFView.animationStartedPromise ];
        PDFJS.Promise.all(promises).then(function() {
            pdfDocument.getOutline().then(function(outline) {
                self.outline = new DocumentOutlineView(outline);
                document.getElementById("viewOutline").disabled = !outline;
            });
        });
        pdfDocument.getMetadata().then(function(data) {
            var info = data.info, metadata = data.metadata;
            self.documentInfo = info;
            self.metadata = metadata;
            console.log("PDF " + pdfDocument.fingerprint + " [" + info.PDFFormatVersion + " " + (info.Producer || "-") + " / " + (info.Creator || "-") + "]" + (PDFJS.version ? " (PDF.js: " + PDFJS.version + ")" : ""));
            var pdfTitle;
            metadata && metadata.has("dc:title") && (pdfTitle = metadata.get("dc:title"));
            !pdfTitle && info && info["Title"] && (pdfTitle = info["Title"]);
            pdfTitle && self.setTitle(pdfTitle + " - " + document.title);
            if (info.IsAcroFormPresent) {
                console.warn("Warning: AcroForm/XFA is not supported");
                PDFView.fallback();
            }
        });
    },
    setInitialView: function(storedHash, scale) {
        this.currentScale = 0;
        this.currentScaleValue = null;
        document.getElementById("pageNumber").value = currentPageNumber = 1;
        if (PDFHistory.initialDestination) {
            this.navigateTo(PDFHistory.initialDestination);
            PDFHistory.initialDestination = null;
        } else if (this.initialBookmark) {
            this.setHash(this.initialBookmark);
            PDFHistory.push({
                hash: this.initialBookmark
            }, !!this.initialBookmark);
            this.initialBookmark = null;
        } else if (storedHash) this.setHash(storedHash); else if (scale) {
            this.parseScale(scale, true);
            this.page = 1;
        }
        PDFView.currentScale === UNKNOWN_SCALE && this.parseScale(DEFAULT_SCALE, true);
    },
    renderHighestPriority: function() {
        var visiblePages = this.getVisiblePages();
        var pageView = this.getHighestPriority(visiblePages, this.pages, this.pageViewScroll.down);
        if (pageView) {
            this.renderView(pageView, "page");
            return;
        }
        if (this.sidebarOpen) {
            var visibleThumbs = this.getVisibleThumbs();
            var thumbView = this.getHighestPriority(visibleThumbs, this.thumbnails, this.thumbnailViewScroll.down);
            thumbView && this.renderView(thumbView, "thumbnail");
        }
    },
    getHighestPriority: function(visible, views, scrolledDown) {
        var visibleViews = visible.views;
        var numVisible = visibleViews.length;
        if (0 === numVisible) return false;
        for (var i = 0; numVisible > i; ++i) {
            var view = visibleViews[i].view;
            if (!this.isViewFinished(view)) return view;
        }
        if (scrolledDown) {
            var nextPageIndex = visible.last.id;
            if (views[nextPageIndex] && !this.isViewFinished(views[nextPageIndex])) return views[nextPageIndex];
        } else {
            var previousPageIndex = visible.first.id - 2;
            if (views[previousPageIndex] && !this.isViewFinished(views[previousPageIndex])) return views[previousPageIndex];
        }
        return false;
    },
    isViewFinished: function(view) {
        return view.renderingState === RenderingStates.FINISHED;
    },
    renderView: function(view, type) {
        var state = view.renderingState;
        switch (state) {
          case RenderingStates.FINISHED:
            return false;

          case RenderingStates.PAUSED:
            PDFView.highestPriorityPage = type + view.id;
            view.resume();
            break;

          case RenderingStates.RUNNING:
            PDFView.highestPriorityPage = type + view.id;
            break;

          case RenderingStates.INITIAL:
            PDFView.highestPriorityPage = type + view.id;
            view.draw(this.renderHighestPriority.bind(this));
        }
        return true;
    },
    setHash: function(hash) {
        if (!hash) return;
        if (hash.indexOf("=") >= 0) {
            var params = PDFView.parseQueryString(hash);
            if ("nameddest" in params) {
                PDFHistory.updateNextHashParam(params.nameddest);
                PDFView.navigateTo(params.nameddest);
                return;
            }
            if ("page" in params) {
                var pageNumber = 0 | params.page || 1;
                if ("zoom" in params) {
                    var zoomArgs = params.zoom.split(",");
                    var zoomArg = zoomArgs[0];
                    var zoomArgNumber = parseFloat(zoomArg);
                    zoomArgNumber && (zoomArg = zoomArgNumber / 100);
                    var dest = [ null, {
                        name: "XYZ"
                    }, zoomArgs.length > 1 ? 0 | zoomArgs[1] : null, zoomArgs.length > 2 ? 0 | zoomArgs[2] : null, zoomArg ];
                    var currentPage = this.pages[pageNumber - 1];
                    currentPage.scrollIntoView(dest);
                } else this.page = pageNumber;
            }
            if ("pagemode" in params) {
                var toggle = document.getElementById("sidebarToggle");
                if ("thumbs" === params.pagemode || "bookmarks" === params.pagemode) {
                    this.sidebarOpen || toggle.click();
                    this.switchSidebarView("thumbs" === params.pagemode ? "thumbs" : "outline");
                } else "none" === params.pagemode && this.sidebarOpen && toggle.click();
            }
        } else if (/^\d+$/.test(hash)) this.page = hash; else {
            PDFHistory.updateNextHashParam(unescape(hash));
            PDFView.navigateTo(unescape(hash));
        }
    },
    switchSidebarView: function(view) {
        var thumbsView = document.getElementById("thumbnailView");
        var outlineView = document.getElementById("outlineView");
        var thumbsButton = document.getElementById("viewThumbnail");
        var outlineButton = document.getElementById("viewOutline");
        switch (view) {
          case "thumbs":
            var wasOutlineViewVisible = thumbsView.classList.contains("hidden");
            thumbsButton.classList.add("toggled");
            outlineButton.classList.remove("toggled");
            thumbsView.classList.remove("hidden");
            outlineView.classList.add("hidden");
            PDFView.renderHighestPriority();
            wasOutlineViewVisible && scrollIntoView(document.getElementById("thumbnailContainer" + this.page));
            break;

          case "outline":
            thumbsButton.classList.remove("toggled");
            outlineButton.classList.add("toggled");
            thumbsView.classList.add("hidden");
            outlineView.classList.remove("hidden");
            if (outlineButton.getAttribute("disabled")) return;
        }
    },
    getVisiblePages: function() {
        return this.getVisibleElements(this.container, this.pages, !PresentationMode.active);
    },
    getVisibleThumbs: function() {
        return this.getVisibleElements(this.thumbnailContainer, this.thumbnails);
    },
    getVisibleElements: function(scrollEl, views, sortByVisibility) {
        var top = scrollEl.scrollTop, bottom = top + scrollEl.clientHeight;
        var left = scrollEl.scrollLeft, right = left + scrollEl.clientWidth;
        var view, visible = [];
        var currentHeight, viewHeight, hiddenHeight, percentHeight;
        var currentWidth, viewWidth;
        for (var i = 0, ii = views.length; ii > i; ++i) {
            view = views[i];
            currentHeight = view.el.offsetTop + view.el.clientTop;
            viewHeight = view.el.clientHeight;
            if (top > currentHeight + viewHeight) continue;
            if (currentHeight > bottom) break;
            currentWidth = view.el.offsetLeft + view.el.clientLeft;
            viewWidth = view.el.clientWidth;
            if (left > currentWidth + viewWidth || currentWidth > right) continue;
            hiddenHeight = Math.max(0, top - currentHeight) + Math.max(0, currentHeight + viewHeight - bottom);
            percentHeight = 0 | 100 * (viewHeight - hiddenHeight) / viewHeight;
            visible.push({
                id: view.id,
                y: currentHeight,
                view: view,
                percent: percentHeight
            });
        }
        var first = visible[0];
        var last = visible[visible.length - 1];
        sortByVisibility && visible.sort(function(a, b) {
            var pc = a.percent - b.percent;
            if (Math.abs(pc) > .001) return -pc;
            return a.id - b.id;
        });
        return {
            first: first,
            last: last,
            views: visible
        };
    },
    parseQueryString: function(query) {
        var parts = query.split("&");
        var params = {};
        var i = 0;
        for (parts.length; parts.length > i; ++i) {
            var param = parts[i].split("=");
            var key = param[0];
            var value = param.length > 1 ? param[1] : null;
            params[decodeURIComponent(key)] = decodeURIComponent(value);
        }
        return params;
    },
    beforePrint: function() {
        if (!this.supportsPrinting) {
            var printMessage = mozL10n.get("printing_not_supported", null, "Warning: Printing is not fully supported by this browser.");
            this.error(printMessage);
            return;
        }
        var alertNotReady = false;
        if (this.pages.length) {
            for (var i = 0, ii = this.pages.length; ii > i; ++i) if (!this.pages[i].pdfPage) {
                alertNotReady = true;
                break;
            }
        } else alertNotReady = true;
        if (alertNotReady) {
            var notReadyMessage = mozL10n.get("printing_not_ready", null, "Warning: The PDF is not fully loaded for printing.");
            window.alert(notReadyMessage);
            return;
        }
        var body = document.querySelector("body");
        body.setAttribute("data-mozPrintCallback", true);
        for (var i = 0, ii = this.pages.length; ii > i; ++i) this.pages[i].beforePrint();
    },
    afterPrint: function() {
        var div = document.getElementById("printContainer");
        while (div.hasChildNodes()) div.removeChild(div.lastChild);
    },
    rotatePages: function(delta) {
        this.pageRotation = (this.pageRotation + 360 + delta) % 360;
        for (var i = 0, l = this.pages.length; l > i; i++) {
            var page = this.pages[i];
            page.update(page.scale, this.pageRotation);
        }
        for (var i = 0, l = this.thumbnails.length; l > i; i++) {
            var thumb = this.thumbnails[i];
            thumb.update(this.pageRotation);
        }
        this.parseScale(this.currentScaleValue, true);
        this.renderHighestPriority();
        var currentPage = this.pages[this.page - 1];
        if (!currentPage) return;
        setTimeout(function() {
            currentPage.scrollIntoView();
        }, 0);
    },
    mouseScroll: function(mouseScrollDelta) {
        var MOUSE_SCROLL_COOLDOWN_TIME = 50;
        var currentTime = new Date().getTime();
        var storedTime = this.mouseScrollTimeStamp;
        if (currentTime > storedTime && MOUSE_SCROLL_COOLDOWN_TIME > currentTime - storedTime) return;
        (this.mouseScrollDelta > 0 && 0 > mouseScrollDelta || 0 > this.mouseScrollDelta && mouseScrollDelta > 0) && this.clearMouseScrollState();
        this.mouseScrollDelta += mouseScrollDelta;
        var PAGE_FLIP_THRESHOLD = 120;
        if (Math.abs(this.mouseScrollDelta) >= PAGE_FLIP_THRESHOLD) {
            var PageFlipDirection = {
                UP: -1,
                DOWN: 1
            };
            var pageFlipDirection = this.mouseScrollDelta > 0 ? PageFlipDirection.UP : PageFlipDirection.DOWN;
            this.clearMouseScrollState();
            var currentPage = this.page;
            if (1 == currentPage && pageFlipDirection == PageFlipDirection.UP || currentPage == this.pages.length && pageFlipDirection == PageFlipDirection.DOWN) return;
            this.page += pageFlipDirection;
            this.mouseScrollTimeStamp = currentTime;
        }
    },
    clearMouseScrollState: function() {
        this.mouseScrollTimeStamp = 0;
        this.mouseScrollDelta = 0;
    }
};

var PageView = function(container, id, scale, navigateTo, defaultViewport) {
    function setupAnnotations(pageDiv, pdfPage, viewport) {
        function bindLink(link, dest) {
            link.href = PDFView.getDestinationHash(dest);
            link.onclick = function() {
                dest && PDFView.navigateTo(dest);
                return false;
            };
            dest && (link.className = "internalLink");
        }
        function bindNamedAction(link, action) {
            link.href = PDFView.getAnchorUrl("");
            link.onclick = function() {
                switch (action) {
                  case "GoToPage":
                    document.getElementById("pageNumber").focus();
                    break;

                  case "GoBack":
                    PDFHistory.back();
                    break;

                  case "GoForward":
                    PDFHistory.forward();
                    break;

                  case "Find":
                    PDFView.supportsIntegratedFind || PDFFindBar.toggle();
                    break;

                  case "NextPage":
                    PDFView.page++;
                    break;

                  case "PrevPage":
                    PDFView.page--;
                    break;

                  case "LastPage":
                    PDFView.page = PDFView.pages.length;
                    break;

                  case "FirstPage":
                    PDFView.page = 1;
                    break;

                  default:                }
                return false;
            };
            link.className = "internalLink";
        }
        pdfPage.getAnnotations().then(function(annotationsData) {
            if (self.annotationLayer) {
                pageDiv.removeChild(self.annotationLayer);
                self.annotationLayer = null;
            }
            viewport = viewport.clone({
                dontFlip: true
            });
            for (var i = 0; annotationsData.length > i; i++) {
                var data = annotationsData[i];
                var annotation = PDFJS.Annotation.fromData(data);
                if (!annotation || !annotation.hasHtml()) continue;
                var element = annotation.getHtmlElement(pdfPage.commonObjs);
                mozL10n.translate(element);
                data = annotation.getData();
                var rect = data.rect;
                var view = pdfPage.view;
                rect = PDFJS.Util.normalizeRect([ rect[0], view[3] - rect[1] + view[1], rect[2], view[3] - rect[3] + view[1] ]);
                element.style.left = rect[0] + "px";
                element.style.top = rect[1] + "px";
                element.style.position = "absolute";
                var transform = viewport.transform;
                var transformStr = "matrix(" + transform.join(",") + ")";
                CustomStyle.setProp("transform", element, transformStr);
                var transformOriginStr = -rect[0] + "px " + -rect[1] + "px";
                CustomStyle.setProp("transformOrigin", element, transformOriginStr);
                "Link" !== data.subtype || data.url || (data.action ? bindNamedAction(element, data.action) : bindLink(element, "dest" in data ? data.dest : null));
                if (!self.annotationLayer) {
                    var annotationLayerDiv = document.createElement("div");
                    annotationLayerDiv.className = "annotationLayer";
                    pageDiv.appendChild(annotationLayerDiv);
                    self.annotationLayer = annotationLayerDiv;
                }
                self.annotationLayer.appendChild(element);
            }
        });
    }
    this.id = id;
    this.rotation = 0;
    this.scale = scale || 1;
    this.viewport = defaultViewport;
    this.pdfPageRotate = defaultViewport.rotate;
    this.renderingState = RenderingStates.INITIAL;
    this.resume = null;
    this.textContent = null;
    this.textLayer = null;
    this.zoomLayer = null;
    this.annotationLayer = null;
    var anchor = document.createElement("a");
    anchor.name = "" + this.id;
    var div = this.el = document.createElement("div");
    div.id = "pageContainer" + this.id;
    div.className = "page";
    div.style.width = Math.floor(this.viewport.width) + "px";
    div.style.height = Math.floor(this.viewport.height) + "px";
    container.appendChild(anchor);
    container.appendChild(div);
    this.setPdfPage = function(pdfPage) {
        this.pdfPage = pdfPage;
        this.pdfPageRotate = pdfPage.rotate;
        this.viewport = pdfPage.getViewport(this.scale * CSS_UNITS);
        this.stats = pdfPage.stats;
        this.reset();
    };
    this.destroy = function() {
        this.zoomLayer = null;
        this.reset();
        this.pdfPage && this.pdfPage.destroy();
    };
    this.reset = function() {
        this.renderTask && this.renderTask.cancel();
        this.resume = null;
        this.renderingState = RenderingStates.INITIAL;
        div.style.width = Math.floor(this.viewport.width) + "px";
        div.style.height = Math.floor(this.viewport.height) + "px";
        var childNodes = div.childNodes;
        for (var i = div.childNodes.length - 1; i >= 0; i--) {
            var node = childNodes[i];
            if (this.zoomLayer && this.zoomLayer === node) continue;
            div.removeChild(node);
        }
        div.removeAttribute("data-loaded");
        this.annotationLayer = null;
        delete this.canvas;
        this.loadingIconDiv = document.createElement("div");
        this.loadingIconDiv.className = "loadingIcon";
        div.appendChild(this.loadingIconDiv);
    };
    this.update = function(scale, rotation) {
        this.scale = scale || this.scale;
        "undefined" != typeof rotation && (this.rotation = rotation);
        var totalRotation = (this.rotation + this.pdfPageRotate) % 360;
        this.viewport = this.viewport.clone({
            scale: this.scale * CSS_UNITS,
            rotation: totalRotation
        });
        if (USE_ONLY_CSS_ZOOM && this.canvas) {
            this.cssZoom(this.canvas);
            return;
        }
        if (this.canvas && !this.zoomLayer) {
            this.zoomLayer = this.canvas.parentNode;
            this.zoomLayer.style.position = "absolute";
        }
        this.zoomLayer && this.cssZoom(this.zoomLayer.firstChild);
        this.reset();
    };
    this.cssZoom = function(canvas) {
        canvas.style.width = canvas.parentNode.style.width = div.style.width = Math.floor(this.viewport.width) + "px";
        canvas.style.height = canvas.parentNode.style.height = div.style.height = Math.floor(this.viewport.height) + "px";
        if (this.textLayer) {
            var scale = this.viewport.width / canvas.width;
            var cssScale = "scale(" + scale + ", " + scale + ")";
            var textLayerDiv = this.textLayer.textLayerDiv;
            CustomStyle.setProp("transform", textLayerDiv, cssScale);
            CustomStyle.setProp("transformOrigin", textLayerDiv, "0% 0%");
        }
    };
    Object.defineProperty(this, "width", {
        get: function() {
            return this.viewport.width;
        },
        enumerable: true
    });
    Object.defineProperty(this, "height", {
        get: function() {
            return this.viewport.height;
        },
        enumerable: true
    });
    var self = this;
    this.getPagePoint = function(x, y) {
        return this.viewport.convertToPdfPoint(x, y);
    };
    this.scrollIntoView = function(dest) {
        PresentationMode.active && (dest = null);
        if (!dest) {
            scrollIntoView(div);
            return;
        }
        var x = 0, y = 0;
        var widthScale, heightScale, width = 0, height = 0;
        var scale = 0;
        switch (dest[1].name) {
          case "XYZ":
            x = dest[2];
            y = dest[3];
            scale = dest[4];
            x = null !== x ? x : 0;
            y = null !== y ? y : this.height / this.scale;
            break;

          case "Fit":
          case "FitB":
            scale = "page-fit";
            break;

          case "FitH":
          case "FitBH":
            y = dest[2];
            scale = "page-width";
            break;

          case "FitV":
          case "FitBV":
            x = dest[2];
            scale = "page-height";
            break;

          case "FitR":
            x = dest[2];
            y = dest[3];
            width = dest[4] - x;
            height = dest[5] - y;
            widthScale = (PDFView.container.clientWidth - SCROLLBAR_PADDING) / width / CSS_UNITS;
            heightScale = (PDFView.container.clientHeight - SCROLLBAR_PADDING) / height / CSS_UNITS;
            scale = Math.min(widthScale, heightScale);
            break;

          default:
            return;
        }
        scale && scale !== PDFView.currentScale ? PDFView.parseScale(scale, true, true) : PDFView.currentScale === UNKNOWN_SCALE && PDFView.parseScale(DEFAULT_SCALE, true, true);
        if ("page-fit" === scale && !dest[4]) {
            scrollIntoView(div);
            return;
        }
        var boundingRect = [ this.viewport.convertToViewportPoint(x, y), this.viewport.convertToViewportPoint(x + width, y + height) ];
        setTimeout(function() {
            PDFView.currentScale;
            var x = Math.min(boundingRect[0][0], boundingRect[1][0]);
            var y = Math.min(boundingRect[0][1], boundingRect[1][1]);
            var width = Math.abs(boundingRect[0][0] - boundingRect[1][0]);
            var height = Math.abs(boundingRect[0][1] - boundingRect[1][1]);
            scrollIntoView(div, {
                left: x,
                top: y,
                width: width,
                height: height
            });
        }, 0);
    };
    this.getTextContent = function() {
        this.textContent || (this.textContent = this.pdfPage.getTextContent());
        return this.textContent;
    };
    this.draw = function(callback) {
        function pageViewDrawCallback(error) {
            renderTask === self.renderTask && (self.renderTask = null);
            if ("cancelled" === error) return;
            self.renderingState = RenderingStates.FINISHED;
            if (self.loadingIconDiv) {
                div.removeChild(self.loadingIconDiv);
                delete self.loadingIconDiv;
            }
            if (self.zoomLayer) {
                div.removeChild(self.zoomLayer);
                self.zoomLayer = null;
            }
            error && PDFView.error(mozL10n.get("rendering_error", null, "An error occurred while rendering the page."), error);
            self.stats = pdfPage.stats;
            self.updateStats();
            self.onAfterDraw && self.onAfterDraw();
            cache.push(self);
            var event = document.createEvent("CustomEvent");
            event.initCustomEvent("pagerender", true, true, {
                pageNumber: pdfPage.pageNumber
            });
            div.dispatchEvent(event);
            callback();
        }
        var pdfPage = this.pdfPage;
        if (!pdfPage) {
            var promise = PDFView.getPage(this.id);
            promise.then(function(pdfPage) {
                this.setPdfPage(pdfPage);
                this.draw(callback);
            }.bind(this));
            return;
        }
        this.renderingState !== RenderingStates.INITIAL && console.error("Must be in new state before drawing");
        this.renderingState = RenderingStates.RUNNING;
        var viewport = this.viewport;
        var canvasWrapper = document.createElement("div");
        canvasWrapper.style.width = div.style.width;
        canvasWrapper.style.height = div.style.height;
        canvasWrapper.classList.add("canvasWrapper");
        var canvas = document.createElement("canvas");
        canvas.id = "page" + this.id;
        canvasWrapper.appendChild(canvas);
        div.appendChild(canvasWrapper);
        this.canvas = canvas;
        this.scale;
        var ctx = canvas.getContext("2d");
        var outputScale = getOutputScale(ctx);
        if (USE_ONLY_CSS_ZOOM) {
            var actualSizeViewport = viewport.clone({
                scale: CSS_UNITS
            });
            outputScale.sx *= actualSizeViewport.width / viewport.width;
            outputScale.sy *= actualSizeViewport.height / viewport.height;
            outputScale.scaled = true;
        }
        canvas.width = Math.floor(viewport.width * outputScale.sx);
        canvas.height = Math.floor(viewport.height * outputScale.sy);
        canvas.style.width = Math.floor(viewport.width) + "px";
        canvas.style.height = Math.floor(viewport.height) + "px";
        var textLayerDiv = null;
        if (!PDFJS.disableTextLayer) {
            textLayerDiv = document.createElement("div");
            textLayerDiv.className = "textLayer";
            textLayerDiv.style.width = canvas.width + "px";
            textLayerDiv.style.height = canvas.height + "px";
            div.appendChild(textLayerDiv);
        }
        var textLayer = this.textLayer = textLayerDiv ? new TextLayerBuilder({
            textLayerDiv: textLayerDiv,
            pageIndex: this.id - 1,
            lastScrollSource: PDFView,
            viewport: this.viewport,
            isViewerInPresentationMode: PresentationMode.active
        }) : null;
        ctx._scaleX = outputScale.sx;
        ctx._scaleY = outputScale.sy;
        outputScale.scaled && ctx.scale(outputScale.sx, outputScale.sy);
        if (outputScale.scaled && textLayerDiv) {
            var cssScale = "scale(" + 1 / outputScale.sx + ", " + 1 / outputScale.sy + ")";
            CustomStyle.setProp("transform", textLayerDiv, cssScale);
            CustomStyle.setProp("transformOrigin", textLayerDiv, "0% 0%");
        }
        var self = this;
        var renderContext = {
            canvasContext: ctx,
            viewport: this.viewport,
            textLayer: textLayer,
            continueCallback: function(cont) {
                if (PDFView.highestPriorityPage !== "page" + self.id) {
                    self.renderingState = RenderingStates.PAUSED;
                    self.resume = function() {
                        self.renderingState = RenderingStates.RUNNING;
                        cont();
                    };
                    return;
                }
                cont();
            }
        };
        var renderTask = this.renderTask = this.pdfPage.render(renderContext);
        this.renderTask.then(function() {
            pageViewDrawCallback(null);
        }, function(error) {
            pageViewDrawCallback(error);
        });
        textLayer && this.getTextContent().then(function(textContent) {
            textLayer.setTextContent(textContent);
        });
        setupAnnotations(div, pdfPage, this.viewport);
        div.setAttribute("data-loaded", true);
    };
    this.beforePrint = function() {
        var pdfPage = this.pdfPage;
        var viewport = pdfPage.getViewport(1);
        var PRINT_OUTPUT_SCALE = 2;
        var canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width) * PRINT_OUTPUT_SCALE;
        canvas.height = Math.floor(viewport.height) * PRINT_OUTPUT_SCALE;
        canvas.style.width = PRINT_OUTPUT_SCALE * viewport.width + "pt";
        canvas.style.height = PRINT_OUTPUT_SCALE * viewport.height + "pt";
        var cssScale = "scale(" + 1 / PRINT_OUTPUT_SCALE + ", " + 1 / PRINT_OUTPUT_SCALE + ")";
        CustomStyle.setProp("transform", canvas, cssScale);
        CustomStyle.setProp("transformOrigin", canvas, "0% 0%");
        var printContainer = document.getElementById("printContainer");
        var canvasWrapper = document.createElement("div");
        canvasWrapper.style.width = viewport.width + "pt";
        canvasWrapper.style.height = viewport.height + "pt";
        canvasWrapper.appendChild(canvas);
        printContainer.appendChild(canvasWrapper);
        var self = this;
        canvas.mozPrintCallback = function(obj) {
            var ctx = obj.context;
            ctx.save();
            ctx.fillStyle = "rgb(255, 255, 255)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.restore();
            ctx.scale(PRINT_OUTPUT_SCALE, PRINT_OUTPUT_SCALE);
            var renderContext = {
                canvasContext: ctx,
                viewport: viewport
            };
            pdfPage.render(renderContext).then(function() {
                obj.done();
                self.pdfPage.destroy();
            }, function(error) {
                console.error(error);
                "abort" in obj ? obj.abort() : obj.done();
                self.pdfPage.destroy();
            });
        };
    };
    this.updateStats = function() {
        if (!this.stats) return;
        if (PDFJS.pdfBug && Stats.enabled) {
            var stats = this.stats;
            Stats.add(this.id, stats);
        }
    };
};

var ThumbnailView = function(container, id, defaultViewport) {
    var anchor = document.createElement("a");
    anchor.href = PDFView.getAnchorUrl("#page=" + id);
    anchor.title = mozL10n.get("thumb_page_title", {
        page: id
    }, "Page {{page}}");
    anchor.onclick = function() {
        PDFView.page = id;
        return false;
    };
    this.pdfPage = void 0;
    this.viewport = defaultViewport;
    this.pdfPageRotate = defaultViewport.rotate;
    this.rotation = 0;
    this.pageWidth = this.viewport.width;
    this.pageHeight = this.viewport.height;
    this.pageRatio = this.pageWidth / this.pageHeight;
    this.id = id;
    this.canvasWidth = 98;
    this.canvasHeight = this.canvasWidth / this.pageWidth * this.pageHeight;
    this.scale = this.canvasWidth / this.pageWidth;
    var div = this.el = document.createElement("div");
    div.id = "thumbnailContainer" + id;
    div.className = "thumbnail";
    1 === id && div.classList.add("selected");
    var ring = document.createElement("div");
    ring.className = "thumbnailSelectionRing";
    ring.style.width = this.canvasWidth + "px";
    ring.style.height = this.canvasHeight + "px";
    div.appendChild(ring);
    anchor.appendChild(div);
    container.appendChild(anchor);
    this.hasImage = false;
    this.renderingState = RenderingStates.INITIAL;
    this.setPdfPage = function(pdfPage) {
        this.pdfPage = pdfPage;
        this.pdfPageRotate = pdfPage.rotate;
        this.viewport = pdfPage.getViewport(1);
        this.update();
    };
    this.update = function(rot) {
        if (!this.pdfPage) return;
        void 0 !== rot && (this.rotation = rot);
        var totalRotation = (this.rotation + this.pdfPage.rotate) % 360;
        this.viewport = this.viewport.clone({
            scale: 1,
            rotation: totalRotation
        });
        this.pageWidth = this.viewport.width;
        this.pageHeight = this.viewport.height;
        this.pageRatio = this.pageWidth / this.pageHeight;
        this.canvasHeight = this.canvasWidth / this.pageWidth * this.pageHeight;
        this.scale = this.canvasWidth / this.pageWidth;
        div.removeAttribute("data-loaded");
        ring.textContent = "";
        ring.style.width = this.canvasWidth + "px";
        ring.style.height = this.canvasHeight + "px";
        this.hasImage = false;
        this.renderingState = RenderingStates.INITIAL;
        this.resume = null;
    };
    this.getPageDrawContext = function() {
        var canvas = document.createElement("canvas");
        canvas.id = "thumbnail" + id;
        canvas.width = this.canvasWidth;
        canvas.height = this.canvasHeight;
        canvas.className = "thumbnailImage";
        canvas.setAttribute("aria-label", mozL10n.get("thumb_page_canvas", {
            page: id
        }, "Thumbnail of Page {{page}}"));
        div.setAttribute("data-loaded", true);
        ring.appendChild(canvas);
        var ctx = canvas.getContext("2d");
        ctx.save();
        ctx.fillStyle = "rgb(255, 255, 255)";
        ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
        ctx.restore();
        return ctx;
    };
    this.drawingRequired = function() {
        return !this.hasImage;
    };
    this.draw = function(callback) {
        if (!this.pdfPage) {
            var promise = PDFView.getPage(this.id);
            promise.then(function(pdfPage) {
                this.setPdfPage(pdfPage);
                this.draw(callback);
            }.bind(this));
            return;
        }
        this.renderingState !== RenderingStates.INITIAL && console.error("Must be in new state before drawing");
        this.renderingState = RenderingStates.RUNNING;
        if (this.hasImage) {
            callback();
            return;
        }
        var self = this;
        var ctx = this.getPageDrawContext();
        var drawViewport = this.viewport.clone({
            scale: this.scale
        });
        var renderContext = {
            canvasContext: ctx,
            viewport: drawViewport,
            continueCallback: function(cont) {
                if (PDFView.highestPriorityPage !== "thumbnail" + self.id) {
                    self.renderingState = RenderingStates.PAUSED;
                    self.resume = function() {
                        self.renderingState = RenderingStates.RUNNING;
                        cont();
                    };
                    return;
                }
                cont();
            }
        };
        this.pdfPage.render(renderContext).then(function() {
            self.renderingState = RenderingStates.FINISHED;
            callback();
        }, function() {
            self.renderingState = RenderingStates.FINISHED;
            callback();
        });
        this.hasImage = true;
    };
    this.setImage = function(img) {
        if (this.hasImage || !img) return;
        this.renderingState = RenderingStates.FINISHED;
        var ctx = this.getPageDrawContext();
        ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, ctx.canvas.width, ctx.canvas.height);
        this.hasImage = true;
    };
};

var TextLayerBuilder = function(options) {
    var textLayerFrag = document.createDocumentFragment();
    this.textLayerDiv = options.textLayerDiv;
    this.layoutDone = false;
    this.divContentDone = false;
    this.pageIdx = options.pageIndex;
    this.matches = [];
    this.lastScrollSource = options.lastScrollSource;
    this.viewport = options.viewport;
    this.isViewerInPresentationMode = options.isViewerInPresentationMode;
    "undefined" == typeof PDFFindController && (window.PDFFindController = null);
    "undefined" == typeof this.lastScrollSource && (this.lastScrollSource = null);
    this.beginLayout = function() {
        this.textDivs = [];
        this.renderingDone = false;
    };
    this.endLayout = function() {
        this.layoutDone = true;
        this.insertDivContent();
    };
    this.renderLayer = function() {
        var textDivs = this.textDivs;
        this.textContent.bidiTexts;
        var textLayerDiv = this.textLayerDiv;
        var canvas = document.createElement("canvas");
        var ctx = canvas.getContext("2d");
        var MAX_TEXT_DIVS_TO_RENDER = 1e5;
        if (textDivs.length > MAX_TEXT_DIVS_TO_RENDER) return;
        for (var i = 0, ii = textDivs.length; ii > i; i++) {
            var textDiv = textDivs[i];
            if ("isWhitespace" in textDiv.dataset) continue;
            textLayerFrag.appendChild(textDiv);
            ctx.font = textDiv.style.fontSize + " " + textDiv.style.fontFamily;
            var width = ctx.measureText(textDiv.textContent).width;
            if (width > 0) {
                var textScale = textDiv.dataset.canvasWidth / width;
                var rotation = textDiv.dataset.angle;
                var transform = "scale(" + textScale + ", 1)";
                transform = "rotate(" + rotation + "deg) " + transform;
                CustomStyle.setProp("transform", textDiv, transform);
                CustomStyle.setProp("transformOrigin", textDiv, "0% 0%");
                textLayerDiv.appendChild(textDiv);
            }
        }
        this.renderingDone = true;
        this.updateMatches();
        textLayerDiv.appendChild(textLayerFrag);
    };
    this.setupRenderLayoutTimer = function() {
        var RENDER_DELAY = 200;
        var self = this;
        var lastScroll = null === this.lastScrollSource ? 0 : this.lastScrollSource.lastScroll;
        if (Date.now() - lastScroll > RENDER_DELAY) this.renderLayer(); else {
            this.renderTimer && clearTimeout(this.renderTimer);
            this.renderTimer = setTimeout(function() {
                self.setupRenderLayoutTimer();
            }, RENDER_DELAY);
        }
    };
    this.appendText = function(geom) {
        var textDiv = document.createElement("div");
        var fontHeight = geom.fontSize * Math.abs(geom.vScale);
        textDiv.dataset.canvasWidth = geom.canvasWidth * Math.abs(geom.hScale);
        textDiv.dataset.fontName = geom.fontName;
        textDiv.dataset.angle = geom.angle * (180 / Math.PI);
        textDiv.style.fontSize = fontHeight + "px";
        textDiv.style.fontFamily = geom.fontFamily;
        textDiv.style.left = geom.x + fontHeight * Math.sin(geom.angle) + "px";
        textDiv.style.top = geom.y - fontHeight * Math.cos(geom.angle) + "px";
        this.textDivs.push(textDiv);
    };
    this.insertDivContent = function() {
        if (!this.layoutDone || this.divContentDone || !this.textContent) return;
        this.divContentDone = true;
        var textDivs = this.textDivs;
        var bidiTexts = this.textContent.bidiTexts;
        for (var i = 0; bidiTexts.length > i; i++) {
            var bidiText = bidiTexts[i];
            var textDiv = textDivs[i];
            if (!/\S/.test(bidiText.str)) {
                textDiv.dataset.isWhitespace = true;
                continue;
            }
            textDiv.textContent = bidiText.str;
            textDiv.dir = bidiText.dir;
        }
        this.setupRenderLayoutTimer();
    };
    this.setTextContent = function(textContent) {
        this.textContent = textContent;
        this.insertDivContent();
    };
    this.convertMatches = function(matches) {
        var i = 0;
        var iIndex = 0;
        var bidiTexts = this.textContent.bidiTexts;
        var end = bidiTexts.length - 1;
        var queryLen = null === PDFFindController ? 0 : PDFFindController.state.query.length;
        var ret = [];
        for (var m = 0; matches.length > m; m++) {
            var matchIdx = matches[m];
            while (i !== end && matchIdx >= iIndex + bidiTexts[i].str.length) {
                iIndex += bidiTexts[i].str.length;
                i++;
            }
            i == bidiTexts.length && console.error("Could not find matching mapping");
            var match = {
                begin: {
                    divIdx: i,
                    offset: matchIdx - iIndex
                }
            };
            matchIdx += queryLen;
            while (i !== end && matchIdx > iIndex + bidiTexts[i].str.length) {
                iIndex += bidiTexts[i].str.length;
                i++;
            }
            match.end = {
                divIdx: i,
                offset: matchIdx - iIndex
            };
            ret.push(match);
        }
        return ret;
    };
    this.renderMatches = function(matches) {
        function beginText(begin, className) {
            var divIdx = begin.divIdx;
            var div = textDivs[divIdx];
            div.textContent = "";
            var content = bidiTexts[divIdx].str.substring(0, begin.offset);
            var node = document.createTextNode(content);
            if (className) {
                var isSelected = isSelectedPage && divIdx === selectedMatchIdx;
                var span = document.createElement("span");
                span.className = className + (isSelected ? " selected" : "");
                span.appendChild(node);
                div.appendChild(span);
                return;
            }
            div.appendChild(node);
        }
        function appendText(from, to, className) {
            var divIdx = from.divIdx;
            var div = textDivs[divIdx];
            var content = bidiTexts[divIdx].str.substring(from.offset, to.offset);
            var node = document.createTextNode(content);
            if (className) {
                var span = document.createElement("span");
                span.className = className;
                span.appendChild(node);
                div.appendChild(span);
                return;
            }
            div.appendChild(node);
        }
        function highlightDiv(divIdx, className) {
            textDivs[divIdx].className = className;
        }
        if (0 === matches.length) return;
        var bidiTexts = this.textContent.bidiTexts;
        var textDivs = this.textDivs;
        var prevEnd = null;
        var isSelectedPage = null === PDFFindController ? false : this.pageIdx === PDFFindController.selected.pageIdx;
        var selectedMatchIdx = null === PDFFindController ? -1 : PDFFindController.selected.matchIdx;
        var highlightAll = null === PDFFindController ? false : PDFFindController.state.highlightAll;
        var infty = {
            divIdx: -1,
            offset: void 0
        };
        var i, i0 = selectedMatchIdx, i1 = i0 + 1;
        if (highlightAll) {
            i0 = 0;
            i1 = matches.length;
        } else if (!isSelectedPage) return;
        for (i = i0; i1 > i; i++) {
            var match = matches[i];
            var begin = match.begin;
            var end = match.end;
            var isSelected = isSelectedPage && i === selectedMatchIdx;
            var highlightSuffix = isSelected ? " selected" : "";
            isSelected && !this.isViewerInPresentationMode && scrollIntoView(textDivs[begin.divIdx], {
                top: -50
            });
            if (prevEnd && begin.divIdx === prevEnd.divIdx) appendText(prevEnd, begin); else {
                null !== prevEnd && appendText(prevEnd, infty);
                beginText(begin);
            }
            if (begin.divIdx === end.divIdx) appendText(begin, end, "highlight" + highlightSuffix); else {
                appendText(begin, infty, "highlight begin" + highlightSuffix);
                for (var n = begin.divIdx + 1; end.divIdx > n; n++) highlightDiv(n, "highlight middle" + highlightSuffix);
                beginText(end, "highlight end" + highlightSuffix);
            }
            prevEnd = end;
        }
        prevEnd && appendText(prevEnd, infty);
    };
    this.updateMatches = function() {
        if (!this.renderingDone) return;
        var matches = this.matches;
        var textDivs = this.textDivs;
        var bidiTexts = this.textContent.bidiTexts;
        var clearedUntilDivIdx = -1;
        for (var i = 0; matches.length > i; i++) {
            var match = matches[i];
            var begin = Math.max(clearedUntilDivIdx, match.begin.divIdx);
            for (var n = begin; match.end.divIdx >= n; n++) {
                var div = textDivs[n];
                div.textContent = bidiTexts[n].str;
                div.className = "";
            }
            clearedUntilDivIdx = match.end.divIdx + 1;
        }
        if (null === PDFFindController || !PDFFindController.active) return;
        this.matches = matches = this.convertMatches(null === PDFFindController ? [] : PDFFindController.pageMatches[this.pageIdx] || []);
        this.renderMatches(this.matches);
    };
};

var DocumentOutlineView = function(outline) {
    function bindItemLink(domObj, item) {
        domObj.href = PDFView.getDestinationHash(item.dest);
        domObj.onclick = function() {
            PDFView.navigateTo(item.dest);
            return false;
        };
    }
    var outlineView = document.getElementById("outlineView");
    document.getElementById("viewOutline");
    while (outlineView.firstChild) outlineView.removeChild(outlineView.firstChild);
    if (!outline) {
        outlineView.classList.contains("hidden") || PDFView.switchSidebarView("thumbs");
        return;
    }
    var queue = [ {
        parent: outlineView,
        items: outline
    } ];
    while (queue.length > 0) {
        var levelData = queue.shift();
        var i, n = levelData.items.length;
        for (i = 0; n > i; i++) {
            var item = levelData.items[i];
            var div = document.createElement("div");
            div.className = "outlineItem";
            var a = document.createElement("a");
            bindItemLink(a, item);
            a.textContent = item.title;
            div.appendChild(a);
            if (item.items.length > 0) {
                var itemsDiv = document.createElement("div");
                itemsDiv.className = "outlineItems";
                div.appendChild(itemsDiv);
                queue.push({
                    parent: itemsDiv,
                    items: item.items
                });
            }
            levelData.parent.appendChild(div);
        }
    }
};

document.addEventListener("DOMContentLoaded", function() {
    PDFView.initialize();
    var params = PDFView.parseQueryString(document.location.search.substring(1));
    var file = params.file || DEFAULT_URL;
    var fileInput = document.createElement("input");
    fileInput.id = "fileInput";
    fileInput.className = "fileInput";
    fileInput.setAttribute("type", "file");
    fileInput.setAttribute("style", "visibility: hidden; position: fixed; right: 0; top: 0");
    fileInput.oncontextmenu = noContextMenuHandler;
    document.body.appendChild(fileInput);
    if (window.File && window.FileReader && window.FileList && window.Blob) document.getElementById("fileInput").value = null; else {
        document.getElementById("openFile").setAttribute("hidden", "true");
        document.getElementById("secondaryOpenFile").setAttribute("hidden", "true");
    }
    var hash = document.location.hash.substring(1);
    var hashParams = PDFView.parseQueryString(hash);
    "disableWorker" in hashParams && (PDFJS.disableWorker = "true" === hashParams["disableWorker"]);
    "disableRange" in hashParams && (PDFJS.disableRange = "true" === hashParams["disableRange"]);
    "disableAutoFetch" in hashParams && (PDFJS.disableAutoFetch = "true" === hashParams["disableAutoFetch"]);
    "disableFontFace" in hashParams && (PDFJS.disableFontFace = "true" === hashParams["disableFontFace"]);
    "disableHistory" in hashParams && (PDFJS.disableHistory = "true" === hashParams["disableHistory"]);
    "useOnlyCssZoom" in hashParams && (USE_ONLY_CSS_ZOOM = "true" === hashParams["useOnlyCssZoom"]);
    var locale = navigator.language;
    "locale" in hashParams && (locale = hashParams["locale"]);
    mozL10n.setLanguage(locale);
    if ("textLayer" in hashParams) switch (hashParams["textLayer"]) {
      case "off":
        PDFJS.disableTextLayer = true;
        break;

      case "visible":
      case "shadow":
      case "hover":
        var viewer = document.getElementById("viewer");
        viewer.classList.add("textLayer-" + hashParams["textLayer"]);
    }
    if ("pdfBug" in hashParams) {
        PDFJS.pdfBug = true;
        var pdfBug = hashParams["pdfBug"];
        var enabled = pdfBug.split(",");
        PDFBug.enable(enabled);
        PDFBug.init();
    }
    if (!PDFView.supportsPrinting) {
        document.getElementById("print").classList.add("hidden");
        document.getElementById("secondaryPrint").classList.add("hidden");
    }
    if (!PDFView.supportsFullscreen) {
        document.getElementById("presentationMode").classList.add("hidden");
        document.getElementById("secondaryPresentationMode").classList.add("hidden");
    }
    PDFView.supportsIntegratedFind && document.getElementById("viewFind").classList.add("hidden");
    PDFJS.LogManager.addLogger({
        warn: function() {
            PDFView.fallback();
        }
    });
    document.getElementById("scaleSelect").oncontextmenu = noContextMenuHandler;
    var mainContainer = document.getElementById("mainContainer");
    var outerContainer = document.getElementById("outerContainer");
    mainContainer.addEventListener("transitionend", function(e) {
        if (e.target == mainContainer) {
            var event = document.createEvent("UIEvents");
            event.initUIEvent("resize", false, false, window, 0);
            window.dispatchEvent(event);
            outerContainer.classList.remove("sidebarMoving");
        }
    }, true);
    document.getElementById("sidebarToggle").addEventListener("click", function() {
        this.classList.toggle("toggled");
        outerContainer.classList.add("sidebarMoving");
        outerContainer.classList.toggle("sidebarOpen");
        PDFView.sidebarOpen = outerContainer.classList.contains("sidebarOpen");
        PDFView.renderHighestPriority();
    });
    document.getElementById("viewThumbnail").addEventListener("click", function() {
        PDFView.switchSidebarView("thumbs");
    });
    document.getElementById("viewOutline").addEventListener("click", function() {
        PDFView.switchSidebarView("outline");
    });
    document.getElementById("previous").addEventListener("click", function() {
        PDFView.page--;
    });
    document.getElementById("next").addEventListener("click", function() {
        PDFView.page++;
    });
    document.getElementById("zoomIn").addEventListener("click", function() {
        PDFView.zoomIn();
    });
    document.getElementById("zoomOut").addEventListener("click", function() {
        PDFView.zoomOut();
    });
    document.getElementById("pageNumber").addEventListener("click", function() {
        this.select();
    });
    document.getElementById("pageNumber").addEventListener("change", function() {
        PDFView.page = 0 | this.value;
        this.value !== (0 | this.value).toString() && (this.value = PDFView.page);
    });
    document.getElementById("scaleSelect").addEventListener("change", function() {
        PDFView.parseScale(this.value);
    });
    document.getElementById("presentationMode").addEventListener("click", SecondaryToolbar.presentationModeClick.bind(SecondaryToolbar));
    document.getElementById("openFile").addEventListener("click", SecondaryToolbar.openFileClick.bind(SecondaryToolbar));
    document.getElementById("print").addEventListener("click", SecondaryToolbar.printClick.bind(SecondaryToolbar));
    document.getElementById("download").addEventListener("click", SecondaryToolbar.downloadClick.bind(SecondaryToolbar));
    PDFView.open(file, 0);
}, true);

window.addEventListener("resize", function() {
    PDFView.initialized && (document.getElementById("pageWidthOption").selected || document.getElementById("pageFitOption").selected || document.getElementById("pageAutoOption").selected) && PDFView.parseScale(document.getElementById("scaleSelect").value);
    updateViewarea();
    SecondaryToolbar.setMaxHeight(PDFView.container);
});

window.addEventListener("hashchange", function() {
    PDFHistory.isHashChangeUnlocked && PDFView.setHash(document.location.hash.substring(1));
});

window.addEventListener("change", function(evt) {
    var files = evt.target.files;
    if (!files || 0 === files.length) return;
    var fileReader = new FileReader();
    fileReader.onload = function(evt) {
        var buffer = evt.target.result;
        var uint8Array = new Uint8Array(buffer);
        PDFView.open(uint8Array, 0);
    };
    var file = files[0];
    fileReader.readAsArrayBuffer(file);
    PDFView.setTitleUsingUrl(file.name);
    document.getElementById("viewBookmark").setAttribute("hidden", "true");
    document.getElementById("secondaryViewBookmark").setAttribute("hidden", "true");
    document.getElementById("download").setAttribute("hidden", "true");
    document.getElementById("secondaryDownload").setAttribute("hidden", "true");
}, true);

window.addEventListener("localized", function() {
    document.getElementsByTagName("html")[0].dir = mozL10n.getDirection();
    PDFView.animationStartedPromise.then(function() {
        var container = document.getElementById("scaleSelectContainer");
        if (container.clientWidth > 0) {
            var select = document.getElementById("scaleSelect");
            select.setAttribute("style", "min-width: inherit;");
            var width = select.clientWidth + SCALE_SELECT_CONTAINER_PADDING;
            select.setAttribute("style", "min-width: " + (width + SCALE_SELECT_PADDING) + "px;");
            container.setAttribute("style", "min-width: " + width + "px; " + "max-width: " + width + "px;");
        }
        SecondaryToolbar.setMaxHeight(PDFView.container);
    });
}, true);

window.addEventListener("scalechange", function(evt) {
    document.getElementById("zoomOut").disabled = evt.scale === MIN_SCALE;
    document.getElementById("zoomIn").disabled = evt.scale === MAX_SCALE;
    var customScaleOption = document.getElementById("customScaleOption");
    customScaleOption.selected = false;
    if (!evt.resetAutoSettings && (document.getElementById("pageWidthOption").selected || document.getElementById("pageFitOption").selected || document.getElementById("pageAutoOption").selected)) {
        updateViewarea();
        return;
    }
    var predefinedValueFound = selectScaleOption("" + evt.scale);
    if (!predefinedValueFound) {
        customScaleOption.textContent = Math.round(1e4 * evt.scale) / 100 + "%";
        customScaleOption.selected = true;
    }
    updateViewarea();
}, true);

window.addEventListener("pagechange", function(evt) {
    var page = evt.pageNumber;
    if (PDFView.previousPageNumber !== page) {
        document.getElementById("pageNumber").value = page;
        var selected = document.querySelector(".thumbnail.selected");
        selected && selected.classList.remove("selected");
        var thumbnail = document.getElementById("thumbnailContainer" + page);
        thumbnail.classList.add("selected");
        var visibleThumbs = PDFView.getVisibleThumbs();
        var numVisibleThumbs = visibleThumbs.views.length;
        if (numVisibleThumbs > 0) {
            var first = visibleThumbs.first.id;
            var last = numVisibleThumbs > 1 ? visibleThumbs.last.id : first;
            (first >= page || page >= last) && scrollIntoView(thumbnail);
        }
    }
    document.getElementById("previous").disabled = 1 >= page;
    document.getElementById("next").disabled = page >= PDFView.pages.length;
}, true);

window.addEventListener("DOMMouseScroll", function(evt) {
    if (evt.ctrlKey) {
        evt.preventDefault();
        var ticks = evt.detail;
        var direction = ticks > 0 ? "zoomOut" : "zoomIn";
        PDFView[direction](Math.abs(ticks));
    } else if (PresentationMode.active) {
        var FIREFOX_DELTA_FACTOR = -40;
        PDFView.mouseScroll(evt.detail * FIREFOX_DELTA_FACTOR);
    }
}, false);

window.addEventListener("click", function(evt) {
    PresentationMode.active ? 0 === evt.button && evt.preventDefault() : SecondaryToolbar.isOpen && PDFView.container.contains(evt.target) && SecondaryToolbar.close();
}, false);

window.addEventListener("keydown", function(evt) {
    if (PasswordPrompt.visible) return;
    var handled = false;
    var cmd = (evt.ctrlKey ? 1 : 0) | (evt.altKey ? 2 : 0) | (evt.shiftKey ? 4 : 0) | (evt.metaKey ? 8 : 0);
    if (1 === cmd || 8 === cmd || 5 === cmd || 12 === cmd) switch (evt.keyCode) {
      case 70:
        if (!PDFView.supportsIntegratedFind) {
            PDFFindBar.toggle();
            handled = true;
        }
        break;

      case 71:
        if (!PDFView.supportsIntegratedFind) {
            PDFFindBar.dispatchEvent("again", 5 === cmd || 12 === cmd);
            handled = true;
        }
        break;

      case 61:
      case 107:
      case 187:
      case 171:
        PDFView.zoomIn();
        handled = true;
        break;

      case 173:
      case 109:
      case 189:
        PDFView.zoomOut();
        handled = true;
        break;

      case 48:
      case 96:
        setTimeout(function() {
            PDFView.parseScale(DEFAULT_SCALE, true);
        });
        handled = false;
    }
    if (3 === cmd || 10 === cmd) switch (evt.keyCode) {
      case 80:
        SecondaryToolbar.presentationModeClick();
        handled = true;
    }
    if (handled) {
        evt.preventDefault();
        return;
    }
    var curElement = document.activeElement || document.querySelector(":focus");
    if (curElement && ("INPUT" === curElement.tagName.toUpperCase() || "TEXTAREA" === curElement.tagName.toUpperCase() || "SELECT" === curElement.tagName.toUpperCase()) && 27 !== evt.keyCode) return;
    var controlsElement = document.getElementById("toolbar");
    while (curElement) {
        if (curElement === controlsElement && !PresentationMode.active) return;
        curElement = curElement.parentNode;
    }
    if (0 === cmd) switch (evt.keyCode) {
      case 38:
      case 33:
      case 8:
        if (!PresentationMode.active && "page-fit" !== PDFView.currentScaleValue) break;

      case 37:
        if (PDFView.isHorizontalScrollbarEnabled) break;

      case 75:
      case 80:
        PDFView.page--;
        handled = true;
        break;

      case 27:
        if (SecondaryToolbar.isOpen) {
            SecondaryToolbar.close();
            handled = true;
        }
        if (!PDFView.supportsIntegratedFind && PDFFindBar.opened) {
            PDFFindBar.close();
            handled = true;
        }
        break;

      case 40:
      case 34:
      case 32:
        if (!PresentationMode.active && "page-fit" !== PDFView.currentScaleValue) break;

      case 39:
        if (PDFView.isHorizontalScrollbarEnabled) break;

      case 74:
      case 78:
        PDFView.page++;
        handled = true;
        break;

      case 36:
        if (PresentationMode.active) {
            PDFView.page = 1;
            handled = true;
        }
        break;

      case 35:
        if (PresentationMode.active) {
            PDFView.page = PDFView.pdfDocument.numPages;
            handled = true;
        }
        break;

      case 82:
        PDFView.rotatePages(90);
    }
    if (4 === cmd) switch (evt.keyCode) {
      case 32:
        if (!PresentationMode.active && "page-fit" !== PDFView.currentScaleValue) break;
        PDFView.page--;
        handled = true;
        break;

      case 82:
        PDFView.rotatePages(-90);
    }
    if (2 === cmd) switch (evt.keyCode) {
      case 37:
        if (PresentationMode.active) {
            PDFHistory.back();
            handled = true;
        }
        break;

      case 39:
        if (PresentationMode.active) {
            PDFHistory.forward();
            handled = true;
        }
    }
    if (handled) {
        evt.preventDefault();
        PDFView.clearMouseScrollState();
    }
});

window.addEventListener("beforeprint", function() {
    PDFView.beforePrint();
});

window.addEventListener("afterprint", function() {
    PDFView.afterPrint();
});

(function() {
    var requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || function(callback) {
        callback();
    };
    PDFView.animationStartedPromise = new PDFJS.Promise();
    requestAnimationFrame(function() {
        PDFView.animationStartedPromise.resolve();
    });
})();