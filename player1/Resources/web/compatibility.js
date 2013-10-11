"use strict";

"undefined" == typeof PDFJS && (("undefined" != typeof window ? window : this).PDFJS = {});

(function() {
    function subarray(start, end) {
        return new TypedArray(this.slice(start, end));
    }
    function setArrayOffset(array, offset) {
        2 > arguments.length && (offset = 0);
        for (var i = 0, n = array.length; n > i; ++i, ++offset) this[offset] = 255 & array[i];
    }
    function TypedArray(arg1) {
        var result;
        if ("number" == typeof arg1) {
            result = [];
            for (var i = 0; arg1 > i; ++i) result[i] = 0;
        } else if ("slice" in arg1) result = arg1.slice(0); else {
            result = [];
            for (var i = 0, n = arg1.length; n > i; ++i) result[i] = arg1[i];
        }
        result.subarray = subarray;
        result.buffer = result;
        result.byteLength = result.length;
        result.set = setArrayOffset;
        "object" == typeof arg1 && arg1.buffer && (result.buffer = arg1.buffer);
        return result;
    }
    if ("undefined" != typeof Uint8Array) {
        if ("undefined" == typeof Uint8Array.prototype.subarray) {
            Uint8Array.prototype.subarray = function subarray(start, end) {
                return new Uint8Array(this.slice(start, end));
            };
            Float32Array.prototype.subarray = function subarray(start, end) {
                return new Float32Array(this.slice(start, end));
            };
        }
        "undefined" == typeof Float64Array && (window.Float64Array = Float32Array);
        return;
    }
    window.Uint8Array = TypedArray;
    window.Uint32Array = TypedArray;
    window.Int32Array = TypedArray;
    window.Uint16Array = TypedArray;
    window.Float32Array = TypedArray;
    window.Float64Array = TypedArray;
})();

(function() {
    window.URL || (window.URL = window.webkitURL);
})();

(function() {
    if ("undefined" != typeof Object.create) return;
    Object.create = function(proto) {
        function Constructor() {}
        Constructor.prototype = proto;
        return new Constructor();
    };
})();

(function() {
    if ("undefined" != typeof Object.defineProperty) {
        var definePropertyPossible = true;
        try {
            Object.defineProperty(new Image(), "id", {
                value: "test"
            });
            var Test = function Test() {};
            Test.prototype = {
                get id() {}
            };
            Object.defineProperty(new Test(), "id", {
                value: "",
                configurable: true,
                enumerable: true,
                writable: false
            });
        } catch (e) {
            definePropertyPossible = false;
        }
        if (definePropertyPossible) return;
    }
    Object.defineProperty = function(obj, name, def) {
        delete obj[name];
        "get" in def && obj.__defineGetter__(name, def["get"]);
        "set" in def && obj.__defineSetter__(name, def["set"]);
        if ("value" in def) {
            obj.__defineSetter__(name, function(value) {
                this.__defineGetter__(name, function() {
                    return value;
                });
                return value;
            });
            obj[name] = def.value;
        }
    };
})();

(function() {
    if ("undefined" != typeof Object.keys) return;
    Object.keys = function(obj) {
        var result = [];
        for (var i in obj) obj.hasOwnProperty(i) && result.push(i);
        return result;
    };
})();

(function() {
    if ("undefined" == typeof FileReader) return;
    var frPrototype = FileReader.prototype;
    if ("readAsArrayBuffer" in frPrototype) return;
    Object.defineProperty(frPrototype, "readAsArrayBuffer", {
        value: function(blob) {
            var fileReader = new FileReader();
            var originalReader = this;
            fileReader.onload = function(evt) {
                var data = evt.target.result;
                var buffer = new ArrayBuffer(data.length);
                var uint8Array = new Uint8Array(buffer);
                for (var i = 0, ii = data.length; ii > i; i++) uint8Array[i] = data.charCodeAt(i);
                Object.defineProperty(originalReader, "result", {
                    value: buffer,
                    enumerable: true,
                    writable: false,
                    configurable: true
                });
                var event = document.createEvent("HTMLEvents");
                event.initEvent("load", false, false);
                originalReader.dispatchEvent(event);
            };
            fileReader.readAsBinaryString(blob);
        }
    });
})();

(function() {
    function responseTypeSetter() {
        this.overrideMimeType("text/plain; charset=x-user-defined");
    }
    function responseGetter() {
        var text = this.responseText;
        var i, n = text.length;
        var result = new Uint8Array(n);
        for (i = 0; n > i; ++i) result[i] = 255 & text.charCodeAt(i);
        return result;
    }
    var xhrPrototype = XMLHttpRequest.prototype;
    "overrideMimeType" in xhrPrototype || Object.defineProperty(xhrPrototype, "overrideMimeType", {
        value: function() {}
    });
    if ("response" in xhrPrototype || "mozResponseArrayBuffer" in xhrPrototype || "mozResponse" in xhrPrototype || "responseArrayBuffer" in xhrPrototype) return;
    if ("undefined" != typeof VBArray) {
        Object.defineProperty(xhrPrototype, "response", {
            get: function() {
                return new Uint8Array(new VBArray(this.responseBody).toArray());
            }
        });
        return;
    }
    "function" == typeof xhrPrototype.overrideMimeType && Object.defineProperty(xhrPrototype, "responseType", {
        set: responseTypeSetter
    });
    Object.defineProperty(xhrPrototype, "response", {
        get: responseGetter
    });
})();

(function() {
    if ("btoa" in window) return;
    var digits = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    window.btoa = function(chars) {
        var buffer = "";
        var i, n;
        for (i = 0, n = chars.length; n > i; i += 3) {
            var b1 = 255 & chars.charCodeAt(i);
            var b2 = 255 & chars.charCodeAt(i + 1);
            var b3 = 255 & chars.charCodeAt(i + 2);
            var d1 = b1 >> 2, d2 = (3 & b1) << 4 | b2 >> 4;
            var d3 = n > i + 1 ? (15 & b2) << 2 | b3 >> 6 : 64;
            var d4 = n > i + 2 ? 63 & b3 : 64;
            buffer += digits.charAt(d1) + digits.charAt(d2) + digits.charAt(d3) + digits.charAt(d4);
        }
        return buffer;
    };
})();

(function() {
    if ("atob" in window) return;
    var digits = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    window.atob = function(input) {
        input = input.replace(/=+$/, "");
        if (1 == input.length % 4) throw new Error("bad atob input");
        for (var bs, buffer, bc = 0, idx = 0, output = ""; buffer = input.charAt(idx++); ~buffer && (bs = bc % 4 ? 64 * bs + buffer : buffer, 
        bc++ % 4) ? output += String.fromCharCode(255 & bs >> (6 & -2 * bc)) : 0) buffer = digits.indexOf(buffer);
        return output;
    };
})();

(function() {
    if ("undefined" != typeof Function.prototype.bind) return;
    Function.prototype.bind = function(obj) {
        var fn = this, headArgs = Array.prototype.slice.call(arguments, 1);
        var bound = function() {
            var args = Array.prototype.concat.apply(headArgs, arguments);
            return fn.apply(obj, args);
        };
        return bound;
    };
})();

(function() {
    var div = document.createElement("div");
    if ("dataset" in div) return;
    Object.defineProperty(HTMLElement.prototype, "dataset", {
        get: function() {
            if (this._dataset) return this._dataset;
            var dataset = {};
            for (var j = 0, jj = this.attributes.length; jj > j; j++) {
                var attribute = this.attributes[j];
                if ("data-" != attribute.name.substring(0, 5)) continue;
                var key = attribute.name.substring(5).replace(/\-([a-z])/g, function(all, ch) {
                    return ch.toUpperCase();
                });
                dataset[key] = attribute.value;
            }
            Object.defineProperty(this, "_dataset", {
                value: dataset,
                writable: false,
                enumerable: false
            });
            return dataset;
        },
        enumerable: true
    });
})();

(function() {
    function changeList(element, itemName, add, remove) {
        var s = element.className || "";
        var list = s.split(/\s+/g);
        "" === list[0] && list.shift();
        var index = list.indexOf(itemName);
        0 > index && add && list.push(itemName);
        index >= 0 && remove && list.splice(index, 1);
        element.className = list.join(" ");
    }
    var div = document.createElement("div");
    if ("classList" in div) return;
    var classListPrototype = {
        add: function(name) {
            changeList(this.element, name, true, false);
        },
        remove: function(name) {
            changeList(this.element, name, false, true);
        },
        toggle: function(name) {
            changeList(this.element, name, true, true);
        }
    };
    Object.defineProperty(HTMLElement.prototype, "classList", {
        get: function() {
            if (this._classList) return this._classList;
            var classList = Object.create(classListPrototype, {
                element: {
                    value: this,
                    writable: false,
                    enumerable: true
                }
            });
            Object.defineProperty(this, "_classList", {
                value: classList,
                writable: false,
                enumerable: false
            });
            return classList;
        },
        enumerable: true
    });
})();

(function() {
    if ("console" in window) {
        if (!("bind" in console.log)) {
            console.log = function(fn) {
                return function(msg) {
                    return fn(msg);
                };
            }(console.log);
            console.error = function(fn) {
                return function(msg) {
                    return fn(msg);
                };
            }(console.error);
            console.warn = function(fn) {
                return function(msg) {
                    return fn(msg);
                };
            }(console.warn);
        }
    } else window.console = {
        log: function() {},
        error: function() {},
        warn: function() {}
    };
})();

(function() {
    function ignoreIfTargetDisabled(event) {
        isDisabled(event.target) && event.stopPropagation();
    }
    function isDisabled(node) {
        return node.disabled || node.parentNode && isDisabled(node.parentNode);
    }
    -1 != navigator.userAgent.indexOf("Opera") && document.addEventListener("click", ignoreIfTargetDisabled, true);
})();

(function() {
    if ("language" in navigator) return;
    Object.defineProperty(navigator, "language", {
        get: function() {
            var language = navigator.userLanguage || "en-US";
            return language.substring(0, 2).toLowerCase() + language.substring(2).toUpperCase();
        },
        enumerable: true
    });
})();

(function() {
    var isSafari = Object.prototype.toString.call(window.HTMLElement).indexOf("Constructor") > 0;
    var regex = /Android\s[0-2][^\d]/;
    var isOldAndroid = regex.test(navigator.userAgent);
    (isSafari || isOldAndroid) && (PDFJS.disableRange = true);
})();

(function() {
    window.history.pushState || (PDFJS.disableHistory = true);
})();