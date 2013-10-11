"use strict";

var FontInspector = function() {
    function removeSelection() {
        var divs = document.querySelectorAll("div[" + fontAttribute + "]");
        for (var i = 0, ii = divs.length; ii > i; ++i) {
            var div = divs[i];
            div.className = "";
        }
    }
    function resetSelection() {
        var divs = document.querySelectorAll("div[" + fontAttribute + "]");
        for (var i = 0, ii = divs.length; ii > i; ++i) {
            var div = divs[i];
            div.className = "debuggerHideText";
        }
    }
    function selectFont(fontName, show) {
        var divs = document.querySelectorAll("div[" + fontAttribute + "=" + fontName + "]");
        for (var i = 0, ii = divs.length; ii > i; ++i) {
            var div = divs[i];
            div.className = show ? "debuggerShowText" : "debuggerHideText";
        }
    }
    function textLayerClick(e) {
        if (!e.target.dataset.fontName || "DIV" !== e.target.tagName.toUpperCase()) return;
        var fontName = e.target.dataset.fontName;
        var selects = document.getElementsByTagName("input");
        for (var i = 0; selects.length > i; ++i) {
            var select = selects[i];
            if (select.dataset.fontName != fontName) continue;
            select.checked = !select.checked;
            selectFont(fontName, select.checked);
            select.scrollIntoView();
        }
    }
    var fonts;
    var active = false;
    var fontAttribute = "data-font-name";
    return {
        id: "FontInspector",
        name: "Font Inspector",
        panel: null,
        manager: null,
        init: function() {
            var panel = this.panel;
            panel.setAttribute("style", "padding: 5px;");
            var tmp = document.createElement("button");
            tmp.addEventListener("click", resetSelection);
            tmp.textContent = "Refresh";
            panel.appendChild(tmp);
            fonts = document.createElement("div");
            panel.appendChild(fonts);
        },
        enabled: false,
        get active() {
            return active;
        },
        set active(value) {
            active = value;
            if (active) {
                document.body.addEventListener("click", textLayerClick, true);
                resetSelection();
            } else {
                document.body.removeEventListener("click", textLayerClick, true);
                removeSelection();
            }
        },
        fontAdded: function(fontObj, url) {
            function properties(obj, list) {
                var moreInfo = document.createElement("table");
                for (var i = 0; list.length > i; i++) {
                    var tr = document.createElement("tr");
                    var td1 = document.createElement("td");
                    td1.textContent = list[i];
                    tr.appendChild(td1);
                    var td2 = document.createElement("td");
                    td2.textContent = obj[list[i]].toString();
                    tr.appendChild(td2);
                    moreInfo.appendChild(tr);
                }
                return moreInfo;
            }
            var moreInfo = properties(fontObj, [ "name", "type" ]);
            var m = /url\(['"]?([^\)"']+)/.exec(url);
            var fontName = fontObj.loadedName;
            var font = document.createElement("div");
            var name = document.createElement("span");
            name.textContent = fontName;
            var download = document.createElement("a");
            download.href = m[1];
            download.textContent = "Download";
            var logIt = document.createElement("a");
            logIt.href = "";
            logIt.textContent = "Log";
            logIt.addEventListener("click", function(event) {
                event.preventDefault();
                console.log(fontObj);
            });
            var select = document.createElement("input");
            select.setAttribute("type", "checkbox");
            select.dataset.fontName = fontName;
            select.addEventListener("click", function(select, fontName) {
                return function() {
                    selectFont(fontName, select.checked);
                };
            }(select, fontName));
            font.appendChild(select);
            font.appendChild(name);
            font.appendChild(document.createTextNode(" "));
            font.appendChild(download);
            font.appendChild(document.createTextNode(" "));
            font.appendChild(logIt);
            font.appendChild(moreInfo);
            fonts.appendChild(font);
            setTimeout(function() {
                this.active && resetSelection();
            }.bind(this), 2e3);
        }
    };
}();

var StepperManager = function() {
    var steppers = [];
    var stepperDiv = null;
    var stepperControls = null;
    var stepperChooser = null;
    var breakPoints = {};
    return {
        id: "Stepper",
        name: "Stepper",
        panel: null,
        manager: null,
        init: function() {
            var self = this;
            this.panel.setAttribute("style", "padding: 5px;");
            stepperControls = document.createElement("div");
            stepperChooser = document.createElement("select");
            stepperChooser.addEventListener("change", function() {
                self.selectStepper(this.value);
            });
            stepperControls.appendChild(stepperChooser);
            stepperDiv = document.createElement("div");
            this.panel.appendChild(stepperControls);
            this.panel.appendChild(stepperDiv);
            sessionStorage.getItem("pdfjsBreakPoints") && (breakPoints = JSON.parse(sessionStorage.getItem("pdfjsBreakPoints")));
        },
        enabled: false,
        active: false,
        create: function(pageIndex) {
            var debug = document.createElement("div");
            debug.id = "stepper" + pageIndex;
            debug.setAttribute("hidden", true);
            debug.className = "stepper";
            stepperDiv.appendChild(debug);
            var b = document.createElement("option");
            b.textContent = "Page " + (pageIndex + 1);
            b.value = pageIndex;
            stepperChooser.appendChild(b);
            var initBreakPoints = breakPoints[pageIndex] || [];
            var stepper = new Stepper(debug, pageIndex, initBreakPoints);
            steppers.push(stepper);
            1 === steppers.length && this.selectStepper(pageIndex, false);
            return stepper;
        },
        selectStepper: function(pageIndex, selectPanel) {
            selectPanel && this.manager.selectPanel(1);
            for (var i = 0; steppers.length > i; ++i) {
                var stepper = steppers[i];
                stepper.pageIndex == pageIndex ? stepper.panel.removeAttribute("hidden") : stepper.panel.setAttribute("hidden", true);
            }
            var options = stepperChooser.options;
            for (var i = 0; options.length > i; ++i) {
                var option = options[i];
                option.selected = option.value == pageIndex;
            }
        },
        saveBreakPoints: function(pageIndex, bps) {
            breakPoints[pageIndex] = bps;
            sessionStorage.setItem("pdfjsBreakPoints", JSON.stringify(breakPoints));
        }
    };
}();

var Stepper = function() {
    function c(tag, textContent) {
        var d = document.createElement(tag);
        textContent && (d.textContent = textContent);
        return d;
    }
    function glyphsToString(glyphs) {
        var out = "";
        for (var i = 0; glyphs.length > i; i++) out += null === glyphs[i] ? " " : glyphs[i].fontChar;
        return out;
    }
    function Stepper(panel, pageIndex, initialBreakPoints) {
        this.panel = panel;
        this.breakPoint = 0;
        this.nextBreakPoint = null;
        this.pageIndex = pageIndex;
        this.breakPoints = initialBreakPoints;
        this.currentIdx = -1;
        this.operatorListIdx = 0;
    }
    var glyphCommands = {
        showText: 0,
        showSpacedText: 0,
        nextLineShowText: 0,
        nextLineSetSpacingShowText: 2
    };
    Stepper.prototype = {
        init: function() {
            var panel = this.panel;
            var content = c("div", "c=continue, s=step");
            var table = c("table");
            content.appendChild(table);
            table.cellSpacing = 0;
            var headerRow = c("tr");
            table.appendChild(headerRow);
            headerRow.appendChild(c("th", "Break"));
            headerRow.appendChild(c("th", "Idx"));
            headerRow.appendChild(c("th", "fn"));
            headerRow.appendChild(c("th", "args"));
            panel.appendChild(content);
            this.table = table;
        },
        updateOperatorList: function(operatorList) {
            var self = this;
            for (var i = this.operatorListIdx; operatorList.fnArray.length > i; i++) {
                var line = c("tr");
                line.className = "line";
                line.dataset.idx = i;
                this.table.appendChild(line);
                var checked = -1 != this.breakPoints.indexOf(i);
                var args = operatorList.argsArray[i] ? operatorList.argsArray[i] : [];
                var breakCell = c("td");
                var cbox = c("input");
                cbox.type = "checkbox";
                cbox.className = "points";
                cbox.checked = checked;
                cbox.onclick = function(x) {
                    return function() {
                        this.checked ? self.breakPoints.push(x) : self.breakPoints.splice(self.breakPoints.indexOf(x), 1);
                        StepperManager.saveBreakPoints(self.pageIndex, self.breakPoints);
                    };
                }(i);
                breakCell.appendChild(cbox);
                line.appendChild(breakCell);
                line.appendChild(c("td", i.toString()));
                var fn = operatorList.fnArray[i];
                var decArgs = args;
                if (fn in glyphCommands) {
                    var glyphIndex = glyphCommands[fn];
                    var glyphs = args[glyphIndex];
                    var decArgs = args.slice();
                    var newArg;
                    if ("showSpacedText" === fn) {
                        newArg = [];
                        for (var j = 0; glyphs.length > j; j++) "number" == typeof glyphs[j] ? newArg.push(glyphs[j]) : newArg.push(glyphsToString(glyphs[j]));
                    } else newArg = glyphsToString(glyphs);
                    decArgs[glyphIndex] = newArg;
                }
                line.appendChild(c("td", fn));
                line.appendChild(c("td", JSON.stringify(decArgs)));
            }
        },
        getNextBreakPoint: function() {
            this.breakPoints.sort(function(a, b) {
                return a - b;
            });
            for (var i = 0; this.breakPoints.length > i; i++) if (this.breakPoints[i] > this.currentIdx) return this.breakPoints[i];
            return null;
        },
        breakIt: function(idx, callback) {
            StepperManager.selectStepper(this.pageIndex, true);
            var self = this;
            var dom = document;
            self.currentIdx = idx;
            var listener = function(e) {
                switch (e.keyCode) {
                  case 83:
                    dom.removeEventListener("keydown", listener, false);
                    self.nextBreakPoint = self.currentIdx + 1;
                    self.goTo(-1);
                    callback();
                    break;

                  case 67:
                    dom.removeEventListener("keydown", listener, false);
                    var breakPoint = self.getNextBreakPoint();
                    self.nextBreakPoint = breakPoint;
                    self.goTo(-1);
                    callback();
                }
            };
            dom.addEventListener("keydown", listener, false);
            self.goTo(idx);
        },
        goTo: function(idx) {
            var allRows = this.panel.getElementsByClassName("line");
            for (var x = 0, xx = allRows.length; xx > x; ++x) {
                var row = allRows[x];
                if (row.dataset.idx == idx) {
                    row.style.backgroundColor = "rgb(251,250,207)";
                    row.scrollIntoView();
                } else row.style.backgroundColor = null;
            }
        }
    };
    return Stepper;
}();

var Stats = function Stats() {
    function clear(node) {
        while (node.hasChildNodes()) node.removeChild(node.lastChild);
    }
    function getStatIndex(pageNumber) {
        for (var i = 0, ii = stats.length; ii > i; ++i) if (stats[i].pageNumber === pageNumber) return i;
        return false;
    }
    var stats = [];
    return {
        id: "Stats",
        name: "Stats",
        panel: null,
        manager: null,
        init: function() {
            this.panel.setAttribute("style", "padding: 5px;");
            PDFJS.enableStats = true;
        },
        enabled: false,
        active: false,
        add: function(pageNumber, stat) {
            if (!stat) return;
            var statsIndex = getStatIndex(pageNumber);
            if (false !== statsIndex) {
                var b = stats[statsIndex];
                this.panel.removeChild(b.div);
                stats.splice(statsIndex, 1);
            }
            var wrapper = document.createElement("div");
            wrapper.className = "stats";
            var title = document.createElement("div");
            title.className = "title";
            title.textContent = "Page: " + pageNumber;
            var statsDiv = document.createElement("div");
            statsDiv.textContent = stat.toString();
            wrapper.appendChild(title);
            wrapper.appendChild(statsDiv);
            stats.push({
                pageNumber: pageNumber,
                div: wrapper
            });
            stats.sort(function(a, b) {
                return a.pageNumber - b.pageNumber;
            });
            clear(this.panel);
            for (var i = 0, ii = stats.length; ii > i; ++i) this.panel.appendChild(stats[i].div);
        }
    };
}();

var PDFBug = function() {
    var panelWidth = 300;
    var buttons = [];
    var activePanel = null;
    return {
        tools: [ FontInspector, StepperManager, Stats ],
        enable: function(ids) {
            var all = false, tools = this.tools;
            1 === ids.length && "all" === ids[0] && (all = true);
            for (var i = 0; tools.length > i; ++i) {
                var tool = tools[i];
                (all || -1 !== ids.indexOf(tool.id)) && (tool.enabled = true);
            }
            all || tools.sort(function(a, b) {
                var indexA = ids.indexOf(a.id);
                indexA = 0 > indexA ? tools.length : indexA;
                var indexB = ids.indexOf(b.id);
                indexB = 0 > indexB ? tools.length : indexB;
                return indexA - indexB;
            });
        },
        init: function() {
            var ui = document.createElement("div");
            ui.id = "PDFBug";
            var controls = document.createElement("div");
            controls.setAttribute("class", "controls");
            ui.appendChild(controls);
            var panels = document.createElement("div");
            panels.setAttribute("class", "panels");
            ui.appendChild(panels);
            var container = document.getElementById("viewerContainer");
            container.appendChild(ui);
            container.style.right = panelWidth + "px";
            var tools = this.tools;
            var self = this;
            for (var i = 0; tools.length > i; ++i) {
                var tool = tools[i];
                var panel = document.createElement("div");
                var panelButton = document.createElement("button");
                panelButton.textContent = tool.name;
                panelButton.addEventListener("click", function(selected) {
                    return function(event) {
                        event.preventDefault();
                        self.selectPanel(selected);
                    };
                }(i));
                controls.appendChild(panelButton);
                panels.appendChild(panel);
                tool.panel = panel;
                tool.manager = this;
                tool.enabled ? tool.init() : panel.textContent = tool.name + " is disabled. To enable add " + ' "' + tool.id + '" to the pdfBug parameter ' + "and refresh (seperate multiple by commas).";
                buttons.push(panelButton);
            }
            this.selectPanel(0);
        },
        selectPanel: function(index) {
            if (index === activePanel) return;
            activePanel = index;
            var tools = this.tools;
            for (var j = 0; tools.length > j; ++j) if (j == index) {
                buttons[j].setAttribute("class", "active");
                tools[j].active = true;
                tools[j].panel.removeAttribute("hidden");
            } else {
                buttons[j].setAttribute("class", "");
                tools[j].active = false;
                tools[j].panel.setAttribute("hidden", "true");
            }
        }
    };
}();