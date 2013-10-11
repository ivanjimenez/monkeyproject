"undefined" == typeof PDFJS && (("undefined" != typeof window ? window : this).PDFJS = {});

PDFJS.version = "0.8.595";

PDFJS.build = "6f61a9c";

(function() {
    "use strict";
    function info(msg) {
        if (verbosity >= INFOS) {
            log("Info: " + msg);
            PDFJS.LogManager.notify("info", msg);
        }
    }
    function warn(msg) {
        if (verbosity >= WARNINGS) {
            log("Warning: " + msg);
            PDFJS.LogManager.notify("warn", msg);
        }
    }
    function error(msg) {
        if (arguments.length > 1) {
            var logArguments = [ "Error:" ];
            logArguments.push.apply(logArguments, arguments);
            log.apply(null, logArguments);
            msg = [].join.call(arguments, " ");
        } else log("Error: " + msg);
        log(backtrace());
        PDFJS.LogManager.notify("error", msg);
        throw new Error(msg);
    }
    function TODO(what) {
        warn("TODO: " + what);
    }
    function backtrace() {
        try {
            throw new Error();
        } catch (e) {
            return e.stack ? e.stack.split("\n").slice(2).join("\n") : "";
        }
    }
    function assert(cond, msg) {
        cond || error(msg);
    }
    function combineUrl(baseUrl, url) {
        if (!url) return baseUrl;
        if (url.indexOf(":") >= 0) return url;
        if ("/" == url.charAt(0)) {
            var i = baseUrl.indexOf("://");
            i = baseUrl.indexOf("/", i + 3);
            return baseUrl.substring(0, i) + url;
        }
        var i, pathLength = baseUrl.length;
        i = baseUrl.lastIndexOf("#");
        pathLength = i >= 0 ? i : pathLength;
        i = baseUrl.lastIndexOf("?", pathLength);
        pathLength = i >= 0 ? i : pathLength;
        var prefixLength = baseUrl.lastIndexOf("/", pathLength);
        return baseUrl.substring(0, prefixLength + 1) + url;
    }
    function isValidUrl(url, allowRelative) {
        if (!url) return false;
        var colon = url.indexOf(":");
        if (0 > colon) return allowRelative;
        var protocol = url.substr(0, colon);
        switch (protocol) {
          case "http":
          case "https":
          case "ftp":
          case "mailto":
            return true;

          default:
            return false;
        }
    }
    function shadow(obj, prop, value) {
        Object.defineProperty(obj, prop, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: false
        });
        return value;
    }
    function bytesToString(bytes) {
        var str = "";
        var length = bytes.length;
        for (var n = 0; length > n; ++n) str += String.fromCharCode(bytes[n]);
        return str;
    }
    function stringToBytes(str) {
        var length = str.length;
        var bytes = new Uint8Array(length);
        for (var n = 0; length > n; ++n) bytes[n] = 255 & str.charCodeAt(n);
        return bytes;
    }
    function stringToPDFString(str) {
        var i, n = str.length, str2 = "";
        if ("þ" === str[0] && "ÿ" === str[1]) for (i = 2; n > i; i += 2) str2 += String.fromCharCode(str.charCodeAt(i) << 8 | str.charCodeAt(i + 1)); else for (i = 0; n > i; ++i) {
            var code = PDFStringTranslateTable[str.charCodeAt(i)];
            str2 += code ? String.fromCharCode(code) : str.charAt(i);
        }
        return str2;
    }
    function isBool(v) {
        return "boolean" == typeof v;
    }
    function isNum(v) {
        return "number" == typeof v;
    }
    function isString(v) {
        return "string" == typeof v;
    }
    function isName(v) {
        return v instanceof Name;
    }
    function isDict(v, type) {
        if (!(v instanceof Dict)) return false;
        if (!type) return true;
        var dictType = v.get("Type");
        return isName(dictType) && dictType.name == type;
    }
    function isArray(v) {
        return v instanceof Array;
    }
    function isStream(v) {
        return "object" == typeof v && null !== v && void 0 !== v && "getBytes" in v;
    }
    function isArrayBuffer(v) {
        return "object" == typeof v && null !== v && void 0 !== v && "byteLength" in v;
    }
    function isPDFFunction(v) {
        var fnDict;
        if ("object" != typeof v) return false;
        if (isDict(v)) fnDict = v; else {
            if (!isStream(v)) return false;
            fnDict = v.dict;
        }
        return fnDict.has("FunctionType");
    }
    function MessageHandler(name, comObj) {
        this.name = name;
        this.comObj = comObj;
        this.callbackIndex = 1;
        var callbacks = this.callbacks = {};
        var ah = this.actionHandler = {};
        ah["console_log"] = [ function(data) {
            log.apply(null, data);
        } ];
        ah["console_error"] = "console" in globalScope ? [ function(data) {
            globalScope["console"].error.apply(null, data);
        } ] : [ function(data) {
            log.apply(null, data);
        } ];
        ah["_warn"] = [ function(data) {
            warn(data);
        } ];
        comObj.onmessage = function(event) {
            var data = event.data;
            if (data.isReply) {
                var callbackId = data.callbackId;
                if (data.callbackId in callbacks) {
                    var callback = callbacks[callbackId];
                    delete callbacks[callbackId];
                    callback(data.data);
                } else error("Cannot resolve callback " + callbackId);
            } else if (data.action in ah) {
                var action = ah[data.action];
                if (data.callbackId) {
                    var promise = new Promise();
                    promise.then(function(resolvedData) {
                        comObj.postMessage({
                            isReply: true,
                            callbackId: data.callbackId,
                            data: resolvedData
                        });
                    });
                    action[0].call(action[1], data.data, promise);
                } else action[0].call(action[1], data.data);
            } else error("Unkown action from worker: " + data.action);
        };
    }
    function loadJpegStream(id, imageData, objs) {
        var img = new Image();
        img.onload = function() {
            objs.resolve(id, img);
        };
        img.src = "data:image/jpeg;base64," + window.btoa(imageData);
    }
    function createScratchCanvas(width, height) {
        var canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }
    function addContextCurrentTransform(ctx) {
        if (!ctx.mozCurrentTransform) {
            ctx._scaleX = ctx._scaleX || 1;
            ctx._scaleY = ctx._scaleY || 1;
            ctx._originalSave = ctx.save;
            ctx._originalRestore = ctx.restore;
            ctx._originalRotate = ctx.rotate;
            ctx._originalScale = ctx.scale;
            ctx._originalTranslate = ctx.translate;
            ctx._originalTransform = ctx.transform;
            ctx._originalSetTransform = ctx.setTransform;
            ctx._transformMatrix = [ ctx._scaleX, 0, 0, ctx._scaleY, 0, 0 ];
            ctx._transformStack = [];
            Object.defineProperty(ctx, "mozCurrentTransform", {
                get: function() {
                    return this._transformMatrix;
                }
            });
            Object.defineProperty(ctx, "mozCurrentTransformInverse", {
                get: function() {
                    var m = this._transformMatrix;
                    var a = m[0], b = m[1], c = m[2], d = m[3], e = m[4], f = m[5];
                    var ad_bc = a * d - b * c;
                    var bc_ad = b * c - a * d;
                    return [ d / ad_bc, b / bc_ad, c / bc_ad, a / ad_bc, (d * e - c * f) / bc_ad, (b * e - a * f) / ad_bc ];
                }
            });
            ctx.save = function() {
                var old = this._transformMatrix;
                this._transformStack.push(old);
                this._transformMatrix = old.slice(0, 6);
                this._originalSave();
            };
            ctx.restore = function() {
                var prev = this._transformStack.pop();
                if (prev) {
                    this._transformMatrix = prev;
                    this._originalRestore();
                }
            };
            ctx.translate = function(x, y) {
                var m = this._transformMatrix;
                m[4] = m[0] * x + m[2] * y + m[4];
                m[5] = m[1] * x + m[3] * y + m[5];
                this._originalTranslate(x, y);
            };
            ctx.scale = function(x, y) {
                var m = this._transformMatrix;
                m[0] = m[0] * x;
                m[1] = m[1] * x;
                m[2] = m[2] * y;
                m[3] = m[3] * y;
                this._originalScale(x, y);
            };
            ctx.transform = function(a, b, c, d, e, f) {
                var m = this._transformMatrix;
                this._transformMatrix = [ m[0] * a + m[2] * b, m[1] * a + m[3] * b, m[0] * c + m[2] * d, m[1] * c + m[3] * d, m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5] ];
                ctx._originalTransform(a, b, c, d, e, f);
            };
            ctx.setTransform = function(a, b, c, d, e, f) {
                this._transformMatrix = [ a, b, c, d, e, f ];
                ctx._originalSetTransform(a, b, c, d, e, f);
            };
            ctx.rotate = function(angle) {
                var cosValue = Math.cos(angle);
                var sinValue = Math.sin(angle);
                var m = this._transformMatrix;
                this._transformMatrix = [ m[0] * cosValue + m[2] * sinValue, m[1] * cosValue + m[3] * sinValue, m[0] * -sinValue + m[2] * cosValue, m[1] * -sinValue + m[3] * cosValue, m[4], m[5] ];
                this._originalRotate(angle);
            };
        }
    }
    function compileType3Glyph(imgData) {
        var POINT_TO_PROCESS_LIMIT = 1e3;
        var width = imgData.width, height = imgData.height;
        var i, j, j0, width1 = width + 1;
        var points = new Uint8Array(width1 * (height + 1));
        var POINT_TYPES = new Uint8Array([ 0, 2, 4, 0, 1, 0, 5, 4, 8, 10, 0, 8, 0, 2, 1, 0 ]);
        var pos = 3, data = imgData.data, lineSize = 4 * width, count = 0;
        if (0 !== data[3]) {
            points[0] = 1;
            ++count;
        }
        for (j = 1; width > j; j++) {
            if (data[pos] !== data[pos + 4]) {
                points[j] = data[pos] ? 2 : 1;
                ++count;
            }
            pos += 4;
        }
        if (0 !== data[pos]) {
            points[j] = 2;
            ++count;
        }
        pos += 4;
        for (i = 1; height > i; i++) {
            j0 = i * width1;
            if (data[pos - lineSize] !== data[pos]) {
                points[j0] = data[pos] ? 1 : 8;
                ++count;
            }
            var sum = (data[pos] ? 4 : 0) + (data[pos - lineSize] ? 8 : 0);
            for (j = 1; width > j; j++) {
                sum = (sum >> 2) + (data[pos + 4] ? 4 : 0) + (data[pos - lineSize + 4] ? 8 : 0);
                if (POINT_TYPES[sum]) {
                    points[j0 + j] = POINT_TYPES[sum];
                    ++count;
                }
                pos += 4;
            }
            if (data[pos - lineSize] !== data[pos]) {
                points[j0 + j] = data[pos] ? 2 : 4;
                ++count;
            }
            pos += 4;
            if (count > POINT_TO_PROCESS_LIMIT) return null;
        }
        pos -= lineSize;
        j0 = i * width1;
        if (0 !== data[pos]) {
            points[j0] = 8;
            ++count;
        }
        for (j = 1; width > j; j++) {
            if (data[pos] !== data[pos + 4]) {
                points[j0 + j] = data[pos] ? 4 : 8;
                ++count;
            }
            pos += 4;
        }
        if (0 !== data[pos]) {
            points[j0 + j] = 4;
            ++count;
        }
        if (count > POINT_TO_PROCESS_LIMIT) return null;
        var steps = new Int32Array([ 0, width1, -1, 0, -width1, 0, 0, 0, 1 ]);
        var outlines = [];
        for (i = 0; count && height >= i; i++) {
            var p = i * width1;
            var end = p + width;
            while (end > p && !points[p]) p++;
            if (p === end) continue;
            var coords = [ p % width1, i ];
            var pp, type = points[p], p0 = p;
            do {
                var step = steps[type];
                do p += step; while (!points[p]);
                pp = points[p];
                if (5 !== pp && 10 !== pp) {
                    type = pp;
                    points[p] = 0;
                } else {
                    type = pp & 51 * type >> 4;
                    points[p] &= type >> 2 | type << 2;
                }
                coords.push(p % width1);
                coords.push(0 | p / width1);
                --count;
            } while (p0 !== p);
            outlines.push(coords);
            --i;
        }
        var drawOutline = function(c) {
            c.save();
            c.scale(1 / width, -1 / height);
            c.translate(0, -height);
            c.beginPath();
            for (var i = 0, ii = outlines.length; ii > i; i++) {
                var o = outlines[i];
                c.moveTo(o[0], o[1]);
                for (var j = 2, jj = o.length; jj > j; j += 2) c.lineTo(o[j], o[j + 1]);
            }
            c.fill();
            c.beginPath();
            c.restore();
        };
        return drawOutline;
    }
    var globalScope = "undefined" == typeof window ? this : window;
    var isWorker = "undefined" == typeof window;
    var WARNINGS = 1, INFOS = 5;
    var verbosity = WARNINGS;
    var FONT_IDENTITY_MATRIX = [ .001, 0, 0, .001, 0, 0 ];
    var TextRenderingMode = {
        FILL: 0,
        STROKE: 1,
        FILL_STROKE: 2,
        INVISIBLE: 3,
        FILL_ADD_TO_PATH: 4,
        STROKE_ADD_TO_PATH: 5,
        FILL_STROKE_ADD_TO_PATH: 6,
        ADD_TO_PATH: 7,
        FILL_STROKE_MASK: 3,
        ADD_TO_PATH_FLAG: 4
    };
    globalScope.PDFJS || (globalScope.PDFJS = {});
    globalScope.PDFJS.pdfBug = false;
    var log = function() {
        return "console" in globalScope && "log" in globalScope["console"] ? globalScope["console"]["log"].bind(globalScope["console"]) : function() {};
    }();
    PDFJS.isValidUrl = isValidUrl;
    PDFJS.LogManager = function() {
        var loggers = [];
        return {
            addLogger: function(logger) {
                loggers.push(logger);
            },
            notify: function(type, message) {
                for (var i = 0, ii = loggers.length; ii > i; i++) {
                    var logger = loggers[i];
                    logger[type] && logger[type](message);
                }
            }
        };
    }();
    var PasswordResponses = PDFJS.PasswordResponses = {
        NEED_PASSWORD: 1,
        INCORRECT_PASSWORD: 2
    };
    (function() {
        function PasswordException(msg, code) {
            this.name = "PasswordException";
            this.message = msg;
            this.code = code;
        }
        PasswordException.prototype = new Error();
        PasswordException.constructor = PasswordException;
        return PasswordException;
    })();
    (function() {
        function UnknownErrorException(msg, details) {
            this.name = "UnknownErrorException";
            this.message = msg;
            this.details = details;
        }
        UnknownErrorException.prototype = new Error();
        UnknownErrorException.constructor = UnknownErrorException;
        return UnknownErrorException;
    })();
    (function() {
        function InvalidPDFException(msg) {
            this.name = "InvalidPDFException";
            this.message = msg;
        }
        InvalidPDFException.prototype = new Error();
        InvalidPDFException.constructor = InvalidPDFException;
        return InvalidPDFException;
    })();
    (function() {
        function MissingPDFException(msg) {
            this.name = "MissingPDFException";
            this.message = msg;
        }
        MissingPDFException.prototype = new Error();
        MissingPDFException.constructor = MissingPDFException;
        return MissingPDFException;
    })();
    var NotImplementedException = function() {
        function NotImplementedException(msg) {
            this.message = msg;
        }
        NotImplementedException.prototype = new Error();
        NotImplementedException.prototype.name = "NotImplementedException";
        NotImplementedException.constructor = NotImplementedException;
        return NotImplementedException;
    }();
    (function() {
        function MissingDataException(begin, end) {
            this.begin = begin;
            this.end = end;
            this.message = "Missing data [begin, end)";
        }
        MissingDataException.prototype = new Error();
        MissingDataException.prototype.name = "MissingDataException";
        MissingDataException.constructor = MissingDataException;
        return MissingDataException;
    })();
    (function() {
        function XRefParseException(msg) {
            this.message = msg;
        }
        XRefParseException.prototype = new Error();
        XRefParseException.prototype.name = "XRefParseException";
        XRefParseException.constructor = XRefParseException;
        return XRefParseException;
    })();
    var IDENTITY_MATRIX = [ 1, 0, 0, 1, 0, 0 ];
    var Util = PDFJS.Util = function() {
        function Util() {}
        Util.makeCssRgb = function(rgb) {
            return "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")";
        };
        Util.makeCssCmyk = function(cmyk) {
            var rgb = ColorSpace.singletons.cmyk.getRgb(cmyk, 0);
            return Util.makeCssRgb(rgb);
        };
        Util.transform = function(m1, m2) {
            return [ m1[0] * m2[0] + m1[2] * m2[1], m1[1] * m2[0] + m1[3] * m2[1], m1[0] * m2[2] + m1[2] * m2[3], m1[1] * m2[2] + m1[3] * m2[3], m1[0] * m2[4] + m1[2] * m2[5] + m1[4], m1[1] * m2[4] + m1[3] * m2[5] + m1[5] ];
        };
        Util.applyTransform = function(p, m) {
            var xt = p[0] * m[0] + p[1] * m[2] + m[4];
            var yt = p[0] * m[1] + p[1] * m[3] + m[5];
            return [ xt, yt ];
        };
        Util.applyInverseTransform = function(p, m) {
            var d = m[0] * m[3] - m[1] * m[2];
            var xt = (p[0] * m[3] - p[1] * m[2] + m[2] * m[5] - m[4] * m[3]) / d;
            var yt = (-p[0] * m[1] + p[1] * m[0] + m[4] * m[1] - m[5] * m[0]) / d;
            return [ xt, yt ];
        };
        Util.getAxialAlignedBoundingBox = function(r, m) {
            var p1 = Util.applyTransform(r, m);
            var p2 = Util.applyTransform(r.slice(2, 4), m);
            var p3 = Util.applyTransform([ r[0], r[3] ], m);
            var p4 = Util.applyTransform([ r[2], r[1] ], m);
            return [ Math.min(p1[0], p2[0], p3[0], p4[0]), Math.min(p1[1], p2[1], p3[1], p4[1]), Math.max(p1[0], p2[0], p3[0], p4[0]), Math.max(p1[1], p2[1], p3[1], p4[1]) ];
        };
        Util.inverseTransform = function(m) {
            var d = m[0] * m[3] - m[1] * m[2];
            return [ m[3] / d, -m[1] / d, -m[2] / d, m[0] / d, (m[2] * m[5] - m[4] * m[3]) / d, (m[4] * m[1] - m[5] * m[0]) / d ];
        };
        Util.apply3dTransform = function(m, v) {
            return [ m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2] ];
        };
        Util.singularValueDecompose2dScale = function(m) {
            var transpose = [ m[0], m[2], m[1], m[3] ];
            var a = m[0] * transpose[0] + m[1] * transpose[2];
            var b = m[0] * transpose[1] + m[1] * transpose[3];
            var c = m[2] * transpose[0] + m[3] * transpose[2];
            var d = m[2] * transpose[1] + m[3] * transpose[3];
            var first = (a + d) / 2;
            var second = Math.sqrt((a + d) * (a + d) - 4 * (a * d - c * b)) / 2;
            var sx = first + second || 1;
            var sy = first - second || 1;
            return [ Math.sqrt(sx), Math.sqrt(sy) ];
        };
        Util.normalizeRect = function(rect) {
            var r = rect.slice(0);
            if (rect[0] > rect[2]) {
                r[0] = rect[2];
                r[2] = rect[0];
            }
            if (rect[1] > rect[3]) {
                r[1] = rect[3];
                r[3] = rect[1];
            }
            return r;
        };
        Util.intersect = function(rect1, rect2) {
            function compare(a, b) {
                return a - b;
            }
            var orderedX = [ rect1[0], rect1[2], rect2[0], rect2[2] ].sort(compare), orderedY = [ rect1[1], rect1[3], rect2[1], rect2[3] ].sort(compare), result = [];
            rect1 = Util.normalizeRect(rect1);
            rect2 = Util.normalizeRect(rect2);
            if (!(orderedX[0] === rect1[0] && orderedX[1] === rect2[0] || orderedX[0] === rect2[0] && orderedX[1] === rect1[0])) return false;
            result[0] = orderedX[1];
            result[2] = orderedX[2];
            if (!(orderedY[0] === rect1[1] && orderedY[1] === rect2[1] || orderedY[0] === rect2[1] && orderedY[1] === rect1[1])) return false;
            result[1] = orderedY[1];
            result[3] = orderedY[2];
            return result;
        };
        Util.sign = function(num) {
            return 0 > num ? -1 : 1;
        };
        Util.concatenateToArray = function(arr1, arr2) {
            Array.prototype.push.apply(arr1, arr2);
        };
        Util.prependToArray = function(arr1, arr2) {
            Array.prototype.unshift.apply(arr1, arr2);
        };
        Util.extendObj = function(obj1, obj2) {
            for (var key in obj2) obj1[key] = obj2[key];
        };
        Util.getInheritableProperty = function(dict, name) {
            while (dict && !dict.has(name)) dict = dict.get("Parent");
            if (!dict) return null;
            return dict.get(name);
        };
        Util.inherit = function(sub, base, prototype) {
            sub.prototype = Object.create(base.prototype);
            sub.prototype.constructor = sub;
            for (var prop in prototype) sub.prototype[prop] = prototype[prop];
        };
        Util.loadScript = function(src, callback) {
            var script = document.createElement("script");
            var loaded = false;
            script.setAttribute("src", src);
            callback && (script.onload = function() {
                loaded || callback();
                loaded = true;
            });
            document.getElementsByTagName("head")[0].appendChild(script);
        };
        return Util;
    }();
    PDFJS.PageViewport = function() {
        function PageViewport(viewBox, scale, rotation, offsetX, offsetY, dontFlip) {
            this.viewBox = viewBox;
            this.scale = scale;
            this.rotation = rotation;
            this.offsetX = offsetX;
            this.offsetY = offsetY;
            var centerX = (viewBox[2] + viewBox[0]) / 2;
            var centerY = (viewBox[3] + viewBox[1]) / 2;
            var rotateA, rotateB, rotateC, rotateD;
            rotation %= 360;
            rotation = 0 > rotation ? rotation + 360 : rotation;
            switch (rotation) {
              case 180:
                rotateA = -1;
                rotateB = 0;
                rotateC = 0;
                rotateD = 1;
                break;

              case 90:
                rotateA = 0;
                rotateB = 1;
                rotateC = 1;
                rotateD = 0;
                break;

              case 270:
                rotateA = 0;
                rotateB = -1;
                rotateC = -1;
                rotateD = 0;
                break;

              default:
                rotateA = 1;
                rotateB = 0;
                rotateC = 0;
                rotateD = -1;
            }
            if (dontFlip) {
                rotateC = -rotateC;
                rotateD = -rotateD;
            }
            var offsetCanvasX, offsetCanvasY;
            var width, height;
            if (0 === rotateA) {
                offsetCanvasX = Math.abs(centerY - viewBox[1]) * scale + offsetX;
                offsetCanvasY = Math.abs(centerX - viewBox[0]) * scale + offsetY;
                width = Math.abs(viewBox[3] - viewBox[1]) * scale;
                height = Math.abs(viewBox[2] - viewBox[0]) * scale;
            } else {
                offsetCanvasX = Math.abs(centerX - viewBox[0]) * scale + offsetX;
                offsetCanvasY = Math.abs(centerY - viewBox[1]) * scale + offsetY;
                width = Math.abs(viewBox[2] - viewBox[0]) * scale;
                height = Math.abs(viewBox[3] - viewBox[1]) * scale;
            }
            this.transform = [ rotateA * scale, rotateB * scale, rotateC * scale, rotateD * scale, offsetCanvasX - rotateA * scale * centerX - rotateC * scale * centerY, offsetCanvasY - rotateB * scale * centerX - rotateD * scale * centerY ];
            this.width = width;
            this.height = height;
            this.fontScale = scale;
        }
        PageViewport.prototype = {
            clone: function(args) {
                args = args || {};
                var scale = "scale" in args ? args.scale : this.scale;
                var rotation = "rotation" in args ? args.rotation : this.rotation;
                return new PageViewport(this.viewBox.slice(), scale, rotation, this.offsetX, this.offsetY, args.dontFlip);
            },
            convertToViewportPoint: function(x, y) {
                return Util.applyTransform([ x, y ], this.transform);
            },
            convertToViewportRectangle: function(rect) {
                var tl = Util.applyTransform([ rect[0], rect[1] ], this.transform);
                var br = Util.applyTransform([ rect[2], rect[3] ], this.transform);
                return [ tl[0], tl[1], br[0], br[1] ];
            },
            convertToPdfPoint: function(x, y) {
                return Util.applyInverseTransform([ x, y ], this.transform);
            }
        };
        return PageViewport;
    }();
    var PDFStringTranslateTable = [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 728, 711, 710, 729, 733, 731, 730, 732, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8226, 8224, 8225, 8230, 8212, 8211, 402, 8260, 8249, 8250, 8722, 8240, 8222, 8220, 8221, 8216, 8217, 8218, 8482, 64257, 64258, 321, 338, 352, 376, 381, 305, 322, 339, 353, 382, 0, 8364 ];
    var Promise = PDFJS.Promise = function() {
        function Promise() {
            this._status = STATUS_PENDING;
            this._handlers = [];
        }
        var STATUS_PENDING = 0;
        var STATUS_RESOLVED = 1;
        var STATUS_REJECTED = 2;
        var REJECTION_TIMEOUT = 500;
        var HandlerManager = {
            handlers: [],
            running: false,
            unhandledRejections: [],
            pendingRejectionCheck: false,
            scheduleHandlers: function(promise) {
                if (promise._status == STATUS_PENDING) return;
                this.handlers = this.handlers.concat(promise._handlers);
                promise._handlers = [];
                if (this.running) return;
                this.running = true;
                setTimeout(this.runHandlers.bind(this), 0);
            },
            runHandlers: function() {
                while (this.handlers.length > 0) {
                    var handler = this.handlers.shift();
                    var nextStatus = handler.thisPromise._status;
                    var nextValue = handler.thisPromise._value;
                    try {
                        if (nextStatus === STATUS_RESOLVED) "function" == typeof handler.onResolve && (nextValue = handler.onResolve(nextValue)); else if ("function" == typeof handler.onReject) {
                            nextValue = handler.onReject(nextValue);
                            nextStatus = STATUS_RESOLVED;
                            handler.thisPromise._unhandledRejection && this.removeUnhandeledRejection(handler.thisPromise);
                        }
                    } catch (ex) {
                        nextStatus = STATUS_REJECTED;
                        nextValue = ex;
                    }
                    handler.nextPromise._updateStatus(nextStatus, nextValue);
                }
                this.running = false;
            },
            addUnhandledRejection: function(promise) {
                this.unhandledRejections.push({
                    promise: promise,
                    time: Date.now()
                });
                this.scheduleRejectionCheck();
            },
            removeUnhandeledRejection: function(promise) {
                promise._unhandledRejection = false;
                for (var i = 0; this.unhandledRejections.length > i; i++) if (this.unhandledRejections[i].promise === promise) {
                    this.unhandledRejections.splice(i);
                    i--;
                }
            },
            scheduleRejectionCheck: function() {
                if (this.pendingRejectionCheck) return;
                this.pendingRejectionCheck = true;
                setTimeout(function() {
                    this.pendingRejectionCheck = false;
                    var now = Date.now();
                    for (var i = 0; this.unhandledRejections.length > i; i++) if (now - this.unhandledRejections[i].time > REJECTION_TIMEOUT) {
                        var unhandled = this.unhandledRejections[i].promise._value;
                        var msg = "Unhandled rejection: " + unhandled;
                        unhandled.stack && (msg += "\n" + unhandled.stack);
                        warn(msg);
                        this.unhandledRejections.splice(i);
                        i--;
                    }
                    this.unhandledRejections.length && this.scheduleRejectionCheck();
                }.bind(this), REJECTION_TIMEOUT);
            }
        };
        Promise.all = function(promises) {
            function reject(reason) {
                if (deferred._status === STATUS_REJECTED) return;
                results = [];
                deferred.reject(reason);
            }
            var deferred = new Promise();
            var unresolved = promises.length;
            var results = [];
            if (0 === unresolved) {
                deferred.resolve(results);
                return deferred;
            }
            for (var i = 0, ii = promises.length; ii > i; ++i) {
                var promise = promises[i];
                promise.then(function(i) {
                    return function(value) {
                        if (deferred._status === STATUS_REJECTED) return;
                        results[i] = value;
                        unresolved--;
                        0 === unresolved && deferred.resolve(results);
                    };
                }(i), reject);
            }
            return deferred;
        };
        Promise.prototype = {
            _status: null,
            _value: null,
            _handlers: null,
            _unhandledRejection: null,
            _updateStatus: function(status, value) {
                if (this._status === STATUS_RESOLVED || this._status === STATUS_REJECTED) return;
                if (status == STATUS_RESOLVED && value && "function" == typeof value.then) {
                    value.then(this._updateStatus.bind(this, STATUS_RESOLVED), this._updateStatus.bind(this, STATUS_REJECTED));
                    return;
                }
                this._status = status;
                this._value = value;
                if (status === STATUS_REJECTED && 0 === this._handlers.length) {
                    this._unhandledRejection = true;
                    HandlerManager.addUnhandledRejection(this);
                }
                HandlerManager.scheduleHandlers(this);
            },
            get isResolved() {
                return this._status === STATUS_RESOLVED;
            },
            get isRejected() {
                return this._status === STATUS_REJECTED;
            },
            resolve: function(value) {
                this._updateStatus(STATUS_RESOLVED, value);
            },
            reject: function(reason) {
                this._updateStatus(STATUS_REJECTED, reason);
            },
            then: function(onResolve, onReject) {
                var nextPromise = new Promise();
                this._handlers.push({
                    thisPromise: this,
                    onResolve: onResolve,
                    onReject: onReject,
                    nextPromise: nextPromise
                });
                HandlerManager.scheduleHandlers(this);
                return nextPromise;
            }
        };
        return Promise;
    }();
    var StatTimer = function() {
        function rpad(str, pad, length) {
            while (length > str.length) str += pad;
            return str;
        }
        function StatTimer() {
            this.started = {};
            this.times = [];
            this.enabled = true;
        }
        StatTimer.prototype = {
            time: function(name) {
                if (!this.enabled) return;
                name in this.started && warn("Timer is already running for " + name);
                this.started[name] = Date.now();
            },
            timeEnd: function(name) {
                if (!this.enabled) return;
                name in this.started || warn("Timer has not been started for " + name);
                this.times.push({
                    name: name,
                    start: this.started[name],
                    end: Date.now()
                });
                delete this.started[name];
            },
            toString: function() {
                var times = this.times;
                var out = "";
                var longest = 0;
                for (var i = 0, ii = times.length; ii > i; ++i) {
                    var name = times[i]["name"];
                    name.length > longest && (longest = name.length);
                }
                for (var i = 0, ii = times.length; ii > i; ++i) {
                    var span = times[i];
                    var duration = span.end - span.start;
                    out += rpad(span["name"], " ", longest) + " " + duration + "ms\n";
                }
                return out;
            }
        };
        return StatTimer;
    }();
    PDFJS.createBlob = function(data, contentType) {
        if ("function" == typeof Blob) return new Blob([ data ], {
            type: contentType
        });
        var bb = new MozBlobBuilder();
        bb.append(data);
        return bb.getBlob(contentType);
    };
    MessageHandler.prototype = {
        on: function(actionName, handler, scope) {
            var ah = this.actionHandler;
            ah[actionName] && error('There is already an actionName called "' + actionName + '"');
            ah[actionName] = [ handler, scope ];
        },
        send: function(actionName, data, callback) {
            var message = {
                action: actionName,
                data: data
            };
            if (callback) {
                var callbackId = this.callbackIndex++;
                this.callbacks[callbackId] = callback;
                message.callbackId = callbackId;
            }
            this.comObj.postMessage(message);
        }
    };
    var ColorSpace = function() {
        function ColorSpace() {
            error("should not call ColorSpace constructor");
        }
        ColorSpace.prototype = {
            getRgb: function() {
                error("Should not call ColorSpace.getRgb");
            },
            getRgbItem: function() {
                error("Should not call ColorSpace.getRgbItem");
            },
            getRgbBuffer: function() {
                error("Should not call ColorSpace.getRgbBuffer");
            },
            getOutputLength: function() {
                error("Should not call ColorSpace.getOutputLength");
            },
            isPassthrough: function() {
                return false;
            },
            createRgbBuffer: function(src, srcOffset, count, bits) {
                if (this.isPassthrough(bits)) return src.subarray(srcOffset);
                var dest = new Uint8Array(3 * count);
                var numComponentColors = 1 << bits;
                if (1 === this.numComps && count > numComponentColors && "DeviceGray" !== this.name && "DeviceRGB" !== this.name) {
                    var allColors = 8 >= bits ? new Uint8Array(numComponentColors) : new Uint16Array(numComponentColors);
                    for (var i = 0; numComponentColors > i; i++) allColors[i] = i;
                    var colorMap = new Uint8Array(3 * numComponentColors);
                    this.getRgbBuffer(allColors, 0, numComponentColors, colorMap, 0, bits);
                    var destOffset = 0;
                    for (var i = 0; count > i; ++i) {
                        var key = 3 * src[srcOffset++];
                        dest[destOffset++] = colorMap[key];
                        dest[destOffset++] = colorMap[key + 1];
                        dest[destOffset++] = colorMap[key + 2];
                    }
                    return dest;
                }
                this.getRgbBuffer(src, srcOffset, count, dest, 0, bits);
                return dest;
            },
            usesZeroToOneRange: true
        };
        ColorSpace.parse = function(cs, xref, res) {
            var IR = ColorSpace.parseToIR(cs, xref, res);
            if (IR instanceof AlternateCS) return IR;
            return ColorSpace.fromIR(IR);
        };
        ColorSpace.fromIR = function(IR) {
            var name = isArray(IR) ? IR[0] : IR;
            switch (name) {
              case "DeviceGrayCS":
                return this.singletons.gray;

              case "DeviceRgbCS":
                return this.singletons.rgb;

              case "DeviceCmykCS":
                return this.singletons.cmyk;

              case "PatternCS":
                var basePatternCS = IR[1];
                basePatternCS && (basePatternCS = ColorSpace.fromIR(basePatternCS));
                return new PatternCS(basePatternCS);

              case "IndexedCS":
                var baseIndexedCS = IR[1];
                var hiVal = IR[2];
                var lookup = IR[3];
                return new IndexedCS(ColorSpace.fromIR(baseIndexedCS), hiVal, lookup);

              case "AlternateCS":
                var numComps = IR[1];
                var alt = IR[2];
                var tintFnIR = IR[3];
                return new AlternateCS(numComps, ColorSpace.fromIR(alt), PDFFunction.fromIR(tintFnIR));

              case "LabCS":
                var whitePoint = IR[1].WhitePoint;
                var blackPoint = IR[1].BlackPoint;
                var range = IR[1].Range;
                return new LabCS(whitePoint, blackPoint, range);

              default:
                error("Unkown name " + name);
            }
            return null;
        };
        ColorSpace.parseToIR = function(cs, xref, res) {
            if (isName(cs)) {
                var colorSpaces = res.get("ColorSpace");
                if (isDict(colorSpaces)) {
                    var refcs = colorSpaces.get(cs.name);
                    refcs && (cs = refcs);
                }
            }
            cs = xref.fetchIfRef(cs);
            var mode;
            if (isName(cs)) {
                mode = cs.name;
                this.mode = mode;
                switch (mode) {
                  case "DeviceGray":
                  case "G":
                    return "DeviceGrayCS";

                  case "DeviceRGB":
                  case "RGB":
                    return "DeviceRgbCS";

                  case "DeviceCMYK":
                  case "CMYK":
                    return "DeviceCmykCS";

                  case "Pattern":
                    return [ "PatternCS", null ];

                  default:
                    error("unrecognized colorspace " + mode);
                }
            } else if (isArray(cs)) {
                mode = cs[0].name;
                this.mode = mode;
                switch (mode) {
                  case "DeviceGray":
                  case "G":
                    return "DeviceGrayCS";

                  case "DeviceRGB":
                  case "RGB":
                    return "DeviceRgbCS";

                  case "DeviceCMYK":
                  case "CMYK":
                    return "DeviceCmykCS";

                  case "CalGray":
                    return "DeviceGrayCS";

                  case "CalRGB":
                    return "DeviceRgbCS";

                  case "ICCBased":
                    var stream = xref.fetchIfRef(cs[1]);
                    var dict = stream.dict;
                    var numComps = dict.get("N");
                    if (1 == numComps) return "DeviceGrayCS";
                    if (3 == numComps) return "DeviceRgbCS";
                    if (4 == numComps) return "DeviceCmykCS";
                    break;

                  case "Pattern":
                    var basePatternCS = cs[1];
                    basePatternCS && (basePatternCS = ColorSpace.parseToIR(basePatternCS, xref, res));
                    return [ "PatternCS", basePatternCS ];

                  case "Indexed":
                  case "I":
                    var baseIndexedCS = ColorSpace.parseToIR(cs[1], xref, res);
                    var hiVal = cs[2] + 1;
                    var lookup = xref.fetchIfRef(cs[3]);
                    isStream(lookup) && (lookup = lookup.getBytes());
                    return [ "IndexedCS", baseIndexedCS, hiVal, lookup ];

                  case "Separation":
                  case "DeviceN":
                    var name = cs[1];
                    var numComps = 1;
                    isName(name) ? numComps = 1 : isArray(name) && (numComps = name.length);
                    var alt = ColorSpace.parseToIR(cs[2], xref, res);
                    var tintFnIR = PDFFunction.getIR(xref, xref.fetchIfRef(cs[3]));
                    return [ "AlternateCS", numComps, alt, tintFnIR ];

                  case "Lab":
                    var params = cs[1].getAll();
                    return [ "LabCS", params ];

                  default:
                    error('unimplemented color space object "' + mode + '"');
                }
            } else error('unrecognized color space object: "' + cs + '"');
            return null;
        };
        ColorSpace.isDefaultDecode = function(decode, n) {
            if (!decode) return true;
            if (2 * n !== decode.length) {
                warn("The decode map is not the correct length");
                return true;
            }
            for (var i = 0, ii = decode.length; ii > i; i += 2) if (0 !== decode[i] || 1 != decode[i + 1]) return false;
            return true;
        };
        ColorSpace.singletons = {
            get gray() {
                return shadow(this, "gray", new DeviceGrayCS());
            },
            get rgb() {
                return shadow(this, "rgb", new DeviceRgbCS());
            },
            get cmyk() {
                return shadow(this, "cmyk", new DeviceCmykCS());
            }
        };
        return ColorSpace;
    }();
    var AlternateCS = function() {
        function AlternateCS(numComps, base, tintFn) {
            this.name = "Alternate";
            this.numComps = numComps;
            this.defaultColor = new Float32Array(numComps);
            for (var i = 0; numComps > i; ++i) this.defaultColor[i] = 1;
            this.base = base;
            this.tintFn = tintFn;
        }
        AlternateCS.prototype = {
            getRgb: function(src, srcOffset) {
                var rgb = new Uint8Array(3);
                this.getRgbItem(src, srcOffset, rgb, 0);
                return rgb;
            },
            getRgbItem: function(src, srcOffset, dest, destOffset) {
                this.base.numComps;
                var input = "subarray" in src ? src.subarray(srcOffset, srcOffset + this.numComps) : Array.prototype.slice.call(src, srcOffset, srcOffset + this.numComps);
                var tinted = this.tintFn(input);
                this.base.getRgbItem(tinted, 0, dest, destOffset);
            },
            getRgbBuffer: function(src, srcOffset, count, dest, destOffset, bits) {
                var tintFn = this.tintFn;
                var base = this.base;
                var scale = 1 / ((1 << bits) - 1);
                var baseNumComps = base.numComps;
                var usesZeroToOneRange = base.usesZeroToOneRange;
                var isPassthrough = base.isPassthrough(8) || !usesZeroToOneRange;
                var pos = isPassthrough ? destOffset : 0;
                var baseBuf = isPassthrough ? dest : new Uint8Array(baseNumComps * count);
                var numComps = this.numComps;
                var scaled = new Float32Array(numComps);
                for (var i = 0; count > i; i++) {
                    for (var j = 0; numComps > j; j++) scaled[j] = src[srcOffset++] * scale;
                    var tinted = tintFn(scaled);
                    if (usesZeroToOneRange) for (var j = 0; baseNumComps > j; j++) baseBuf[pos++] = 255 * tinted[j]; else {
                        base.getRgbItem(tinted, 0, baseBuf, pos);
                        pos += baseNumComps;
                    }
                }
                isPassthrough || base.getRgbBuffer(baseBuf, 0, count, dest, destOffset, 8);
            },
            getOutputLength: function(inputLength) {
                return this.base.getOutputLength(inputLength * this.base.numComps / this.numComps);
            },
            isPassthrough: ColorSpace.prototype.isPassthrough,
            createRgbBuffer: ColorSpace.prototype.createRgbBuffer,
            isDefaultDecode: function(decodeMap) {
                return ColorSpace.isDefaultDecode(decodeMap, this.numComps);
            },
            usesZeroToOneRange: true
        };
        return AlternateCS;
    }();
    var PatternCS = function() {
        function PatternCS(baseCS) {
            this.name = "Pattern";
            this.base = baseCS;
        }
        PatternCS.prototype = {};
        return PatternCS;
    }();
    var IndexedCS = function() {
        function IndexedCS(base, highVal, lookup) {
            this.name = "Indexed";
            this.numComps = 1;
            this.defaultColor = new Uint8Array([ 0 ]);
            this.base = base;
            this.highVal = highVal;
            var baseNumComps = base.numComps;
            var length = baseNumComps * highVal;
            var lookupArray;
            if (isStream(lookup)) {
                lookupArray = new Uint8Array(length);
                var bytes = lookup.getBytes(length);
                lookupArray.set(bytes);
            } else if (isString(lookup)) {
                lookupArray = new Uint8Array(length);
                for (var i = 0; length > i; ++i) lookupArray[i] = lookup.charCodeAt(i);
            } else lookup instanceof Uint8Array || lookup instanceof Array ? lookupArray = lookup : error("Unrecognized lookup table: " + lookup);
            this.lookup = lookupArray;
        }
        IndexedCS.prototype = {
            getRgb: function(src, srcOffset) {
                var numComps = this.base.numComps;
                var start = src[srcOffset] * numComps;
                return this.base.getRgb(this.lookup, start);
            },
            getRgbItem: function(src, srcOffset, dest, destOffset) {
                var numComps = this.base.numComps;
                var start = src[srcOffset] * numComps;
                this.base.getRgbItem(this.lookup, start, dest, destOffset);
            },
            getRgbBuffer: function(src, srcOffset, count, dest, destOffset) {
                var base = this.base;
                var numComps = base.numComps;
                var outputDelta = base.getOutputLength(numComps);
                var lookup = this.lookup;
                for (var i = 0; count > i; ++i) {
                    var lookupPos = src[srcOffset++] * numComps;
                    base.getRgbBuffer(lookup, lookupPos, 1, dest, destOffset, 8);
                    destOffset += outputDelta;
                }
            },
            getOutputLength: function(inputLength) {
                return this.base.getOutputLength(inputLength * this.base.numComps);
            },
            isPassthrough: ColorSpace.prototype.isPassthrough,
            createRgbBuffer: ColorSpace.prototype.createRgbBuffer,
            isDefaultDecode: function() {
                return true;
            },
            usesZeroToOneRange: true
        };
        return IndexedCS;
    }();
    var DeviceGrayCS = function() {
        function DeviceGrayCS() {
            this.name = "DeviceGray";
            this.numComps = 1;
            this.defaultColor = new Float32Array([ 0 ]);
        }
        DeviceGrayCS.prototype = {
            getRgb: function(src, srcOffset) {
                var rgb = new Uint8Array(3);
                this.getRgbItem(src, srcOffset, rgb, 0);
                return rgb;
            },
            getRgbItem: function(src, srcOffset, dest, destOffset) {
                var c = 0 | 255 * src[srcOffset];
                c = 0 > c ? 0 : c > 255 ? 255 : c;
                dest[destOffset] = dest[destOffset + 1] = dest[destOffset + 2] = c;
            },
            getRgbBuffer: function(src, srcOffset, count, dest, destOffset, bits) {
                var scale = 255 / ((1 << bits) - 1);
                var j = srcOffset, q = destOffset;
                for (var i = 0; count > i; ++i) {
                    var c = 0 | scale * src[j++];
                    dest[q++] = c;
                    dest[q++] = c;
                    dest[q++] = c;
                }
            },
            getOutputLength: function(inputLength) {
                return 3 * inputLength;
            },
            isPassthrough: ColorSpace.prototype.isPassthrough,
            createRgbBuffer: ColorSpace.prototype.createRgbBuffer,
            isDefaultDecode: function(decodeMap) {
                return ColorSpace.isDefaultDecode(decodeMap, this.numComps);
            },
            usesZeroToOneRange: true
        };
        return DeviceGrayCS;
    }();
    var DeviceRgbCS = function() {
        function DeviceRgbCS() {
            this.name = "DeviceRGB";
            this.numComps = 3;
            this.defaultColor = new Float32Array([ 0, 0, 0 ]);
        }
        DeviceRgbCS.prototype = {
            getRgb: function(src, srcOffset) {
                var rgb = new Uint8Array(3);
                this.getRgbItem(src, srcOffset, rgb, 0);
                return rgb;
            },
            getRgbItem: function(src, srcOffset, dest, destOffset) {
                var r = 0 | 255 * src[srcOffset];
                var g = 0 | 255 * src[srcOffset + 1];
                var b = 0 | 255 * src[srcOffset + 2];
                dest[destOffset] = 0 > r ? 0 : r > 255 ? 255 : r;
                dest[destOffset + 1] = 0 > g ? 0 : g > 255 ? 255 : g;
                dest[destOffset + 2] = 0 > b ? 0 : b > 255 ? 255 : b;
            },
            getRgbBuffer: function(src, srcOffset, count, dest, destOffset, bits) {
                var length = 3 * count;
                if (8 == bits) {
                    dest.set(src.subarray(srcOffset, srcOffset + length), destOffset);
                    return;
                }
                var scale = 255 / ((1 << bits) - 1);
                var j = srcOffset, q = destOffset;
                for (var i = 0; length > i; ++i) dest[q++] = 0 | scale * src[j++];
            },
            getOutputLength: function(inputLength) {
                return inputLength;
            },
            isPassthrough: function(bits) {
                return 8 == bits;
            },
            createRgbBuffer: ColorSpace.prototype.createRgbBuffer,
            isDefaultDecode: function(decodeMap) {
                return ColorSpace.isDefaultDecode(decodeMap, this.numComps);
            },
            usesZeroToOneRange: true
        };
        return DeviceRgbCS;
    }();
    var DeviceCmykCS = function() {
        function convertToRgb(src, srcOffset, srcScale, dest, destOffset) {
            var c = src[srcOffset + 0] * srcScale;
            var m = src[srcOffset + 1] * srcScale;
            var y = src[srcOffset + 2] * srcScale;
            var k = src[srcOffset + 3] * srcScale;
            var r = c * (-4.387332384609988 * c + 54.48615194189176 * m + 18.82290502165302 * y + 212.25662451639585 * k + -285.2331026137004) + m * (1.7149763477362134 * m - 5.6096736904047315 * y + -17.873870861415444 * k - 5.497006427196366) + y * (-2.5217340131683033 * y - 21.248923337353073 * k + 17.5119270841813) + k * (-21.86122147463605 * k - 189.48180835922747) + 255;
            var g = c * (8.841041422036149 * c + 60.118027045597366 * m + 6.871425592049007 * y + 31.159100130055922 * k + -79.2970844816548) + m * (-15.310361306967817 * m + 17.575251261109482 * y + 131.35250912493976 * k - 190.9453302588951) + y * (4.444339102852739 * y + 9.8632861493405 * k - 24.86741582555878) + k * (-20.737325471181034 * k - 187.80453709719578) + 255;
            var b = c * (.8842522430003296 * c + 8.078677503112928 * m + 30.89978309703729 * y - .23883238689178934 * k + -14.183576799673286) + m * (10.49593273432072 * m + 63.02378494754052 * y + 50.606957656360734 * k - 112.23884253719248) + y * (.03296041114873217 * y + 115.60384449646641 * k + -193.58209356861505) + k * (-22.33816807309886 * k - 180.12613974708367) + 255;
            dest[destOffset] = r > 255 ? 255 : 0 > r ? 0 : r;
            dest[destOffset + 1] = g > 255 ? 255 : 0 > g ? 0 : g;
            dest[destOffset + 2] = b > 255 ? 255 : 0 > b ? 0 : b;
        }
        function DeviceCmykCS() {
            this.name = "DeviceCMYK";
            this.numComps = 4;
            this.defaultColor = new Float32Array([ 0, 0, 0, 1 ]);
        }
        DeviceCmykCS.prototype = {
            getRgb: function(src, srcOffset) {
                var rgb = new Uint8Array(3);
                convertToRgb(src, srcOffset, 1, rgb, 0);
                return rgb;
            },
            getRgbItem: function(src, srcOffset, dest, destOffset) {
                convertToRgb(src, srcOffset, 1, dest, destOffset);
            },
            getRgbBuffer: function(src, srcOffset, count, dest, destOffset, bits) {
                var scale = 1 / ((1 << bits) - 1);
                for (var i = 0; count > i; i++) {
                    convertToRgb(src, srcOffset, scale, dest, destOffset);
                    srcOffset += 4;
                    destOffset += 3;
                }
            },
            getOutputLength: function(inputLength) {
                return 3 * (inputLength >> 2);
            },
            isPassthrough: ColorSpace.prototype.isPassthrough,
            createRgbBuffer: ColorSpace.prototype.createRgbBuffer,
            isDefaultDecode: function(decodeMap) {
                return ColorSpace.isDefaultDecode(decodeMap, this.numComps);
            },
            usesZeroToOneRange: true
        };
        return DeviceCmykCS;
    }();
    var LabCS = function() {
        function LabCS(whitePoint, blackPoint, range) {
            this.name = "Lab";
            this.numComps = 3;
            this.defaultColor = new Float32Array([ 0, 0, 0 ]);
            whitePoint || error("WhitePoint missing - required for color space Lab");
            blackPoint = blackPoint || [ 0, 0, 0 ];
            range = range || [ -100, 100, -100, 100 ];
            this.XW = whitePoint[0];
            this.YW = whitePoint[1];
            this.ZW = whitePoint[2];
            this.amin = range[0];
            this.amax = range[1];
            this.bmin = range[2];
            this.bmax = range[3];
            this.XB = blackPoint[0];
            this.YB = blackPoint[1];
            this.ZB = blackPoint[2];
            (0 > this.XW || 0 > this.ZW || 1 !== this.YW) && error("Invalid WhitePoint components, no fallback available");
            if (0 > this.XB || 0 > this.YB || 0 > this.ZB) {
                info("Invalid BlackPoint, falling back to default");
                this.XB = this.YB = this.ZB = 0;
            }
            if (this.amin > this.amax || this.bmin > this.bmax) {
                info("Invalid Range, falling back to defaults");
                this.amin = -100;
                this.amax = 100;
                this.bmin = -100;
                this.bmax = 100;
            }
        }
        function fn_g(x) {
            return x >= 6 / 29 ? x * x * x : 108 / 841 * (x - 4 / 29);
        }
        function decode(value, high1, low2, high2) {
            return low2 + value * (high2 - low2) / high1;
        }
        function convertToRgb(cs, src, srcOffset, maxVal, dest, destOffset) {
            var Ls = src[srcOffset];
            var as = src[srcOffset + 1];
            var bs = src[srcOffset + 2];
            if (false !== maxVal) {
                Ls = decode(Ls, maxVal, 0, 100);
                as = decode(as, maxVal, cs.amin, cs.amax);
                bs = decode(bs, maxVal, cs.bmin, cs.bmax);
            }
            as = as > cs.amax ? cs.amax : cs.amin > as ? cs.amin : as;
            bs = bs > cs.bmax ? cs.bmax : cs.bmin > bs ? cs.bmin : bs;
            var M = (Ls + 16) / 116;
            var L = M + as / 500;
            var N = M - bs / 200;
            var X = cs.XW * fn_g(L);
            var Y = cs.YW * fn_g(M);
            var Z = cs.ZW * fn_g(N);
            var r, g, b;
            if (1 > cs.ZW) {
                r = 3.1339 * X + -1.617 * Y + Z * -.4906;
                g = X * -.9785 + 1.916 * Y + .0333 * Z;
                b = .072 * X + Y * -.229 + 1.4057 * Z;
            } else {
                r = 3.2406 * X + -1.5372 * Y + Z * -.4986;
                g = X * -.9689 + 1.8758 * Y + .0415 * Z;
                b = .0557 * X + Y * -.204 + 1.057 * Z;
            }
            dest[destOffset] = 255 * Math.sqrt(0 > r ? 0 : r > 1 ? 1 : r);
            dest[destOffset + 1] = 255 * Math.sqrt(0 > g ? 0 : g > 1 ? 1 : g);
            dest[destOffset + 2] = 255 * Math.sqrt(0 > b ? 0 : b > 1 ? 1 : b);
        }
        LabCS.prototype = {
            getRgb: function(src, srcOffset) {
                var rgb = new Uint8Array(3);
                convertToRgb(this, src, srcOffset, false, rgb, 0);
                return rgb;
            },
            getRgbItem: function(src, srcOffset, dest, destOffset) {
                convertToRgb(this, src, srcOffset, false, dest, destOffset);
            },
            getRgbBuffer: function(src, srcOffset, count, dest, destOffset, bits) {
                var maxVal = (1 << bits) - 1;
                for (var i = 0; count > i; i++) {
                    convertToRgb(this, src, srcOffset, maxVal, dest, destOffset);
                    srcOffset += 3;
                    destOffset += 3;
                }
            },
            getOutputLength: function(inputLength) {
                return inputLength;
            },
            isPassthrough: ColorSpace.prototype.isPassthrough,
            isDefaultDecode: function() {
                return true;
            },
            usesZeroToOneRange: false
        };
        return LabCS;
    }();
    var PatternType = {
        AXIAL: 2,
        RADIAL: 3
    };
    var Pattern = function() {
        function Pattern() {
            error("should not call Pattern constructor");
        }
        Pattern.prototype = {
            getPattern: function(ctx) {
                error("Should not call Pattern.getStyle: " + ctx);
            }
        };
        Pattern.shadingFromIR = function(raw) {
            return Shadings[raw[0]].fromIR(raw);
        };
        Pattern.parseShading = function(shading, matrix, xref, res) {
            var dict = isStream(shading) ? shading.dict : shading;
            var type = dict.get("ShadingType");
            switch (type) {
              case PatternType.AXIAL:
              case PatternType.RADIAL:
                return new Shadings.RadialAxial(dict, matrix, xref, res);

              default:
                TODO("Unsupported shading type: " + type);
                return new Shadings.Dummy();
            }
        };
        return Pattern;
    }();
    var Shadings = {};
    Shadings.SMALL_NUMBER = .01;
    Shadings.RadialAxial = function() {
        function RadialAxial(dict, matrix, xref, res, ctx) {
            this.matrix = matrix;
            this.coordsArr = dict.get("Coords");
            this.shadingType = dict.get("ShadingType");
            this.type = "Pattern";
            this.ctx = ctx;
            var cs = dict.get("ColorSpace", "CS");
            cs = ColorSpace.parse(cs, xref, res);
            this.cs = cs;
            var t0 = 0, t1 = 1;
            if (dict.has("Domain")) {
                var domainArr = dict.get("Domain");
                t0 = domainArr[0];
                t1 = domainArr[1];
            }
            var extendStart = false, extendEnd = false;
            if (dict.has("Extend")) {
                var extendArr = dict.get("Extend");
                extendStart = extendArr[0];
                extendEnd = extendArr[1];
            }
            if (!(this.shadingType !== PatternType.RADIAL || extendStart && extendEnd)) {
                var x1 = this.coordsArr[0];
                var y1 = this.coordsArr[1];
                var r1 = this.coordsArr[2];
                var x2 = this.coordsArr[3];
                var y2 = this.coordsArr[4];
                var r2 = this.coordsArr[5];
                var distance = Math.sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2));
                r2 + distance >= r1 && r1 + distance >= r2 && warn("Unsupported radial gradient.");
            }
            this.extendStart = extendStart;
            this.extendEnd = extendEnd;
            var fnObj = dict.get("Function");
            var fn;
            if (isArray(fnObj)) {
                var fnArray = [];
                for (var j = 0, jj = fnObj.length; jj > j; j++) {
                    var obj = xref.fetchIfRef(fnObj[j]);
                    isPDFFunction(obj) || error("Invalid function");
                    fnArray.push(PDFFunction.parse(xref, obj));
                }
                fn = function(arg) {
                    var out = [];
                    for (var i = 0, ii = fnArray.length; ii > i; i++) out.push(fnArray[i](arg)[0]);
                    return out;
                };
            } else {
                isPDFFunction(fnObj) || error("Invalid function");
                fn = PDFFunction.parse(xref, fnObj);
            }
            var diff = t1 - t0;
            var step = diff / 10;
            var colorStops = this.colorStops = [];
            if (t0 >= t1 || 0 >= step) {
                info("Bad shading domain.");
                return;
            }
            for (var i = t0; t1 >= i; i += step) {
                var rgbColor = cs.getRgb(fn([ i ]), 0);
                var cssColor = Util.makeCssRgb(rgbColor);
                colorStops.push([ (i - t0) / diff, cssColor ]);
            }
            var background = "transparent";
            if (dict.has("Background")) {
                var rgbColor = cs.getRgb(dict.get("Background"), 0);
                background = Util.makeCssRgb(rgbColor);
            }
            if (!extendStart) {
                colorStops.unshift([ 0, background ]);
                colorStops[1][0] += Shadings.SMALL_NUMBER;
            }
            if (!extendEnd) {
                colorStops[colorStops.length - 1][0] -= Shadings.SMALL_NUMBER;
                colorStops.push([ 1, background ]);
            }
            this.colorStops = colorStops;
        }
        RadialAxial.fromIR = function(raw) {
            var type = raw[1];
            var colorStops = raw[2];
            var p0 = raw[3];
            var p1 = raw[4];
            var r0 = raw[5];
            var r1 = raw[6];
            return {
                type: "Pattern",
                getPattern: function(ctx) {
                    var grad;
                    type == PatternType.AXIAL ? grad = ctx.createLinearGradient(p0[0], p0[1], p1[0], p1[1]) : type == PatternType.RADIAL && (grad = ctx.createRadialGradient(p0[0], p0[1], r0, p1[0], p1[1], r1));
                    for (var i = 0, ii = colorStops.length; ii > i; ++i) {
                        var c = colorStops[i];
                        grad.addColorStop(c[0], c[1]);
                    }
                    return grad;
                }
            };
        };
        RadialAxial.prototype = {
            getIR: function() {
                var coordsArr = this.coordsArr;
                var type = this.shadingType;
                if (type == PatternType.AXIAL) {
                    var p0 = [ coordsArr[0], coordsArr[1] ];
                    var p1 = [ coordsArr[2], coordsArr[3] ];
                    var r0 = null;
                    var r1 = null;
                } else if (type == PatternType.RADIAL) {
                    var p0 = [ coordsArr[0], coordsArr[1] ];
                    var p1 = [ coordsArr[3], coordsArr[4] ];
                    var r0 = coordsArr[2];
                    var r1 = coordsArr[5];
                } else error("getPattern type unknown: " + type);
                var matrix = this.matrix;
                if (matrix) {
                    p0 = Util.applyTransform(p0, matrix);
                    p1 = Util.applyTransform(p1, matrix);
                }
                return [ "RadialAxial", type, this.colorStops, p0, p1, r0, r1 ];
            }
        };
        return RadialAxial;
    }();
    Shadings.Dummy = function() {
        function Dummy() {
            this.type = "Pattern";
        }
        Dummy.fromIR = function() {
            return {
                type: "Pattern",
                getPattern: function() {
                    return "hotpink";
                }
            };
        };
        Dummy.prototype = {
            getIR: function() {
                return [ "Dummy" ];
            }
        };
        return Dummy;
    }();
    var TilingPattern = function() {
        function TilingPattern(IR, color, ctx, objs, commonObjs, baseTransform) {
            this.name = IR[1][0].name;
            this.operatorList = IR[2];
            this.matrix = IR[3] || [ 1, 0, 0, 1, 0, 0 ];
            this.bbox = IR[4];
            this.xstep = IR[5];
            this.ystep = IR[6];
            this.paintType = IR[7];
            this.tilingType = IR[8];
            this.color = color;
            this.objs = objs;
            this.commonObjs = commonObjs;
            this.baseTransform = baseTransform;
            this.type = "Pattern";
            this.ctx = ctx;
        }
        var PaintType = {
            COLORED: 1,
            UNCOLORED: 2
        };
        var MAX_PATTERN_SIZE = 3e3;
        TilingPattern.getIR = function(operatorList, dict, args) {
            var matrix = dict.get("Matrix");
            var bbox = dict.get("BBox");
            var xstep = dict.get("XStep");
            var ystep = dict.get("YStep");
            var paintType = dict.get("PaintType");
            var tilingType = dict.get("TilingType");
            return [ "TilingPattern", args, operatorList, matrix, bbox, xstep, ystep, paintType, tilingType ];
        };
        TilingPattern.prototype = {
            createPatternCanvas: function(owner) {
                var operatorList = this.operatorList;
                var bbox = this.bbox;
                var xstep = this.xstep;
                var ystep = this.ystep;
                var paintType = this.paintType;
                var tilingType = this.tilingType;
                var color = this.color;
                var objs = this.objs;
                var commonObjs = this.commonObjs;
                this.ctx;
                TODO("TilingType: " + tilingType);
                var x0 = bbox[0], y0 = bbox[1], x1 = bbox[2], y1 = bbox[3];
                var topLeft = [ x0, y0 ];
                var botRight = [ x0 + xstep, y0 + ystep ];
                var width = botRight[0] - topLeft[0];
                var height = botRight[1] - topLeft[1];
                var matrixScale = Util.singularValueDecompose2dScale(this.matrix);
                var curMatrixScale = Util.singularValueDecompose2dScale(this.baseTransform);
                var combinedScale = [ matrixScale[0] * curMatrixScale[0], matrixScale[1] * curMatrixScale[1] ];
                width = Math.min(Math.ceil(Math.abs(width * combinedScale[0])), MAX_PATTERN_SIZE);
                height = Math.min(Math.ceil(Math.abs(height * combinedScale[1])), MAX_PATTERN_SIZE);
                var tmpCanvas = CachedCanvases.getCanvas("pattern", width, height, true);
                var tmpCtx = tmpCanvas.context;
                var graphics = new CanvasGraphics(tmpCtx, commonObjs, objs);
                graphics.groupLevel = owner.groupLevel;
                this.setFillAndStrokeStyleToContext(tmpCtx, paintType, color);
                this.setScale(width, height, xstep, ystep);
                this.transformToScale(graphics);
                var tmpTranslate = [ 1, 0, 0, 1, -topLeft[0], -topLeft[1] ];
                graphics.transform.apply(graphics, tmpTranslate);
                this.clipBbox(graphics, bbox, x0, y0, x1, y1);
                graphics.executeOperatorList(operatorList);
                return tmpCanvas.canvas;
            },
            setScale: function(width, height, xstep, ystep) {
                this.scale = [ width / xstep, height / ystep ];
            },
            transformToScale: function(graphics) {
                var scale = this.scale;
                var tmpScale = [ scale[0], 0, 0, scale[1], 0, 0 ];
                graphics.transform.apply(graphics, tmpScale);
            },
            scaleToContext: function() {
                var scale = this.scale;
                this.ctx.scale(1 / scale[0], 1 / scale[1]);
            },
            clipBbox: function(graphics, bbox, x0, y0, x1, y1) {
                if (bbox && isArray(bbox) && 4 == bbox.length) {
                    var bboxWidth = x1 - x0;
                    var bboxHeight = y1 - y0;
                    graphics.rectangle(x0, y0, bboxWidth, bboxHeight);
                    graphics.clip();
                    graphics.endPath();
                }
            },
            setFillAndStrokeStyleToContext: function(context, paintType, color) {
                switch (paintType) {
                  case PaintType.COLORED:
                    var ctx = this.ctx;
                    context.fillStyle = ctx.fillStyle;
                    context.strokeStyle = ctx.strokeStyle;
                    break;

                  case PaintType.UNCOLORED:
                    var rgbColor = ColorSpace.singletons.rgb.getRgb(color, 0);
                    var cssColor = Util.makeCssRgb(rgbColor);
                    context.fillStyle = cssColor;
                    context.strokeStyle = cssColor;
                    break;

                  default:
                    error("Unsupported paint type: " + paintType);
                }
            },
            getPattern: function(ctx, owner) {
                var temporaryPatternCanvas = this.createPatternCanvas(owner);
                var ctx = this.ctx;
                ctx.setTransform.apply(ctx, this.baseTransform);
                ctx.transform.apply(ctx, this.matrix);
                this.scaleToContext();
                return ctx.createPattern(temporaryPatternCanvas, "repeat");
            }
        };
        return TilingPattern;
    }();
    var PDFFunction = function() {
        var CONSTRUCT_SAMPLED = 0;
        var CONSTRUCT_INTERPOLATED = 2;
        var CONSTRUCT_STICHED = 3;
        var CONSTRUCT_POSTSCRIPT = 4;
        return {
            getSampleArray: function(size, outputSize, bps, str) {
                var length = 1;
                for (var i = 0, ii = size.length; ii > i; i++) length *= size[i];
                length *= outputSize;
                var array = [];
                var codeSize = 0;
                var codeBuf = 0;
                var sampleMul = 1 / (Math.pow(2, bps) - 1);
                var strBytes = str.getBytes((length * bps + 7) / 8);
                var strIdx = 0;
                for (var i = 0; length > i; i++) {
                    while (bps > codeSize) {
                        codeBuf <<= 8;
                        codeBuf |= strBytes[strIdx++];
                        codeSize += 8;
                    }
                    codeSize -= bps;
                    array.push((codeBuf >> codeSize) * sampleMul);
                    codeBuf &= (1 << codeSize) - 1;
                }
                return array;
            },
            getIR: function(xref, fn) {
                var dict = fn.dict;
                dict || (dict = fn);
                var types = [ this.constructSampled, null, this.constructInterpolated, this.constructStiched, this.constructPostScript ];
                var typeNum = dict.get("FunctionType");
                var typeFn = types[typeNum];
                typeFn || error("Unknown type of function");
                return typeFn.call(this, fn, dict, xref);
            },
            fromIR: function(IR) {
                var type = IR[0];
                switch (type) {
                  case CONSTRUCT_SAMPLED:
                    return this.constructSampledFromIR(IR);

                  case CONSTRUCT_INTERPOLATED:
                    return this.constructInterpolatedFromIR(IR);

                  case CONSTRUCT_STICHED:
                    return this.constructStichedFromIR(IR);

                  default:
                    return this.constructPostScriptFromIR(IR);
                }
            },
            parse: function(xref, fn) {
                var IR = this.getIR(xref, fn);
                return this.fromIR(IR);
            },
            constructSampled: function(str, dict) {
                function toMultiArray(arr) {
                    var inputLength = arr.length;
                    arr.length / 2;
                    var out = [];
                    var index = 0;
                    for (var i = 0; inputLength > i; i += 2) {
                        out[index] = [ arr[i], arr[i + 1] ];
                        ++index;
                    }
                    return out;
                }
                var domain = dict.get("Domain");
                var range = dict.get("Range");
                domain && range || error("No domain or range");
                var inputSize = domain.length / 2;
                var outputSize = range.length / 2;
                domain = toMultiArray(domain);
                range = toMultiArray(range);
                var size = dict.get("Size");
                var bps = dict.get("BitsPerSample");
                var order = dict.get("Order") || 1;
                1 !== order && TODO("No support for cubic spline interpolation: " + order);
                var encode = dict.get("Encode");
                if (!encode) {
                    encode = [];
                    for (var i = 0; inputSize > i; ++i) {
                        encode.push(0);
                        encode.push(size[i] - 1);
                    }
                }
                encode = toMultiArray(encode);
                var decode = dict.get("Decode");
                decode = decode ? toMultiArray(decode) : range;
                var samples = this.getSampleArray(size, outputSize, bps, str);
                return [ CONSTRUCT_SAMPLED, inputSize, domain, encode, decode, samples, size, outputSize, Math.pow(2, bps) - 1, range ];
            },
            constructSampledFromIR: function(IR) {
                function interpolate(x, xmin, xmax, ymin, ymax) {
                    return ymin + (x - xmin) * ((ymax - ymin) / (xmax - xmin));
                }
                return function(args) {
                    var m = IR[1];
                    var domain = IR[2];
                    var encode = IR[3];
                    var decode = IR[4];
                    var samples = IR[5];
                    var size = IR[6];
                    var n = IR[7];
                    IR[8];
                    var range = IR[9];
                    m != args.length && error("Incorrect number of arguments: " + m + " != " + args.length);
                    var x = args;
                    var cubeVertices = 1 << m;
                    var cubeN = new Float64Array(cubeVertices);
                    var cubeVertex = new Uint32Array(cubeVertices);
                    for (var j = 0; cubeVertices > j; j++) cubeN[j] = 1;
                    var k = n, pos = 1;
                    for (var i = 0; m > i; ++i) {
                        var domain_2i = domain[i][0];
                        var domain_2i_1 = domain[i][1];
                        var xi = Math.min(Math.max(x[i], domain_2i), domain_2i_1);
                        var e = interpolate(xi, domain_2i, domain_2i_1, encode[i][0], encode[i][1]);
                        var size_i = size[i];
                        e = Math.min(Math.max(e, 0), size_i - 1);
                        var e0 = size_i - 1 > e ? Math.floor(e) : e - 1;
                        var n0 = e0 + 1 - e;
                        var n1 = e - e0;
                        var offset0 = e0 * k;
                        var offset1 = offset0 + k;
                        for (var j = 0; cubeVertices > j; j++) if (j & pos) {
                            cubeN[j] *= n1;
                            cubeVertex[j] += offset1;
                        } else {
                            cubeN[j] *= n0;
                            cubeVertex[j] += offset0;
                        }
                        k *= size_i;
                        pos <<= 1;
                    }
                    var y = new Float64Array(n);
                    for (var j = 0; n > j; ++j) {
                        var rj = 0;
                        for (var i = 0; cubeVertices > i; i++) rj += samples[cubeVertex[i] + j] * cubeN[i];
                        rj = interpolate(rj, 0, 1, decode[j][0], decode[j][1]);
                        y[j] = Math.min(Math.max(rj, range[j][0]), range[j][1]);
                    }
                    return y;
                };
            },
            constructInterpolated: function(str, dict) {
                var c0 = dict.get("C0") || [ 0 ];
                var c1 = dict.get("C1") || [ 1 ];
                var n = dict.get("N");
                isArray(c0) && isArray(c1) || error("Illegal dictionary for interpolated function");
                var length = c0.length;
                var diff = [];
                for (var i = 0; length > i; ++i) diff.push(c1[i] - c0[i]);
                return [ CONSTRUCT_INTERPOLATED, c0, diff, n ];
            },
            constructInterpolatedFromIR: function(IR) {
                var c0 = IR[1];
                var diff = IR[2];
                var n = IR[3];
                var length = diff.length;
                return function(args) {
                    var x = 1 == n ? args[0] : Math.pow(args[0], n);
                    var out = [];
                    for (var j = 0; length > j; ++j) out.push(c0[j] + x * diff[j]);
                    return out;
                };
            },
            constructStiched: function(fn, dict, xref) {
                var domain = dict.get("Domain");
                domain || error("No domain");
                var inputSize = domain.length / 2;
                1 != inputSize && error("Bad domain for stiched function");
                var fnRefs = dict.get("Functions");
                var fns = [];
                for (var i = 0, ii = fnRefs.length; ii > i; ++i) fns.push(PDFFunction.getIR(xref, xref.fetchIfRef(fnRefs[i])));
                var bounds = dict.get("Bounds");
                var encode = dict.get("Encode");
                return [ CONSTRUCT_STICHED, domain, bounds, encode, fns ];
            },
            constructStichedFromIR: function(IR) {
                var domain = IR[1];
                var bounds = IR[2];
                var encode = IR[3];
                var fnsIR = IR[4];
                var fns = [];
                for (var i = 0, ii = fnsIR.length; ii > i; i++) fns.push(PDFFunction.fromIR(fnsIR[i]));
                return function(args) {
                    var clip = function(v, min, max) {
                        v > max ? v = max : min > v && (v = min);
                        return v;
                    };
                    var v = clip(args[0], domain[0], domain[1]);
                    for (var i = 0, ii = bounds.length; ii > i; ++i) if (bounds[i] > v) break;
                    var dmin = domain[0];
                    i > 0 && (dmin = bounds[i - 1]);
                    var dmax = domain[1];
                    bounds.length > i && (dmax = bounds[i]);
                    var rmin = encode[2 * i];
                    var rmax = encode[2 * i + 1];
                    var v2 = rmin + (v - dmin) * (rmax - rmin) / (dmax - dmin);
                    return fns[i]([ v2 ]);
                };
            },
            constructPostScript: function(fn, dict) {
                var domain = dict.get("Domain");
                var range = dict.get("Range");
                domain || error("No domain.");
                range || error("No range.");
                var lexer = new PostScriptLexer(fn);
                var parser = new PostScriptParser(lexer);
                var code = parser.parse();
                return [ CONSTRUCT_POSTSCRIPT, domain, range, code ];
            },
            constructPostScriptFromIR: function(IR) {
                var domain = IR[1];
                var range = IR[2];
                var code = IR[3];
                var numOutputs = range.length / 2;
                var evaluator = new PostScriptEvaluator(code);
                var cache = new FunctionCache();
                return function(args) {
                    var initialStack = [];
                    for (var i = 0, ii = domain.length / 2; ii > i; ++i) initialStack.push(args[i]);
                    var key = initialStack.join("_");
                    if (cache.has(key)) return cache.get(key);
                    var stack = evaluator.execute(initialStack);
                    var transformed = [];
                    for (i = numOutputs - 1; i >= 0; --i) {
                        var out = stack.pop();
                        var rangeIndex = 2 * i;
                        range[rangeIndex] > out ? out = range[rangeIndex] : out > range[rangeIndex + 1] && (out = range[rangeIndex + 1]);
                        transformed[i] = out;
                    }
                    cache.set(key, transformed);
                    return transformed;
                };
            }
        };
    }();
    var FunctionCache = function() {
        function FunctionCache() {
            this.cache = {};
            this.total = 0;
        }
        var MAX_CACHE_SIZE = 1024;
        FunctionCache.prototype = {
            has: function(key) {
                return key in this.cache;
            },
            get: function(key) {
                return this.cache[key];
            },
            set: function(key, value) {
                if (MAX_CACHE_SIZE > this.total) {
                    this.cache[key] = value;
                    this.total++;
                }
            }
        };
        return FunctionCache;
    }();
    var PostScriptStack = function() {
        function PostScriptStack(initialStack) {
            this.stack = initialStack || [];
        }
        var MAX_STACK_SIZE = 100;
        PostScriptStack.prototype = {
            push: function(value) {
                this.stack.length >= MAX_STACK_SIZE && error("PostScript function stack overflow.");
                this.stack.push(value);
            },
            pop: function() {
                0 >= this.stack.length && error("PostScript function stack underflow.");
                return this.stack.pop();
            },
            copy: function(n) {
                this.stack.length + n >= MAX_STACK_SIZE && error("PostScript function stack overflow.");
                var stack = this.stack;
                for (var i = stack.length - n, j = n - 1; j >= 0; j--, i++) stack.push(stack[i]);
            },
            index: function(n) {
                this.push(this.stack[this.stack.length - n - 1]);
            },
            roll: function(n, p) {
                var stack = this.stack;
                var l = stack.length - n;
                var i, j, t, r = stack.length - 1, c = l + (p - Math.floor(p / n) * n);
                for (i = l, j = r; j > i; i++, j--) {
                    t = stack[i];
                    stack[i] = stack[j];
                    stack[j] = t;
                }
                for (i = l, j = c - 1; j > i; i++, j--) {
                    t = stack[i];
                    stack[i] = stack[j];
                    stack[j] = t;
                }
                for (i = c, j = r; j > i; i++, j--) {
                    t = stack[i];
                    stack[i] = stack[j];
                    stack[j] = t;
                }
            }
        };
        return PostScriptStack;
    }();
    var PostScriptEvaluator = function() {
        function PostScriptEvaluator(operators, operands) {
            this.operators = operators;
            this.operands = operands;
        }
        PostScriptEvaluator.prototype = {
            execute: function(initialStack) {
                var stack = new PostScriptStack(initialStack);
                var counter = 0;
                var operators = this.operators;
                var length = operators.length;
                var operator, a, b;
                while (length > counter) {
                    operator = operators[counter++];
                    if ("number" == typeof operator) {
                        stack.push(operator);
                        continue;
                    }
                    switch (operator) {
                      case "jz":
                        b = stack.pop();
                        a = stack.pop();
                        a || (counter = b);
                        break;

                      case "j":
                        a = stack.pop();
                        counter = a;
                        break;

                      case "abs":
                        a = stack.pop();
                        stack.push(Math.abs(a));
                        break;

                      case "add":
                        b = stack.pop();
                        a = stack.pop();
                        stack.push(a + b);
                        break;

                      case "and":
                        b = stack.pop();
                        a = stack.pop();
                        isBool(a) && isBool(b) ? stack.push(a && b) : stack.push(a & b);
                        break;

                      case "atan":
                        a = stack.pop();
                        stack.push(Math.atan(a));
                        break;

                      case "bitshift":
                        b = stack.pop();
                        a = stack.pop();
                        a > 0 ? stack.push(a << b) : stack.push(a >> b);
                        break;

                      case "ceiling":
                        a = stack.pop();
                        stack.push(Math.ceil(a));
                        break;

                      case "copy":
                        a = stack.pop();
                        stack.copy(a);
                        break;

                      case "cos":
                        a = stack.pop();
                        stack.push(Math.cos(a));
                        break;

                      case "cvi":
                        a = 0 | stack.pop();
                        stack.push(a);
                        break;

                      case "cvr":
                        break;

                      case "div":
                        b = stack.pop();
                        a = stack.pop();
                        stack.push(a / b);
                        break;

                      case "dup":
                        stack.copy(1);
                        break;

                      case "eq":
                        b = stack.pop();
                        a = stack.pop();
                        stack.push(a == b);
                        break;

                      case "exch":
                        stack.roll(2, 1);
                        break;

                      case "exp":
                        b = stack.pop();
                        a = stack.pop();
                        stack.push(Math.pow(a, b));
                        break;

                      case "false":
                        stack.push(false);
                        break;

                      case "floor":
                        a = stack.pop();
                        stack.push(Math.floor(a));
                        break;

                      case "ge":
                        b = stack.pop();
                        a = stack.pop();
                        stack.push(a >= b);
                        break;

                      case "gt":
                        b = stack.pop();
                        a = stack.pop();
                        stack.push(a > b);
                        break;

                      case "idiv":
                        b = stack.pop();
                        a = stack.pop();
                        stack.push(0 | a / b);
                        break;

                      case "index":
                        a = stack.pop();
                        stack.index(a);
                        break;

                      case "le":
                        b = stack.pop();
                        a = stack.pop();
                        stack.push(b >= a);
                        break;

                      case "ln":
                        a = stack.pop();
                        stack.push(Math.log(a));
                        break;

                      case "log":
                        a = stack.pop();
                        stack.push(Math.log(a) / Math.LN10);
                        break;

                      case "lt":
                        b = stack.pop();
                        a = stack.pop();
                        stack.push(b > a);
                        break;

                      case "mod":
                        b = stack.pop();
                        a = stack.pop();
                        stack.push(a % b);
                        break;

                      case "mul":
                        b = stack.pop();
                        a = stack.pop();
                        stack.push(a * b);
                        break;

                      case "ne":
                        b = stack.pop();
                        a = stack.pop();
                        stack.push(a != b);
                        break;

                      case "neg":
                        a = stack.pop();
                        stack.push(-b);
                        break;

                      case "not":
                        a = stack.pop();
                        isBool(a) && isBool(b) ? stack.push(a && b) : stack.push(a & b);
                        break;

                      case "or":
                        b = stack.pop();
                        a = stack.pop();
                        isBool(a) && isBool(b) ? stack.push(a || b) : stack.push(a | b);
                        break;

                      case "pop":
                        stack.pop();
                        break;

                      case "roll":
                        b = stack.pop();
                        a = stack.pop();
                        stack.roll(a, b);
                        break;

                      case "round":
                        a = stack.pop();
                        stack.push(Math.round(a));
                        break;

                      case "sin":
                        a = stack.pop();
                        stack.push(Math.sin(a));
                        break;

                      case "sqrt":
                        a = stack.pop();
                        stack.push(Math.sqrt(a));
                        break;

                      case "sub":
                        b = stack.pop();
                        a = stack.pop();
                        stack.push(a - b);
                        break;

                      case "true":
                        stack.push(true);
                        break;

                      case "truncate":
                        a = stack.pop();
                        a = 0 > a ? Math.ceil(a) : Math.floor(a);
                        stack.push(a);
                        break;

                      case "xor":
                        b = stack.pop();
                        a = stack.pop();
                        isBool(a) && isBool(b) ? stack.push(a != b) : stack.push(a ^ b);
                        break;

                      default:
                        error("Unknown operator " + operator);
                    }
                }
                return stack.stack;
            }
        };
        return PostScriptEvaluator;
    }();
    var PostScriptParser = function() {
        function PostScriptParser(lexer) {
            this.lexer = lexer;
            this.operators = [];
            this.token = null;
            this.prev = null;
        }
        PostScriptParser.prototype = {
            nextToken: function() {
                this.prev = this.token;
                this.token = this.lexer.getToken();
            },
            accept: function(type) {
                if (this.token.type == type) {
                    this.nextToken();
                    return true;
                }
                return false;
            },
            expect: function(type) {
                if (this.accept(type)) return true;
                error("Unexpected symbol: found " + this.token.type + " expected " + type + ".");
            },
            parse: function() {
                this.nextToken();
                this.expect(PostScriptTokenTypes.LBRACE);
                this.parseBlock();
                this.expect(PostScriptTokenTypes.RBRACE);
                return this.operators;
            },
            parseBlock: function() {
                while (true) if (this.accept(PostScriptTokenTypes.NUMBER)) this.operators.push(this.prev.value); else if (this.accept(PostScriptTokenTypes.OPERATOR)) this.operators.push(this.prev.value); else {
                    if (!this.accept(PostScriptTokenTypes.LBRACE)) return;
                    this.parseCondition();
                }
            },
            parseCondition: function() {
                var conditionLocation = this.operators.length;
                this.operators.push(null, null);
                this.parseBlock();
                this.expect(PostScriptTokenTypes.RBRACE);
                if (this.accept(PostScriptTokenTypes.IF)) {
                    this.operators[conditionLocation] = this.operators.length;
                    this.operators[conditionLocation + 1] = "jz";
                } else if (this.accept(PostScriptTokenTypes.LBRACE)) {
                    var jumpLocation = this.operators.length;
                    this.operators.push(null, null);
                    var endOfTrue = this.operators.length;
                    this.parseBlock();
                    this.expect(PostScriptTokenTypes.RBRACE);
                    this.expect(PostScriptTokenTypes.IFELSE);
                    this.operators[jumpLocation] = this.operators.length;
                    this.operators[jumpLocation + 1] = "j";
                    this.operators[conditionLocation] = endOfTrue;
                    this.operators[conditionLocation + 1] = "jz";
                } else error("PS Function: error parsing conditional.");
            }
        };
        return PostScriptParser;
    }();
    var PostScriptTokenTypes = {
        LBRACE: 0,
        RBRACE: 1,
        NUMBER: 2,
        OPERATOR: 3,
        IF: 4,
        IFELSE: 5
    };
    var PostScriptToken = function() {
        function PostScriptToken(type, value) {
            this.type = type;
            this.value = value;
        }
        var opCache = {};
        PostScriptToken.getOperator = function(op) {
            var opValue = opCache[op];
            if (opValue) return opValue;
            return opCache[op] = new PostScriptToken(PostScriptTokenTypes.OPERATOR, op);
        };
        PostScriptToken.LBRACE = new PostScriptToken(PostScriptTokenTypes.LBRACE, "{");
        PostScriptToken.RBRACE = new PostScriptToken(PostScriptTokenTypes.RBRACE, "}");
        PostScriptToken.IF = new PostScriptToken(PostScriptTokenTypes.IF, "IF");
        PostScriptToken.IFELSE = new PostScriptToken(PostScriptTokenTypes.IFELSE, "IFELSE");
        return PostScriptToken;
    }();
    var PostScriptLexer = function() {
        function PostScriptLexer(stream) {
            this.stream = stream;
            this.nextChar();
        }
        PostScriptLexer.prototype = {
            nextChar: function() {
                return this.currentChar = this.stream.getByte();
            },
            getToken: function() {
                var comment = false;
                var ch = this.currentChar;
                while (true) {
                    if (0 > ch) return EOF;
                    if (comment) (10 === ch || 13 === ch) && (comment = false); else if (37 == ch) comment = true; else if (!Lexer.isSpace(ch)) break;
                    ch = this.nextChar();
                }
                switch (0 | ch) {
                  case 48:
                  case 49:
                  case 50:
                  case 51:
                  case 52:
                  case 53:
                  case 54:
                  case 55:
                  case 56:
                  case 57:
                  case 43:
                  case 45:
                  case 46:
                    return new PostScriptToken(PostScriptTokenTypes.NUMBER, this.getNumber());

                  case 123:
                    this.nextChar();
                    return PostScriptToken.LBRACE;

                  case 125:
                    this.nextChar();
                    return PostScriptToken.RBRACE;
                }
                var str = String.fromCharCode(ch);
                while ((ch = this.nextChar()) >= 0 && (ch >= 65 && 90 >= ch || ch >= 97 && 122 >= ch)) str += String.fromCharCode(ch);
                switch (str.toLowerCase()) {
                  case "if":
                    return PostScriptToken.IF;

                  case "ifelse":
                    return PostScriptToken.IFELSE;

                  default:
                    return PostScriptToken.getOperator(str);
                }
            },
            getNumber: function() {
                var ch = this.currentChar;
                var str = String.fromCharCode(ch);
                while ((ch = this.nextChar()) >= 0) {
                    if (!(ch >= 48 && 57 >= ch || 45 === ch || 46 === ch)) break;
                    str += String.fromCharCode(ch);
                }
                var value = parseFloat(str);
                isNaN(value) && error("Invalid floating point number: " + value);
                return value;
            }
        };
        return PostScriptLexer;
    }();
    var Annotation = function() {
        function getTransformMatrix(rect, bbox, matrix) {
            var bounds = Util.getAxialAlignedBoundingBox(bbox, matrix);
            var minX = bounds[0];
            var minY = bounds[1];
            var maxX = bounds[2];
            var maxY = bounds[3];
            if (minX === maxX || minY === maxY) return [ 1, 0, 0, 1, rect[0], rect[1] ];
            var xRatio = (rect[2] - rect[0]) / (maxX - minX);
            var yRatio = (rect[3] - rect[1]) / (maxY - minY);
            return [ xRatio, 0, 0, yRatio, rect[0] - minX * xRatio, rect[1] - minY * yRatio ];
        }
        function getDefaultAppearance(dict) {
            var appearanceState = dict.get("AP");
            if (!isDict(appearanceState)) return;
            var appearance;
            var appearances = appearanceState.get("N");
            if (isDict(appearances)) {
                var as = dict.get("AS");
                as && appearances.has(as.name) && (appearance = appearances.get(as.name));
            } else appearance = appearances;
            return appearance;
        }
        function Annotation(params) {
            if (params.data) {
                this.data = params.data;
                return;
            }
            var dict = params.dict;
            var data = this.data = {};
            data.subtype = dict.get("Subtype").name;
            var rect = dict.get("Rect");
            data.rect = Util.normalizeRect(rect);
            data.annotationFlags = dict.get("F");
            var color = dict.get("C");
            data.color = isArray(color) && 3 === color.length ? color : [ 0, 0, 0 ];
            if (dict.has("BS")) {
                var borderStyle = dict.get("BS");
                data.borderWidth = borderStyle.has("W") ? borderStyle.get("W") : 1;
            } else {
                var borderArray = dict.get("Border") || [ 0, 0, 1 ];
                data.borderWidth = borderArray[2] || 0;
            }
            this.appearance = getDefaultAppearance(dict);
            data.hasAppearance = !!this.appearance;
        }
        Annotation.prototype = {
            getData: function() {
                return this.data;
            },
            hasHtml: function() {
                return false;
            },
            getHtmlElement: function() {
                throw new NotImplementedException("getHtmlElement() should be implemented in subclass");
            },
            getEmptyContainer: function(tagName, rect) {
                assert(!isWorker, "getEmptyContainer() should be called from main thread");
                rect = rect || this.data.rect;
                var element = document.createElement(tagName);
                element.style.width = Math.ceil(rect[2] - rect[0]) + "px";
                element.style.height = Math.ceil(rect[3] - rect[1]) + "px";
                return element;
            },
            isViewable: function() {
                var data = this.data;
                return !!!(!data || data.annotationFlags && 34 & data.annotationFlags || !data.rect);
            },
            loadResources: function(keys) {
                var promise = new Promise();
                this.appearance.dict.getAsync("Resources").then(function(resources) {
                    if (!resources) {
                        promise.resolve();
                        return;
                    }
                    var objectLoader = new ObjectLoader(resources.map, keys, resources.xref);
                    objectLoader.load().then(function() {
                        promise.resolve(resources);
                    });
                }.bind(this));
                return promise;
            },
            getOperatorList: function(evaluator) {
                var promise = new Promise();
                if (!this.appearance) {
                    promise.resolve(new OperatorList());
                    return promise;
                }
                var data = this.data;
                var appearanceDict = this.appearance.dict;
                var resourcesPromise = this.loadResources([ "ExtGState", "ColorSpace", "Pattern", "Shading", "XObject", "Font" ]);
                var bbox = appearanceDict.get("BBox") || [ 0, 0, 1, 1 ];
                var matrix = appearanceDict.get("Matrix") || [ 1, 0, 0, 1, 0, 0 ];
                var transform = getTransformMatrix(data.rect, bbox, matrix);
                data.border;
                resourcesPromise.then(function(resources) {
                    var opList = new OperatorList();
                    opList.addOp("beginAnnotation", [ data.rect, transform, matrix ]);
                    evaluator.getOperatorList(this.appearance, resources, opList);
                    opList.addOp("endAnnotation", []);
                    promise.resolve(opList);
                }.bind(this));
                return promise;
            }
        };
        Annotation.getConstructor = function(subtype, fieldType) {
            if (!subtype) return;
            if ("Link" === subtype) return LinkAnnotation;
            if ("Text" === subtype) return TextAnnotation;
            if ("Widget" === subtype) {
                if (!fieldType) return;
                return "Tx" === fieldType ? TextWidgetAnnotation : WidgetAnnotation;
            }
            return Annotation;
        };
        Annotation.fromData = function(data) {
            var subtype = data.subtype;
            var fieldType = data.fieldType;
            var Constructor = Annotation.getConstructor(subtype, fieldType);
            if (Constructor) return new Constructor({
                data: data
            });
        };
        Annotation.fromRef = function(xref, ref) {
            var dict = xref.fetchIfRef(ref);
            if (!isDict(dict)) return;
            var subtype = dict.get("Subtype");
            subtype = isName(subtype) ? subtype.name : "";
            if (!subtype) return;
            var fieldType = Util.getInheritableProperty(dict, "FT");
            fieldType = isName(fieldType) ? fieldType.name : "";
            var Constructor = Annotation.getConstructor(subtype, fieldType);
            if (!Constructor) return;
            var params = {
                dict: dict,
                ref: ref
            };
            var annotation = new Constructor(params);
            if (annotation.isViewable()) return annotation;
            TODO("unimplemented annotation type: " + subtype);
        };
        Annotation.appendToOperatorList = function(annotations, opList, pdfManager, partialEvaluator) {
            function reject(e) {
                annotationsReadyPromise.reject(e);
            }
            var annotationsReadyPromise = new Promise();
            var annotationPromises = [];
            for (var i = 0, n = annotations.length; n > i; ++i) annotationPromises.push(annotations[i].getOperatorList(partialEvaluator));
            Promise.all(annotationPromises).then(function(datas) {
                opList.addOp("beginAnnotations", []);
                for (var i = 0, n = datas.length; n > i; ++i) {
                    var annotOpList = datas[i];
                    opList.addOpList(annotOpList);
                }
                opList.addOp("endAnnotations", []);
                annotationsReadyPromise.resolve();
            }, reject);
            return annotationsReadyPromise;
        };
        return Annotation;
    }();
    PDFJS.Annotation = Annotation;
    var WidgetAnnotation = function() {
        function WidgetAnnotation(params) {
            Annotation.call(this, params);
            if (params.data) return;
            var dict = params.dict;
            var data = this.data;
            data.fieldValue = stringToPDFString(Util.getInheritableProperty(dict, "V") || "");
            data.alternativeText = stringToPDFString(dict.get("TU") || "");
            data.defaultAppearance = Util.getInheritableProperty(dict, "DA") || "";
            var fieldType = Util.getInheritableProperty(dict, "FT");
            data.fieldType = isName(fieldType) ? fieldType.name : "";
            data.fieldFlags = Util.getInheritableProperty(dict, "Ff") || 0;
            this.fieldResources = Util.getInheritableProperty(dict, "DR") || new Dict();
            var fieldName = [];
            var namedItem = dict;
            var ref = params.ref;
            while (namedItem) {
                var parent = namedItem.get("Parent");
                var parentRef = namedItem.getRaw("Parent");
                var name = namedItem.get("T");
                if (name) fieldName.unshift(stringToPDFString(name)); else {
                    var kids = parent.get("Kids");
                    var j, jj;
                    for (j = 0, jj = kids.length; jj > j; j++) {
                        var kidRef = kids[j];
                        if (kidRef.num == ref.num && kidRef.gen == ref.gen) break;
                    }
                    fieldName.unshift("`" + j);
                }
                namedItem = parent;
                ref = parentRef;
            }
            data.fullName = fieldName.join(".");
        }
        var parent = Annotation.prototype;
        Util.inherit(WidgetAnnotation, Annotation, {
            isViewable: function() {
                if ("Sig" === this.data.fieldType) {
                    TODO("unimplemented annotation type: Widget signature");
                    return false;
                }
                return parent.isViewable.call(this);
            }
        });
        return WidgetAnnotation;
    }();
    var TextWidgetAnnotation = function() {
        function TextWidgetAnnotation(params) {
            WidgetAnnotation.call(this, params);
            if (params.data) return;
            this.data.textAlignment = Util.getInheritableProperty(params.dict, "Q");
        }
        function setTextStyles(element, item, fontObj) {
            var style = element.style;
            style.fontSize = item.fontSize + "px";
            style.direction = 0 > item.fontDirection ? "rtl" : "ltr";
            if (!fontObj) return;
            style.fontWeight = fontObj.black ? fontObj.bold ? "bolder" : "bold" : fontObj.bold ? "bold" : "normal";
            style.fontStyle = fontObj.italic ? "italic" : "normal";
            var fontName = fontObj.loadedName;
            var fontFamily = fontName ? '"' + fontName + '", ' : "";
            var fallbackName = fontObj.fallbackName || "Helvetica, sans-serif";
            style.fontFamily = fontFamily + fallbackName;
        }
        WidgetAnnotation.prototype;
        Util.inherit(TextWidgetAnnotation, WidgetAnnotation, {
            hasHtml: function() {
                return !this.data.hasAppearance && !!this.data.fieldValue;
            },
            getHtmlElement: function(commonObjs) {
                assert(!isWorker, "getHtmlElement() shall be called from main thread");
                var item = this.data;
                var element = this.getEmptyContainer("div");
                element.style.display = "table";
                var content = document.createElement("div");
                content.textContent = item.fieldValue;
                var textAlignment = item.textAlignment;
                content.style.textAlign = [ "left", "center", "right" ][textAlignment];
                content.style.verticalAlign = "middle";
                content.style.display = "table-cell";
                var fontObj = item.fontRefName ? commonObjs.getData(item.fontRefName) : null;
                setTextStyles(content, item, fontObj);
                element.appendChild(content);
                return element;
            },
            getOperatorList: function(evaluator) {
                if (this.appearance) return Annotation.prototype.getOperatorList.call(this, evaluator);
                var promise = new Promise();
                var opList = new OperatorList();
                var data = this.data;
                var defaultAppearance = data.defaultAppearance;
                if (!defaultAppearance) {
                    promise.resolve(opList);
                    return promise;
                }
                var stream = new Stream(stringToBytes(defaultAppearance));
                evaluator.getOperatorList(stream, this.fieldResources, opList);
                var appearanceFnArray = opList.fnArray;
                var appearanceArgsArray = opList.argsArray;
                var fnArray = [];
                data.rgb = [ 0, 0, 0 ];
                for (var i = 0, n = fnArray.length; n > i; ++i) {
                    var fnName = appearanceFnArray[i];
                    var args = appearanceArgsArray[i];
                    if ("setFont" === fnName) {
                        data.fontRefName = args[0];
                        var size = args[1];
                        if (0 > size) {
                            data.fontDirection = -1;
                            data.fontSize = -size;
                        } else {
                            data.fontDirection = 1;
                            data.fontSize = size;
                        }
                    } else if ("setFillRGBColor" === fnName) data.rgb = args; else if ("setFillGray" === fnName) {
                        var rgbValue = 255 * args[0];
                        data.rgb = [ rgbValue, rgbValue, rgbValue ];
                    }
                }
                promise.resolve(opList);
                return promise;
            }
        });
        return TextWidgetAnnotation;
    }();
    var TextAnnotation = function() {
        function TextAnnotation(params) {
            Annotation.call(this, params);
            if (params.data) return;
            var dict = params.dict;
            var data = this.data;
            var content = dict.get("Contents");
            var title = dict.get("T");
            data.content = stringToPDFString(content || "");
            data.title = stringToPDFString(title || "");
            data.name = dict.has("Name") ? dict.get("Name").name : "Note";
        }
        var ANNOT_MIN_SIZE = 10;
        Util.inherit(TextAnnotation, Annotation, {
            getOperatorList: function() {
                var promise = new Promise();
                promise.resolve(new OperatorList());
                return promise;
            },
            hasHtml: function() {
                return true;
            },
            getHtmlElement: function() {
                assert(!isWorker, "getHtmlElement() shall be called from main thread");
                var item = this.data;
                var rect = item.rect;
                ANNOT_MIN_SIZE > rect[3] - rect[1] && (rect[3] = rect[1] + ANNOT_MIN_SIZE);
                ANNOT_MIN_SIZE > rect[2] - rect[0] && (rect[2] = rect[0] + (rect[3] - rect[1]));
                var container = this.getEmptyContainer("section", rect);
                container.className = "annotText";
                var image = document.createElement("img");
                image.style.height = container.style.height;
                var iconName = item.name;
                image.src = PDFJS.imageResourcesPath + "annotation-" + iconName.toLowerCase() + ".svg";
                image.alt = "[{{type}} Annotation]";
                image.dataset.l10nId = "text_annotation_type";
                image.dataset.l10nArgs = JSON.stringify({
                    type: iconName
                });
                var content = document.createElement("div");
                content.setAttribute("hidden", true);
                var title = document.createElement("h1");
                var text = document.createElement("p");
                content.style.left = Math.floor(rect[2] - rect[0]) + "px";
                content.style.top = "0px";
                title.textContent = item.title;
                if (item.content || item.title) {
                    var e = document.createElement("span");
                    var lines = item.content.split(/(?:\r\n?|\n)/);
                    for (var i = 0, ii = lines.length; ii > i; ++i) {
                        var line = lines[i];
                        e.appendChild(document.createTextNode(line));
                        ii - 1 > i && e.appendChild(document.createElement("br"));
                    }
                    text.appendChild(e);
                    var showAnnotation = function showAnnotation() {
                        container.style.zIndex += 1;
                        content.removeAttribute("hidden");
                    };
                    var hideAnnotation = function hideAnnotation(e) {
                        if (e.toElement || e.relatedTarget) {
                            container.style.zIndex -= 1;
                            content.setAttribute("hidden", true);
                        }
                    };
                    content.addEventListener("mouseover", showAnnotation, false);
                    content.addEventListener("mouseout", hideAnnotation, false);
                    image.addEventListener("mouseover", showAnnotation, false);
                    image.addEventListener("mouseout", hideAnnotation, false);
                } else content.setAttribute("hidden", true);
                content.appendChild(title);
                content.appendChild(text);
                container.appendChild(image);
                container.appendChild(content);
                return container;
            }
        });
        return TextAnnotation;
    }();
    var LinkAnnotation = function() {
        function LinkAnnotation(params) {
            Annotation.call(this, params);
            if (params.data) return;
            var dict = params.dict;
            var data = this.data;
            var action = dict.get("A");
            if (action) {
                var linkType = action.get("S").name;
                if ("URI" === linkType) {
                    var url = action.get("URI");
                    isValidUrl(url, false) || (url = "");
                    data.url = url;
                } else if ("GoTo" === linkType) data.dest = action.get("D"); else if ("GoToR" === linkType) {
                    var urlDict = action.get("F");
                    isDict(urlDict) && (url = urlDict.get("F") || "");
                    isValidUrl(url, false) || (url = "");
                    data.url = url;
                    data.dest = action.get("D");
                } else "Named" === linkType ? data.action = action.get("N").name : TODO("unrecognized link type: " + linkType);
            } else if (dict.has("Dest")) {
                var dest = dict.get("Dest");
                data.dest = isName(dest) ? dest.name : dest;
            }
        }
        Util.inherit(LinkAnnotation, Annotation, {
            hasOperatorList: function() {
                return false;
            },
            hasHtml: function() {
                return true;
            },
            getHtmlElement: function() {
                var rect = this.data.rect;
                var element = document.createElement("a");
                var borderWidth = this.data.borderWidth;
                element.style.borderWidth = borderWidth + "px";
                var color = this.data.color;
                var rgb = [];
                for (var i = 0; 3 > i; ++i) rgb[i] = Math.round(255 * color[i]);
                element.style.borderColor = Util.makeCssRgb(rgb);
                element.style.borderStyle = "solid";
                var width = rect[2] - rect[0] - 2 * borderWidth;
                var height = rect[3] - rect[1] - 2 * borderWidth;
                element.style.width = width + "px";
                element.style.height = height + "px";
                element.href = this.data.url || "";
                return element;
            }
        });
        return LinkAnnotation;
    }();
    PDFJS.maxImageSize = void 0 === PDFJS.maxImageSize ? -1 : PDFJS.maxImageSize;
    PDFJS.disableFontFace = void 0 === PDFJS.disableFontFace ? false : PDFJS.disableFontFace;
    PDFJS.getDocument = function(source, pdfDataRangeTransport, passwordCallback, progressCallback) {
        var workerInitializedPromise, workerReadyPromise, transport;
        "string" == typeof source ? source = {
            url: source
        } : isArrayBuffer(source) ? source = {
            data: source
        } : "object" != typeof source && error("Invalid parameter in getDocument, need either Uint8Array, string or a parameter object");
        source.url || source.data || error("Invalid parameter array, need either .data or .url");
        var params = {};
        for (var key in source) {
            if ("url" === key && "undefined" != typeof window) {
                params[key] = combineUrl(window.location.href, source[key]);
                continue;
            }
            params[key] = source[key];
        }
        workerInitializedPromise = new PDFJS.Promise();
        workerReadyPromise = new PDFJS.Promise();
        transport = new WorkerTransport(workerInitializedPromise, workerReadyPromise, pdfDataRangeTransport, progressCallback);
        workerInitializedPromise.then(function() {
            transport.passwordCallback = passwordCallback;
            transport.fetchDocument(params);
        });
        return workerReadyPromise;
    };
    var PDFDocumentProxy = function() {
        function PDFDocumentProxy(pdfInfo, transport) {
            this.pdfInfo = pdfInfo;
            this.transport = transport;
        }
        PDFDocumentProxy.prototype = {
            get numPages() {
                return this.pdfInfo.numPages;
            },
            get fingerprint() {
                return this.pdfInfo.fingerprint;
            },
            get embeddedFontsUsed() {
                return this.transport.embeddedFontsUsed;
            },
            getPage: function(number) {
                return this.transport.getPage(number);
            },
            getDestinations: function() {
                return this.transport.getDestinations();
            },
            getJavaScript: function() {
                var promise = new PDFJS.Promise();
                var js = this.pdfInfo.javaScript;
                promise.resolve(js);
                return promise;
            },
            getOutline: function() {
                var promise = new PDFJS.Promise();
                var outline = this.pdfInfo.outline;
                promise.resolve(outline);
                return promise;
            },
            getMetadata: function() {
                var promise = new PDFJS.Promise();
                var info = this.pdfInfo.info;
                var metadata = this.pdfInfo.metadata;
                promise.resolve({
                    info: info,
                    metadata: metadata ? new PDFJS.Metadata(metadata) : null
                });
                return promise;
            },
            isEncrypted: function() {
                var promise = new PDFJS.Promise();
                promise.resolve(this.pdfInfo.encrypted);
                return promise;
            },
            getData: function() {
                var promise = new PDFJS.Promise();
                this.transport.getData(promise);
                return promise;
            },
            dataLoaded: function() {
                return this.transport.dataLoaded();
            },
            destroy: function() {
                this.transport.destroy();
            }
        };
        return PDFDocumentProxy;
    }();
    var PDFPageProxy = function() {
        function PDFPageProxy(pageInfo, transport) {
            this.pageInfo = pageInfo;
            this.transport = transport;
            this.stats = new StatTimer();
            this.stats.enabled = !!globalScope.PDFJS.enableStats;
            this.commonObjs = transport.commonObjs;
            this.objs = new PDFObjects();
            this.receivingOperatorList = false;
            this.cleanupAfterRender = false;
            this.pendingDestroy = false;
            this.renderTasks = [];
        }
        PDFPageProxy.prototype = {
            get pageNumber() {
                return this.pageInfo.pageIndex + 1;
            },
            get rotate() {
                return this.pageInfo.rotate;
            },
            get ref() {
                return this.pageInfo.ref;
            },
            get view() {
                return this.pageInfo.view;
            },
            getViewport: function(scale, rotate) {
                2 > arguments.length && (rotate = this.rotate);
                return new PDFJS.PageViewport(this.view, scale, rotate, 0, 0);
            },
            getAnnotations: function() {
                if (this.annotationsPromise) return this.annotationsPromise;
                var promise = new PDFJS.Promise();
                this.annotationsPromise = promise;
                this.transport.getAnnotations(this.pageInfo.pageIndex);
                return promise;
            },
            render: function(params) {
                function complete(error) {
                    var i = self.renderTasks.indexOf(internalRenderTask);
                    i >= 0 && self.renderTasks.splice(i, 1);
                    self.cleanupAfterRender && (self.pendingDestroy = true);
                    self._tryDestroy();
                    error ? renderTask.reject(error) : renderTask.resolve();
                    stats.timeEnd("Rendering");
                    stats.timeEnd("Overall");
                }
                var stats = this.stats;
                stats.time("Overall");
                this.pendingDestroy = false;
                if (!this.displayReadyPromise) {
                    this.receivingOperatorList = true;
                    this.displayReadyPromise = new Promise();
                    this.operatorList = {
                        fnArray: [],
                        argsArray: [],
                        lastChunk: false
                    };
                    this.stats.time("Page Request");
                    this.transport.messageHandler.send("RenderPageRequest", {
                        pageIndex: this.pageNumber - 1
                    });
                }
                var internalRenderTask = new InternalRenderTask(complete, params, this.objs, this.commonObjs, this.operatorList, this.pageNumber);
                this.renderTasks.push(internalRenderTask);
                var renderTask = new RenderTask(internalRenderTask);
                var self = this;
                this.displayReadyPromise.then(function(transparency) {
                    if (self.pendingDestroy) {
                        complete();
                        return;
                    }
                    stats.time("Rendering");
                    internalRenderTask.initalizeGraphics(transparency);
                    internalRenderTask.operatorListChanged();
                }, function(reason) {
                    complete(reason);
                });
                return renderTask;
            },
            getTextContent: function() {
                var promise = new PDFJS.Promise();
                this.transport.messageHandler.send("GetTextContent", {
                    pageIndex: this.pageNumber - 1
                }, function(textContent) {
                    promise.resolve(textContent);
                });
                return promise;
            },
            getOperationList: function() {
                var promise = new PDFJS.Promise();
                var operationList = {
                    dependencyFontsID: null,
                    operatorList: null
                };
                promise.resolve(operationList);
                return promise;
            },
            destroy: function() {
                this.pendingDestroy = true;
                this._tryDestroy();
            },
            _tryDestroy: function() {
                if (!this.pendingDestroy || 0 !== this.renderTasks.length || this.receivingOperatorList) return;
                delete this.operatorList;
                delete this.displayReadyPromise;
                this.objs.clear();
                this.pendingDestroy = false;
            },
            _startRenderPage: function(transparency) {
                this.displayReadyPromise.resolve(transparency);
            },
            _renderPageChunk: function(operatorListChunk) {
                Util.concatenateToArray(this.operatorList.fnArray, operatorListChunk.fnArray);
                Util.concatenateToArray(this.operatorList.argsArray, operatorListChunk.argsArray);
                this.operatorList.lastChunk = operatorListChunk.lastChunk;
                for (var i = 0; this.renderTasks.length > i; i++) this.renderTasks[i].operatorListChanged();
                if (operatorListChunk.lastChunk) {
                    this.receivingOperatorList = false;
                    this._tryDestroy();
                }
            }
        };
        return PDFPageProxy;
    }();
    var WorkerTransport = function() {
        function WorkerTransport(workerInitializedPromise, workerReadyPromise, pdfDataRangeTransport, progressCallback) {
            this.pdfDataRangeTransport = pdfDataRangeTransport;
            this.workerReadyPromise = workerReadyPromise;
            this.progressCallback = progressCallback;
            this.commonObjs = new PDFObjects();
            this.pageCache = [];
            this.pagePromises = [];
            this.embeddedFontsUsed = false;
            this.passwordCallback = null;
            if (!globalScope.PDFJS.disableWorker && "undefined" != typeof Worker) {
                var workerSrc = PDFJS.workerSrc;
                "undefined" == typeof workerSrc && error("No PDFJS.workerSrc specified");
                try {
                    var worker = new Worker(workerSrc);
                    var messageHandler = new MessageHandler("main", worker);
                    this.messageHandler = messageHandler;
                    messageHandler.on("test", function(supportTypedArray) {
                        if (supportTypedArray) {
                            this.worker = worker;
                            this.setupMessageHandler(messageHandler);
                        } else {
                            globalScope.PDFJS.disableWorker = true;
                            this.setupFakeWorker();
                        }
                        workerInitializedPromise.resolve();
                    }.bind(this));
                    var testObj = new Uint8Array(1);
                    messageHandler.send("test", testObj);
                    return;
                } catch (e) {
                    info("The worker has been disabled.");
                }
            }
            globalScope.PDFJS.disableWorker = true;
            this.loadFakeWorkerFiles().then(function() {
                this.setupFakeWorker();
                workerInitializedPromise.resolve();
            }.bind(this));
        }
        WorkerTransport.prototype = {
            destroy: function() {
                this.pageCache = [];
                this.pagePromises = [];
                var self = this;
                this.messageHandler.send("Terminate", null, function() {
                    self.worker && self.worker.terminate();
                });
            },
            loadFakeWorkerFiles: function() {
                if (!PDFJS.fakeWorkerFilesLoadedPromise) {
                    PDFJS.fakeWorkerFilesLoadedPromise = new Promise();
                    Util.loadScript(PDFJS.workerSrc, function() {
                        PDFJS.fakeWorkerFilesLoadedPromise.resolve();
                    });
                }
                return PDFJS.fakeWorkerFilesLoadedPromise;
            },
            setupFakeWorker: function() {
                warn("Setting up fake worker.");
                var fakeWorker = {
                    postMessage: function(obj) {
                        fakeWorker.onmessage({
                            data: obj
                        });
                    },
                    terminate: function() {}
                };
                var messageHandler = new MessageHandler("main", fakeWorker);
                this.setupMessageHandler(messageHandler);
                PDFJS.WorkerMessageHandler.setup(messageHandler);
            },
            setupMessageHandler: function(messageHandler) {
                function updatePassword(password) {
                    messageHandler.send("UpdatePassword", password);
                }
                this.messageHandler = messageHandler;
                var pdfDataRangeTransport = this.pdfDataRangeTransport;
                if (pdfDataRangeTransport) {
                    pdfDataRangeTransport.addRangeListener(function(begin, chunk) {
                        messageHandler.send("OnDataRange", {
                            begin: begin,
                            chunk: chunk
                        });
                    });
                    pdfDataRangeTransport.addProgressListener(function(loaded) {
                        messageHandler.send("OnDataProgress", {
                            loaded: loaded
                        });
                    });
                    messageHandler.on("RequestDataRange", function(data) {
                        pdfDataRangeTransport.requestDataRange(data.begin, data.end);
                    }, this);
                }
                messageHandler.on("GetDoc", function(data) {
                    var pdfInfo = data.pdfInfo;
                    var pdfDocument = new PDFDocumentProxy(pdfInfo, this);
                    this.pdfDocument = pdfDocument;
                    this.workerReadyPromise.resolve(pdfDocument);
                }, this);
                messageHandler.on("NeedPassword", function(data) {
                    if (this.passwordCallback) return this.passwordCallback(updatePassword, PasswordResponses.NEED_PASSWORD);
                    this.workerReadyPromise.reject(data.exception.message, data.exception);
                }, this);
                messageHandler.on("IncorrectPassword", function(data) {
                    if (this.passwordCallback) return this.passwordCallback(updatePassword, PasswordResponses.INCORRECT_PASSWORD);
                    this.workerReadyPromise.reject(data.exception.message, data.exception);
                }, this);
                messageHandler.on("InvalidPDF", function(data) {
                    this.workerReadyPromise.reject(data.exception.name, data.exception);
                }, this);
                messageHandler.on("MissingPDF", function(data) {
                    this.workerReadyPromise.reject(data.exception.message, data.exception);
                }, this);
                messageHandler.on("UnknownError", function(data) {
                    this.workerReadyPromise.reject(data.exception.message, data.exception);
                }, this);
                messageHandler.on("GetPage", function(data) {
                    var pageInfo = data.pageInfo;
                    var page = new PDFPageProxy(pageInfo, this);
                    this.pageCache[pageInfo.pageIndex] = page;
                    var promise = this.pagePromises[pageInfo.pageIndex];
                    promise.resolve(page);
                }, this);
                messageHandler.on("GetAnnotations", function(data) {
                    var annotations = data.annotations;
                    var promise = this.pageCache[data.pageIndex].annotationsPromise;
                    promise.resolve(annotations);
                }, this);
                messageHandler.on("StartRenderPage", function(data) {
                    var page = this.pageCache[data.pageIndex];
                    page.stats.timeEnd("Page Request");
                    page._startRenderPage(data.transparency);
                }, this);
                messageHandler.on("RenderPageChunk", function(data) {
                    var page = this.pageCache[data.pageIndex];
                    page._renderPageChunk(data.operatorList);
                }, this);
                messageHandler.on("commonobj", function(data) {
                    var id = data[0];
                    var type = data[1];
                    if (this.commonObjs.hasData(id)) return;
                    switch (type) {
                      case "Font":
                        var exportedData = data[2];
                        var font;
                        if ("error" in exportedData) {
                            var error = exportedData.error;
                            warn("Error during font loading: " + error);
                            this.commonObjs.resolve(id, error);
                            break;
                        }
                        font = new FontFace(exportedData);
                        FontLoader.bind([ font ], function() {
                            this.commonObjs.resolve(id, font);
                        }.bind(this));
                        break;

                      case "FontPath":
                        this.commonObjs.resolve(id, data[2]);
                        break;

                      default:
                        error("Got unknown common object type " + type);
                    }
                }, this);
                messageHandler.on("obj", function(data) {
                    var id = data[0];
                    var pageIndex = data[1];
                    var type = data[2];
                    var pageProxy = this.pageCache[pageIndex];
                    if (pageProxy.objs.hasData(id)) return;
                    switch (type) {
                      case "JpegStream":
                        var imageData = data[3];
                        loadJpegStream(id, imageData, pageProxy.objs);
                        break;

                      case "Image":
                        var imageData = data[3];
                        pageProxy.objs.resolve(id, imageData);
                        var MAX_IMAGE_SIZE_TO_STORE = 8e6;
                        "data" in imageData && imageData.data.length > MAX_IMAGE_SIZE_TO_STORE && (pageProxy.cleanupAfterRender = true);
                        break;

                      default:
                        error("Got unknown object type " + type);
                    }
                }, this);
                messageHandler.on("DocProgress", function(data) {
                    this.progressCallback && this.progressCallback({
                        loaded: data.loaded,
                        total: data.total
                    });
                }, this);
                messageHandler.on("DocError", function(data) {
                    this.workerReadyPromise.reject(data);
                }, this);
                messageHandler.on("PageError", function(data) {
                    var page = this.pageCache[data.pageNum - 1];
                    page.displayReadyPromise ? page.displayReadyPromise.reject(data.error) : error(data.error);
                }, this);
                messageHandler.on("JpegDecode", function(data, promise) {
                    var imageData = data[0];
                    var components = data[1];
                    3 != components && 1 != components && error("Only 3 component or 1 component can be returned");
                    var img = new Image();
                    img.onload = function() {
                        var width = img.width;
                        var height = img.height;
                        var size = width * height;
                        var rgbaLength = 4 * size;
                        var buf = new Uint8Array(size * components);
                        var tmpCanvas = createScratchCanvas(width, height);
                        var tmpCtx = tmpCanvas.getContext("2d");
                        tmpCtx.drawImage(img, 0, 0);
                        var data = tmpCtx.getImageData(0, 0, width, height).data;
                        if (3 == components) for (var i = 0, j = 0; rgbaLength > i; i += 4, j += 3) {
                            buf[j] = data[i];
                            buf[j + 1] = data[i + 1];
                            buf[j + 2] = data[i + 2];
                        } else if (1 == components) for (var i = 0, j = 0; rgbaLength > i; i += 4, j++) buf[j] = data[i];
                        promise.resolve({
                            data: buf,
                            width: width,
                            height: height
                        });
                    }.bind(this);
                    var src = "data:image/jpeg;base64," + window.btoa(imageData);
                    img.src = src;
                });
            },
            fetchDocument: function(source) {
                source.disableAutoFetch = PDFJS.disableAutoFetch;
                source.chunkedViewerLoading = !!this.pdfDataRangeTransport;
                this.messageHandler.send("GetDocRequest", {
                    source: source,
                    disableRange: PDFJS.disableRange,
                    maxImageSize: PDFJS.maxImageSize,
                    disableFontFace: PDFJS.disableFontFace
                });
            },
            getData: function(promise) {
                this.messageHandler.send("GetData", null, function(data) {
                    promise.resolve(data);
                });
            },
            dataLoaded: function() {
                var promise = new PDFJS.Promise();
                this.messageHandler.send("DataLoaded", null, function(args) {
                    promise.resolve(args);
                });
                return promise;
            },
            getPage: function(pageNumber, promise) {
                var pageIndex = pageNumber - 1;
                if (pageIndex in this.pagePromises) return this.pagePromises[pageIndex];
                var promise = new PDFJS.Promise("Page " + pageNumber);
                this.pagePromises[pageIndex] = promise;
                this.messageHandler.send("GetPageRequest", {
                    pageIndex: pageIndex
                });
                return promise;
            },
            getAnnotations: function(pageIndex) {
                this.messageHandler.send("GetAnnotationsRequest", {
                    pageIndex: pageIndex
                });
            },
            getDestinations: function() {
                var promise = new PDFJS.Promise();
                this.messageHandler.send("GetDestinations", null, function(destinations) {
                    promise.resolve(destinations);
                });
                return promise;
            }
        };
        return WorkerTransport;
    }();
    var PDFObjects = function() {
        function PDFObjects() {
            this.objs = {};
        }
        PDFObjects.prototype = {
            ensureObj: function(objId) {
                if (this.objs[objId]) return this.objs[objId];
                var obj = {
                    promise: new Promise(objId),
                    data: null,
                    resolved: false
                };
                this.objs[objId] = obj;
                return obj;
            },
            get: function(objId, callback) {
                if (callback) {
                    this.ensureObj(objId).promise.then(callback);
                    return null;
                }
                var obj = this.objs[objId];
                obj && obj.resolved || error("Requesting object that isn't resolved yet " + objId);
                return obj.data;
            },
            resolve: function(objId, data) {
                var obj = this.ensureObj(objId);
                obj.resolved = true;
                obj.data = data;
                obj.promise.resolve(data);
            },
            isResolved: function(objId) {
                var objs = this.objs;
                return objs[objId] ? objs[objId].resolved : false;
            },
            hasData: function(objId) {
                return this.isResolved(objId);
            },
            getData: function(objId) {
                var objs = this.objs;
                return objs[objId] && objs[objId].resolved ? objs[objId].data : null;
            },
            clear: function() {
                this.objs = {};
            }
        };
        return PDFObjects;
    }();
    var RenderTask = function() {
        function RenderTask(internalRenderTask) {
            this.internalRenderTask = internalRenderTask;
            Promise.call(this);
        }
        RenderTask.prototype = Object.create(Promise.prototype);
        RenderTask.prototype.cancel = function() {
            this.internalRenderTask.cancel();
        };
        return RenderTask;
    }();
    var InternalRenderTask = function() {
        function InternalRenderTask(callback, params, objs, commonObjs, operatorList, pageNumber) {
            this.callback = callback;
            this.params = params;
            this.objs = objs;
            this.commonObjs = commonObjs;
            this.operatorListIdx = null;
            this.operatorList = operatorList;
            this.pageNumber = pageNumber;
            this.running = false;
            this.graphicsReadyCallback = null;
            this.graphicsReady = false;
            this.cancelled = false;
        }
        InternalRenderTask.prototype = {
            initalizeGraphics: function(transparency) {
                if (this.cancelled) return;
                if (PDFJS.pdfBug && "StepperManager" in globalScope && globalScope.StepperManager.enabled) {
                    this.stepper = globalScope.StepperManager.create(this.pageNumber - 1);
                    this.stepper.init(this.operatorList);
                    this.stepper.nextBreakPoint = this.stepper.getNextBreakPoint();
                }
                var params = this.params;
                this.gfx = new CanvasGraphics(params.canvasContext, this.commonObjs, this.objs, params.textLayer, params.imageLayer);
                this.gfx.beginDrawing(params.viewport, transparency);
                this.operatorListIdx = 0;
                this.graphicsReady = true;
                this.graphicsReadyCallback && this.graphicsReadyCallback();
            },
            cancel: function() {
                this.running = false;
                this.cancelled = true;
                this.callback("cancelled");
            },
            operatorListChanged: function() {
                if (!this.graphicsReady) {
                    this.graphicsReadyCallback || (this.graphicsReadyCallback = this._continue.bind(this));
                    return;
                }
                this.stepper && this.stepper.updateOperatorList(this.operatorList);
                if (this.running) return;
                this._continue();
            },
            _continue: function() {
                this.running = true;
                if (this.cancelled) return;
                this.params.continueCallback ? this.params.continueCallback(this._next.bind(this)) : this._next();
            },
            _next: function() {
                if (this.cancelled) return;
                this.operatorListIdx = this.gfx.executeOperatorList(this.operatorList, this.operatorListIdx, this._continue.bind(this), this.stepper);
                if (this.operatorListIdx === this.operatorList.fnArray.length) {
                    this.running = false;
                    if (this.operatorList.lastChunk) {
                        this.gfx.endDrawing();
                        this.callback();
                    }
                }
            }
        };
        return InternalRenderTask;
    }();
    PDFJS.Metadata = function() {
        function fixMetadata(meta) {
            return meta.replace(/>\\376\\377([^<]+)/g, function(all, codes) {
                var bytes = codes.replace(/\\([0-3])([0-7])([0-7])/g, function(code, d1, d2, d3) {
                    return String.fromCharCode(64 * d1 + 8 * d2 + 1 * d3);
                });
                var chars = "";
                for (var i = 0; bytes.length > i; i += 2) {
                    var code = 256 * bytes.charCodeAt(i) + bytes.charCodeAt(i + 1);
                    chars += code >= 32 && 127 > code && 60 != code && 62 != code && 38 != code && false ? String.fromCharCode(code) : "&#x" + (65536 + code).toString(16).substring(1) + ";";
                }
                return ">" + chars;
            });
        }
        function Metadata(meta) {
            if ("string" == typeof meta) {
                meta = fixMetadata(meta);
                var parser = new DOMParser();
                meta = parser.parseFromString(meta, "application/xml");
            } else meta instanceof Document || error("Metadata: Invalid metadata object");
            this.metaDocument = meta;
            this.metadata = {};
            this.parse();
        }
        Metadata.prototype = {
            parse: function() {
                var doc = this.metaDocument;
                var rdf = doc.documentElement;
                if ("rdf:rdf" !== rdf.nodeName.toLowerCase()) {
                    rdf = rdf.firstChild;
                    while (rdf && "rdf:rdf" !== rdf.nodeName.toLowerCase()) rdf = rdf.nextSibling;
                }
                var nodeName = rdf ? rdf.nodeName.toLowerCase() : null;
                if (!rdf || "rdf:rdf" !== nodeName || !rdf.hasChildNodes()) return;
                var desc, entry, name, i, ii, length, iLength, children = rdf.childNodes;
                for (i = 0, length = children.length; length > i; i++) {
                    desc = children[i];
                    if ("rdf:description" !== desc.nodeName.toLowerCase()) continue;
                    for (ii = 0, iLength = desc.childNodes.length; iLength > ii; ii++) if ("#text" !== desc.childNodes[ii].nodeName.toLowerCase()) {
                        entry = desc.childNodes[ii];
                        name = entry.nodeName.toLowerCase();
                        this.metadata[name] = entry.textContent.trim();
                    }
                }
            },
            get: function(name) {
                return this.metadata[name] || null;
            },
            has: function(name) {
                return "undefined" != typeof this.metadata[name];
            }
        };
        return Metadata;
    }();
    var MIN_FONT_SIZE = 16;
    var COMPILE_TYPE3_GLYPHS = true;
    var CachedCanvases = function() {
        var cache = {};
        return {
            getCanvas: function(id, width, height, trackTransform) {
                var canvasEntry;
                if (id in cache) {
                    canvasEntry = cache[id];
                    canvasEntry.canvas.width = width;
                    canvasEntry.canvas.height = height;
                    canvasEntry.context.setTransform(1, 0, 0, 1, 0, 0);
                } else {
                    var canvas = createScratchCanvas(width, height);
                    var ctx = canvas.getContext("2d");
                    trackTransform && addContextCurrentTransform(ctx);
                    cache[id] = canvasEntry = {
                        canvas: canvas,
                        context: ctx
                    };
                }
                return canvasEntry;
            },
            clear: function() {
                cache = {};
            }
        };
    }();
    var CanvasExtraState = function() {
        function CanvasExtraState(old) {
            this.alphaIsShape = false;
            this.fontSize = 0;
            this.fontSizeScale = 1;
            this.textMatrix = IDENTITY_MATRIX;
            this.fontMatrix = FONT_IDENTITY_MATRIX;
            this.leading = 0;
            this.x = 0;
            this.y = 0;
            this.lineX = 0;
            this.lineY = 0;
            this.charSpacing = 0;
            this.wordSpacing = 0;
            this.textHScale = 1;
            this.textRenderingMode = TextRenderingMode.FILL;
            this.textRise = 0;
            this.fillColorSpace = ColorSpace.singletons.gray;
            this.fillColorSpaceObj = null;
            this.strokeColorSpace = ColorSpace.singletons.gray;
            this.strokeColorSpaceObj = null;
            this.fillColorObj = null;
            this.strokeColorObj = null;
            this.fillColor = "#000000";
            this.strokeColor = "#000000";
            this.fillAlpha = 1;
            this.strokeAlpha = 1;
            this.lineWidth = 1;
            this.paintFormXObjectDepth = 0;
            this.old = old;
        }
        CanvasExtraState.prototype = {
            clone: function() {
                return Object.create(this);
            },
            setCurrentPoint: function(x, y) {
                this.x = x;
                this.y = y;
            }
        };
        return CanvasExtraState;
    }();
    var CanvasGraphics = function() {
        function CanvasGraphics(canvasCtx, commonObjs, objs, textLayer, imageLayer) {
            this.ctx = canvasCtx;
            this.current = new CanvasExtraState();
            this.stateStack = [];
            this.pendingClip = null;
            this.pendingEOFill = false;
            this.res = null;
            this.xobjs = null;
            this.commonObjs = commonObjs;
            this.objs = objs;
            this.textLayer = textLayer;
            this.imageLayer = imageLayer;
            this.groupStack = [];
            this.processingType3 = null;
            this.baseTransform = null;
            this.baseTransformStack = [];
            this.groupLevel = 0;
            canvasCtx && addContextCurrentTransform(canvasCtx);
        }
        function putBinaryImageData(ctx, imgData) {
            if ("undefined" != typeof ImageData && imgData instanceof ImageData) {
                ctx.putImageData(imgData, 0, 0);
                return;
            }
            var tmpImgData = ctx.createImageData(imgData.width, imgData.height);
            var data = imgData.data;
            var tmpImgDataPixels = tmpImgData.data;
            if ("set" in tmpImgDataPixels) tmpImgDataPixels.set(data); else for (var i = 0, ii = tmpImgDataPixels.length; ii > i; i++) tmpImgDataPixels[i] = data[i];
            ctx.putImageData(tmpImgData, 0, 0);
        }
        function copyCtxState(sourceCtx, destCtx) {
            var properties = [ "strokeStyle", "fillStyle", "fillRule", "globalAlpha", "lineWidth", "lineCap", "lineJoin", "miterLimit", "globalCompositeOperation", "font" ];
            for (var i = 0, ii = properties.length; ii > i; i++) {
                var property = properties[i];
                property in sourceCtx && (destCtx[property] = sourceCtx[property]);
            }
            if ("setLineDash" in sourceCtx) {
                destCtx.setLineDash(sourceCtx.getLineDash());
                destCtx.lineDashOffset = sourceCtx.lineDashOffset;
            } else if ("mozDash" in sourceCtx) {
                destCtx.mozDash = sourceCtx.mozDash;
                destCtx.mozDashOffset = sourceCtx.mozDashOffset;
            }
        }
        var EXECUTION_TIME = 15;
        var LINE_CAP_STYLES = [ "butt", "round", "square" ];
        var LINE_JOIN_STYLES = [ "miter", "round", "bevel" ];
        var NORMAL_CLIP = {};
        var EO_CLIP = {};
        CanvasGraphics.prototype = {
            slowCommands: {
                stroke: true,
                closeStroke: true,
                fill: true,
                eoFill: true,
                fillStroke: true,
                eoFillStroke: true,
                closeFillStroke: true,
                closeEOFillStroke: true,
                showText: true,
                showSpacedText: true,
                setStrokeColorSpace: true,
                setFillColorSpace: true,
                setStrokeColor: true,
                setStrokeColorN: true,
                setFillColor: true,
                setFillColorN: true,
                setStrokeGray: true,
                setFillGray: true,
                setStrokeRGBColor: true,
                setFillRGBColor: true,
                setStrokeCMYKColor: true,
                setFillCMYKColor: true,
                paintJpegXObject: true,
                paintImageXObject: true,
                paintInlineImageXObject: true,
                paintInlineImageXObjectGroup: true,
                paintImageMaskXObject: true,
                paintImageMaskXObjectGroup: true,
                shadingFill: true
            },
            beginDrawing: function(viewport, transparency) {
                var width = this.ctx.canvas.width;
                var height = this.ctx.canvas.height;
                if (transparency) this.ctx.clearRect(0, 0, width, height); else {
                    this.ctx.mozOpaque = true;
                    this.ctx.save();
                    this.ctx.fillStyle = "rgb(255, 255, 255)";
                    this.ctx.fillRect(0, 0, width, height);
                    this.ctx.restore();
                }
                var transform = viewport.transform;
                this.baseTransform = transform.slice();
                this.ctx.save();
                this.ctx.transform.apply(this.ctx, transform);
                this.textLayer && this.textLayer.beginLayout();
                this.imageLayer && this.imageLayer.beginLayout();
            },
            executeOperatorList: function(operatorList, executionStartIdx, continueCallback, stepper) {
                var argsArray = operatorList.argsArray;
                var fnArray = operatorList.fnArray;
                var i = executionStartIdx || 0;
                var argsArrayLen = argsArray.length;
                if (argsArrayLen == i) return i;
                var endTime = Date.now() + EXECUTION_TIME;
                var commonObjs = this.commonObjs;
                var objs = this.objs;
                var fnName;
                var slowCommands = this.slowCommands;
                while (true) {
                    if (stepper && i === stepper.nextBreakPoint) {
                        stepper.breakIt(i, continueCallback);
                        return i;
                    }
                    fnName = fnArray[i];
                    if ("dependency" !== fnName) this[fnName].apply(this, argsArray[i]); else {
                        var deps = argsArray[i];
                        for (var n = 0, nn = deps.length; nn > n; n++) {
                            var depObjId = deps[n];
                            var common = "g_" == depObjId.substring(0, 2);
                            if (!common && !objs.isResolved(depObjId)) {
                                objs.get(depObjId, continueCallback);
                                return i;
                            }
                            if (common && !commonObjs.isResolved(depObjId)) {
                                commonObjs.get(depObjId, continueCallback);
                                return i;
                            }
                        }
                    }
                    i++;
                    if (i == argsArrayLen) return i;
                    if (continueCallback && slowCommands[fnName] && Date.now() > endTime) {
                        setTimeout(continueCallback, 0);
                        return i;
                    }
                }
            },
            endDrawing: function() {
                this.ctx.restore();
                CachedCanvases.clear();
                this.textLayer && this.textLayer.endLayout();
                this.imageLayer && this.imageLayer.endLayout();
            },
            setLineWidth: function(width) {
                this.current.lineWidth = width;
                this.ctx.lineWidth = width;
            },
            setLineCap: function(style) {
                this.ctx.lineCap = LINE_CAP_STYLES[style];
            },
            setLineJoin: function(style) {
                this.ctx.lineJoin = LINE_JOIN_STYLES[style];
            },
            setMiterLimit: function(limit) {
                this.ctx.miterLimit = limit;
            },
            setDash: function(dashArray, dashPhase) {
                var ctx = this.ctx;
                if ("setLineDash" in ctx) {
                    ctx.setLineDash(dashArray);
                    ctx.lineDashOffset = dashPhase;
                } else {
                    ctx.mozDash = dashArray;
                    ctx.mozDashOffset = dashPhase;
                }
            },
            setRenderingIntent: function() {},
            setFlatness: function() {},
            setGState: function(states) {
                for (var i = 0, ii = states.length; ii > i; i++) {
                    var state = states[i];
                    var key = state[0];
                    var value = state[1];
                    switch (key) {
                      case "LW":
                        this.setLineWidth(value);
                        break;

                      case "LC":
                        this.setLineCap(value);
                        break;

                      case "LJ":
                        this.setLineJoin(value);
                        break;

                      case "ML":
                        this.setMiterLimit(value);
                        break;

                      case "D":
                        this.setDash(value[0], value[1]);
                        break;

                      case "RI":
                        this.setRenderingIntent(value);
                        break;

                      case "FL":
                        this.setFlatness(value);
                        break;

                      case "Font":
                        this.setFont(value[0], value[1]);
                        break;

                      case "CA":
                        this.current.strokeAlpha = state[1];
                        break;

                      case "ca":
                        this.current.fillAlpha = state[1];
                        this.ctx.globalAlpha = state[1];
                        break;

                      case "BM":
                        if (value && value.name && "Normal" !== value.name) {
                            var mode = value.name.replace(/([A-Z])/g, function(c) {
                                return "-" + c.toLowerCase();
                            }).substring(1);
                            this.ctx.globalCompositeOperation = mode;
                            this.ctx.globalCompositeOperation !== mode && warn('globalCompositeOperation "' + mode + '" is not supported');
                        } else this.ctx.globalCompositeOperation = "source-over";
                    }
                }
            },
            save: function() {
                this.ctx.save();
                var old = this.current;
                this.stateStack.push(old);
                this.current = old.clone();
            },
            restore: function() {
                var prev = this.stateStack.pop();
                if (prev) {
                    this.current = prev;
                    this.ctx.restore();
                }
            },
            transform: function(a, b, c, d, e, f) {
                this.ctx.transform(a, b, c, d, e, f);
            },
            moveTo: function(x, y) {
                this.ctx.moveTo(x, y);
                this.current.setCurrentPoint(x, y);
            },
            lineTo: function(x, y) {
                this.ctx.lineTo(x, y);
                this.current.setCurrentPoint(x, y);
            },
            curveTo: function(x1, y1, x2, y2, x3, y3) {
                this.ctx.bezierCurveTo(x1, y1, x2, y2, x3, y3);
                this.current.setCurrentPoint(x3, y3);
            },
            curveTo2: function(x2, y2, x3, y3) {
                var current = this.current;
                this.ctx.bezierCurveTo(current.x, current.y, x2, y2, x3, y3);
                current.setCurrentPoint(x3, y3);
            },
            curveTo3: function(x1, y1, x3, y3) {
                this.curveTo(x1, y1, x3, y3, x3, y3);
                this.current.setCurrentPoint(x3, y3);
            },
            closePath: function() {
                this.ctx.closePath();
            },
            rectangle: function(x, y, width, height) {
                this.ctx.rect(x, y, width, height);
            },
            stroke: function(consumePath) {
                consumePath = "undefined" != typeof consumePath ? consumePath : true;
                var ctx = this.ctx;
                var strokeColor = this.current.strokeColor;
                0 === this.current.lineWidth && (ctx.lineWidth = this.getSinglePixelWidth());
                ctx.globalAlpha = this.current.strokeAlpha;
                if (strokeColor && strokeColor.hasOwnProperty("type") && "Pattern" === strokeColor.type) {
                    ctx.save();
                    ctx.strokeStyle = strokeColor.getPattern(ctx, this);
                    ctx.stroke();
                    ctx.restore();
                } else ctx.stroke();
                consumePath && this.consumePath();
                ctx.globalAlpha = this.current.fillAlpha;
            },
            closeStroke: function() {
                this.closePath();
                this.stroke();
            },
            fill: function(consumePath) {
                consumePath = "undefined" != typeof consumePath ? consumePath : true;
                var ctx = this.ctx;
                var fillColor = this.current.fillColor;
                var needRestore = false;
                if (fillColor && fillColor.hasOwnProperty("type") && "Pattern" === fillColor.type) {
                    ctx.save();
                    ctx.fillStyle = fillColor.getPattern(ctx, this);
                    needRestore = true;
                }
                if (this.pendingEOFill) {
                    if ("mozFillRule" in this.ctx) {
                        this.ctx.mozFillRule = "evenodd";
                        this.ctx.fill();
                        this.ctx.mozFillRule = "nonzero";
                    } else try {
                        this.ctx.fill("evenodd");
                    } catch (ex) {
                        this.ctx.fill();
                    }
                    this.pendingEOFill = false;
                } else this.ctx.fill();
                needRestore && ctx.restore();
                consumePath && this.consumePath();
            },
            eoFill: function() {
                this.pendingEOFill = true;
                this.fill();
            },
            fillStroke: function() {
                this.fill(false);
                this.stroke(false);
                this.consumePath();
            },
            eoFillStroke: function() {
                this.pendingEOFill = true;
                this.fillStroke();
            },
            closeFillStroke: function() {
                this.closePath();
                this.fillStroke();
            },
            closeEOFillStroke: function() {
                this.pendingEOFill = true;
                this.closePath();
                this.fillStroke();
            },
            endPath: function() {
                this.consumePath();
            },
            clip: function() {
                this.pendingClip = NORMAL_CLIP;
            },
            eoClip: function() {
                this.pendingClip = EO_CLIP;
            },
            beginText: function() {
                this.current.textMatrix = IDENTITY_MATRIX;
                this.current.x = this.current.lineX = 0;
                this.current.y = this.current.lineY = 0;
            },
            endText: function() {
                if (!("pendingTextPaths" in this)) {
                    this.ctx.beginPath();
                    return;
                }
                var paths = this.pendingTextPaths;
                var ctx = this.ctx;
                ctx.save();
                ctx.beginPath();
                for (var i = 0; paths.length > i; i++) {
                    var path = paths[i];
                    ctx.setTransform.apply(ctx, path.transform);
                    ctx.translate(path.x, path.y);
                    path.addToPath(ctx, path.fontSize);
                }
                ctx.restore();
                ctx.clip();
                ctx.beginPath();
                delete this.pendingTextPaths;
            },
            setCharSpacing: function(spacing) {
                this.current.charSpacing = spacing;
            },
            setWordSpacing: function(spacing) {
                this.current.wordSpacing = spacing;
            },
            setHScale: function(scale) {
                this.current.textHScale = scale / 100;
            },
            setLeading: function(leading) {
                this.current.leading = -leading;
            },
            setFont: function(fontRefName, size) {
                var fontObj = this.commonObjs.get(fontRefName);
                var current = this.current;
                fontObj || error("Can't find font for " + fontRefName);
                current.fontMatrix = fontObj.fontMatrix ? fontObj.fontMatrix : FONT_IDENTITY_MATRIX;
                (0 === current.fontMatrix[0] || 0 === current.fontMatrix[3]) && warn("Invalid font matrix for font " + fontRefName);
                if (0 > size) {
                    size = -size;
                    current.fontDirection = -1;
                } else current.fontDirection = 1;
                this.current.font = fontObj;
                this.current.fontSize = size;
                if (fontObj.coded) return;
                var name = fontObj.loadedName || "sans-serif";
                var bold = fontObj.black ? fontObj.bold ? "bolder" : "bold" : fontObj.bold ? "bold" : "normal";
                var italic = fontObj.italic ? "italic" : "normal";
                var typeface = '"' + name + '", ' + fontObj.fallbackName;
                var browserFontSize = size >= MIN_FONT_SIZE ? size : MIN_FONT_SIZE;
                this.current.fontSizeScale = browserFontSize != MIN_FONT_SIZE ? 1 : size / MIN_FONT_SIZE;
                var rule = italic + " " + bold + " " + browserFontSize + "px " + typeface;
                this.ctx.font = rule;
            },
            setTextRenderingMode: function(mode) {
                this.current.textRenderingMode = mode;
            },
            setTextRise: function(rise) {
                this.current.textRise = rise;
            },
            moveText: function(x, y) {
                this.current.x = this.current.lineX += x;
                this.current.y = this.current.lineY += y;
            },
            setLeadingMoveText: function(x, y) {
                this.setLeading(-y);
                this.moveText(x, y);
            },
            setTextMatrix: function(a, b, c, d, e, f) {
                this.current.textMatrix = [ a, b, c, d, e, f ];
                this.current.x = this.current.lineX = 0;
                this.current.y = this.current.lineY = 0;
            },
            nextLine: function() {
                this.moveText(0, this.current.leading);
            },
            applyTextTransforms: function() {
                var ctx = this.ctx;
                var current = this.current;
                ctx.transform.apply(ctx, current.textMatrix);
                ctx.translate(current.x, current.y + current.textRise);
                current.fontDirection > 0 ? ctx.scale(current.textHScale, -1) : ctx.scale(-current.textHScale, 1);
            },
            createTextGeometry: function() {
                var geometry = {};
                var ctx = this.ctx;
                var font = this.current.font;
                var ctxMatrix = ctx.mozCurrentTransform;
                var a = ctxMatrix[0], b = ctxMatrix[1], c = ctxMatrix[2];
                var d = ctxMatrix[3], e = ctxMatrix[4], f = ctxMatrix[5];
                var sx = a >= 0 ? Math.sqrt(a * a + b * b) : -Math.sqrt(a * a + b * b);
                var sy = d >= 0 ? Math.sqrt(c * c + d * d) : -Math.sqrt(c * c + d * d);
                var angle = Math.atan2(b, a);
                var x = e;
                var y = f;
                geometry.x = x;
                geometry.y = y;
                geometry.hScale = sx;
                geometry.vScale = sy;
                geometry.angle = angle;
                geometry.spaceWidth = font.spaceWidth;
                geometry.fontName = font.loadedName;
                geometry.fontFamily = font.fallbackName;
                geometry.fontSize = this.current.fontSize;
                return geometry;
            },
            paintChar: function(character, x, y) {
                var ctx = this.ctx;
                var current = this.current;
                var font = current.font;
                var fontSize = current.fontSize / current.fontSizeScale;
                var textRenderingMode = current.textRenderingMode;
                var fillStrokeMode = textRenderingMode & TextRenderingMode.FILL_STROKE_MASK;
                var isAddToPathSet = !!(textRenderingMode & TextRenderingMode.ADD_TO_PATH_FLAG);
                var addToPath;
                (font.disableFontFace || isAddToPathSet) && (addToPath = font.getPathGenerator(this.commonObjs, character));
                if (font.disableFontFace) {
                    ctx.save();
                    ctx.translate(x, y);
                    ctx.beginPath();
                    addToPath(ctx, fontSize);
                    (fillStrokeMode === TextRenderingMode.FILL || fillStrokeMode === TextRenderingMode.FILL_STROKE) && ctx.fill();
                    (fillStrokeMode === TextRenderingMode.STROKE || fillStrokeMode === TextRenderingMode.FILL_STROKE) && ctx.stroke();
                    ctx.restore();
                } else {
                    (fillStrokeMode === TextRenderingMode.FILL || fillStrokeMode === TextRenderingMode.FILL_STROKE) && ctx.fillText(character, x, y);
                    (fillStrokeMode === TextRenderingMode.STROKE || fillStrokeMode === TextRenderingMode.FILL_STROKE) && ctx.strokeText(character, x, y);
                }
                if (isAddToPathSet) {
                    var paths = this.pendingTextPaths || (this.pendingTextPaths = []);
                    paths.push({
                        transform: ctx.mozCurrentTransform,
                        x: x,
                        y: y,
                        fontSize: fontSize,
                        addToPath: addToPath
                    });
                }
            },
            showText: function(glyphs, skipTextSelection) {
                var ctx = this.ctx;
                var current = this.current;
                var font = current.font;
                var fontSize = current.fontSize;
                var fontSizeScale = current.fontSizeScale;
                var charSpacing = current.charSpacing;
                var wordSpacing = current.wordSpacing;
                var textHScale = current.textHScale * current.fontDirection;
                var fontMatrix = current.fontMatrix || FONT_IDENTITY_MATRIX;
                var glyphsLength = glyphs.length;
                var textLayer = this.textLayer;
                var geom;
                var textSelection = textLayer && !skipTextSelection ? true : false;
                var canvasWidth = 0;
                var vertical = font.vertical;
                var defaultVMetrics = font.defaultVMetrics;
                if (font.coded) {
                    ctx.save();
                    ctx.transform.apply(ctx, current.textMatrix);
                    ctx.translate(current.x, current.y);
                    ctx.scale(textHScale, 1);
                    if (textSelection) {
                        this.save();
                        ctx.scale(1, -1);
                        geom = this.createTextGeometry();
                        this.restore();
                    }
                    for (var i = 0; glyphsLength > i; ++i) {
                        var glyph = glyphs[i];
                        if (null === glyph) {
                            this.ctx.translate(wordSpacing, 0);
                            current.x += wordSpacing * textHScale;
                            continue;
                        }
                        this.processingType3 = glyph;
                        this.save();
                        ctx.scale(fontSize, fontSize);
                        ctx.transform.apply(ctx, fontMatrix);
                        this.executeOperatorList(glyph.operatorList);
                        this.restore();
                        var transformed = Util.applyTransform([ glyph.width, 0 ], fontMatrix);
                        var width = (transformed[0] * fontSize + charSpacing) * current.fontDirection;
                        ctx.translate(width, 0);
                        current.x += width * textHScale;
                        canvasWidth += width;
                    }
                    ctx.restore();
                    this.processingType3 = null;
                } else {
                    ctx.save();
                    this.applyTextTransforms();
                    var lineWidth = current.lineWidth;
                    var a1 = current.textMatrix[0], b1 = current.textMatrix[1];
                    var scale = Math.sqrt(a1 * a1 + b1 * b1);
                    0 === scale || 0 === lineWidth ? lineWidth = this.getSinglePixelWidth() : lineWidth /= scale;
                    textSelection && (geom = this.createTextGeometry());
                    if (1 != fontSizeScale) {
                        ctx.scale(fontSizeScale, fontSizeScale);
                        lineWidth /= fontSizeScale;
                    }
                    ctx.lineWidth = lineWidth;
                    var x = 0;
                    for (var i = 0; glyphsLength > i; ++i) {
                        var glyph = glyphs[i];
                        if (null === glyph) {
                            x += current.fontDirection * wordSpacing;
                            continue;
                        }
                        var restoreNeeded = false;
                        var character = glyph.fontChar;
                        var vmetric = glyph.vmetric || defaultVMetrics;
                        if (vertical) {
                            var vx = glyph.vmetric ? vmetric[1] : .5 * glyph.width;
                            vx = -vx * fontSize * current.fontMatrix[0];
                            var vy = vmetric[2] * fontSize * current.fontMatrix[0];
                        }
                        var width = vmetric ? -vmetric[0] : glyph.width;
                        var charWidth = width * fontSize * current.fontMatrix[0] + charSpacing * current.fontDirection;
                        var accent = glyph.accent;
                        var scaledX, scaledY, scaledAccentX, scaledAccentY;
                        if (!glyph.disabled) {
                            if (vertical) {
                                scaledX = vx / fontSizeScale;
                                scaledY = (x + vy) / fontSizeScale;
                            } else {
                                scaledX = x / fontSizeScale;
                                scaledY = 0;
                            }
                            if (font.remeasure && width > 0) {
                                var measuredWidth = 1e3 * ctx.measureText(character).width / current.fontSize * current.fontSizeScale;
                                var characterScaleX = width / measuredWidth;
                                restoreNeeded = true;
                                ctx.save();
                                ctx.scale(characterScaleX, 1);
                                scaledX /= characterScaleX;
                                accent && (scaledAccentX /= characterScaleX);
                            }
                            this.paintChar(character, scaledX, scaledY);
                            if (accent) {
                                scaledAccentX = scaledX + accent.offset.x / fontSizeScale;
                                scaledAccentY = scaledY - accent.offset.y / fontSizeScale;
                                this.paintChar(accent.fontChar, scaledAccentX, scaledAccentY);
                            }
                        }
                        x += charWidth;
                        canvasWidth += charWidth;
                        restoreNeeded && ctx.restore();
                    }
                    vertical ? current.y -= x * textHScale : current.x += x * textHScale;
                    ctx.restore();
                }
                if (textSelection) {
                    geom.canvasWidth = canvasWidth;
                    if (vertical) {
                        var VERTICAL_TEXT_ROTATION = Math.PI / 2;
                        geom.angle += VERTICAL_TEXT_ROTATION;
                    }
                    this.textLayer.appendText(geom);
                }
                return canvasWidth;
            },
            showSpacedText: function(arr) {
                var ctx = this.ctx;
                var current = this.current;
                var font = current.font;
                var fontSize = current.fontSize;
                var textHScale = .001 * current.textHScale * current.fontDirection;
                var arrLength = arr.length;
                var textLayer = this.textLayer;
                var geom;
                var canvasWidth = 0;
                var textSelection = textLayer ? true : false;
                var vertical = font.vertical;
                var spacingAccumulator = 0;
                if (textSelection) {
                    ctx.save();
                    this.applyTextTransforms();
                    geom = this.createTextGeometry();
                    ctx.restore();
                }
                for (var i = 0; arrLength > i; ++i) {
                    var e = arr[i];
                    if (isNum(e)) {
                        var spacingLength = -e * fontSize * textHScale;
                        vertical ? current.y += spacingLength : current.x += spacingLength;
                        textSelection && (spacingAccumulator += spacingLength);
                    } else {
                        var shownCanvasWidth = this.showText(e, true);
                        if (textSelection) {
                            canvasWidth += spacingAccumulator + shownCanvasWidth;
                            spacingAccumulator = 0;
                        }
                    }
                }
                if (textSelection) {
                    geom.canvasWidth = canvasWidth;
                    if (vertical) {
                        var VERTICAL_TEXT_ROTATION = Math.PI / 2;
                        geom.angle += VERTICAL_TEXT_ROTATION;
                    }
                    this.textLayer.appendText(geom);
                }
            },
            nextLineShowText: function(text) {
                this.nextLine();
                this.showText(text);
            },
            nextLineSetSpacingShowText: function(wordSpacing, charSpacing, text) {
                this.setWordSpacing(wordSpacing);
                this.setCharSpacing(charSpacing);
                this.nextLineShowText(text);
            },
            setCharWidth: function() {},
            setCharWidthAndBounds: function(xWidth, yWidth, llx, lly, urx, ury) {
                this.rectangle(llx, lly, urx - llx, ury - lly);
                this.clip();
                this.endPath();
            },
            setStrokeColorSpace: function(raw) {
                this.current.strokeColorSpace = ColorSpace.fromIR(raw);
            },
            setFillColorSpace: function(raw) {
                this.current.fillColorSpace = ColorSpace.fromIR(raw);
            },
            setStrokeColor: function() {
                var cs = this.current.strokeColorSpace;
                var rgbColor = cs.getRgb(arguments, 0);
                var color = Util.makeCssRgb(rgbColor);
                this.ctx.strokeStyle = color;
                this.current.strokeColor = color;
            },
            getColorN_Pattern: function(IR, cs) {
                if ("TilingPattern" == IR[0]) {
                    var args = IR[1];
                    var base = cs.base;
                    var color;
                    if (base) {
                        base.numComps;
                        color = base.getRgb(args, 0);
                    }
                    var pattern = new TilingPattern(IR, color, this.ctx, this.objs, this.commonObjs, this.baseTransform);
                } else if ("RadialAxial" == IR[0] || "Dummy" == IR[0]) var pattern = Pattern.shadingFromIR(IR); else error("Unkown IR type " + IR[0]);
                return pattern;
            },
            setStrokeColorN: function() {
                var cs = this.current.strokeColorSpace;
                "Pattern" == cs.name ? this.current.strokeColor = this.getColorN_Pattern(arguments, cs) : this.setStrokeColor.apply(this, arguments);
            },
            setFillColor: function() {
                var cs = this.current.fillColorSpace;
                var rgbColor = cs.getRgb(arguments, 0);
                var color = Util.makeCssRgb(rgbColor);
                this.ctx.fillStyle = color;
                this.current.fillColor = color;
            },
            setFillColorN: function() {
                var cs = this.current.fillColorSpace;
                "Pattern" == cs.name ? this.current.fillColor = this.getColorN_Pattern(arguments, cs) : this.setFillColor.apply(this, arguments);
            },
            setStrokeGray: function() {
                this.current.strokeColorSpace = ColorSpace.singletons.gray;
                var rgbColor = this.current.strokeColorSpace.getRgb(arguments, 0);
                var color = Util.makeCssRgb(rgbColor);
                this.ctx.strokeStyle = color;
                this.current.strokeColor = color;
            },
            setFillGray: function() {
                this.current.fillColorSpace = ColorSpace.singletons.gray;
                var rgbColor = this.current.fillColorSpace.getRgb(arguments, 0);
                var color = Util.makeCssRgb(rgbColor);
                this.ctx.fillStyle = color;
                this.current.fillColor = color;
            },
            setStrokeRGBColor: function() {
                this.current.strokeColorSpace = ColorSpace.singletons.rgb;
                var rgbColor = this.current.strokeColorSpace.getRgb(arguments, 0);
                var color = Util.makeCssRgb(rgbColor);
                this.ctx.strokeStyle = color;
                this.current.strokeColor = color;
            },
            setFillRGBColor: function() {
                this.current.fillColorSpace = ColorSpace.singletons.rgb;
                var rgbColor = this.current.fillColorSpace.getRgb(arguments, 0);
                var color = Util.makeCssRgb(rgbColor);
                this.ctx.fillStyle = color;
                this.current.fillColor = color;
            },
            setStrokeCMYKColor: function() {
                this.current.strokeColorSpace = ColorSpace.singletons.cmyk;
                var color = Util.makeCssCmyk(arguments);
                this.ctx.strokeStyle = color;
                this.current.strokeColor = color;
            },
            setFillCMYKColor: function() {
                this.current.fillColorSpace = ColorSpace.singletons.cmyk;
                var color = Util.makeCssCmyk(arguments);
                this.ctx.fillStyle = color;
                this.current.fillColor = color;
            },
            shadingFill: function(patternIR) {
                var ctx = this.ctx;
                this.save();
                var pattern = Pattern.shadingFromIR(patternIR);
                ctx.fillStyle = pattern.getPattern(ctx, this);
                var inv = ctx.mozCurrentTransformInverse;
                if (inv) {
                    var canvas = ctx.canvas;
                    var width = canvas.width;
                    var height = canvas.height;
                    var bl = Util.applyTransform([ 0, 0 ], inv);
                    var br = Util.applyTransform([ 0, height ], inv);
                    var ul = Util.applyTransform([ width, 0 ], inv);
                    var ur = Util.applyTransform([ width, height ], inv);
                    var x0 = Math.min(bl[0], br[0], ul[0], ur[0]);
                    var y0 = Math.min(bl[1], br[1], ul[1], ur[1]);
                    var x1 = Math.max(bl[0], br[0], ul[0], ur[0]);
                    var y1 = Math.max(bl[1], br[1], ul[1], ur[1]);
                    this.ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
                } else this.ctx.fillRect(-1e10, -1e10, 2e10, 2e10);
                this.restore();
            },
            beginInlineImage: function() {
                error("Should not call beginInlineImage");
            },
            beginImageData: function() {
                error("Should not call beginImageData");
            },
            paintFormXObjectBegin: function(matrix, bbox) {
                this.save();
                this.current.paintFormXObjectDepth++;
                this.baseTransformStack.push(this.baseTransform);
                matrix && isArray(matrix) && 6 == matrix.length && this.transform.apply(this, matrix);
                this.baseTransform = this.ctx.mozCurrentTransform;
                if (bbox && isArray(bbox) && 4 == bbox.length) {
                    var width = bbox[2] - bbox[0];
                    var height = bbox[3] - bbox[1];
                    this.rectangle(bbox[0], bbox[1], width, height);
                    this.clip();
                    this.endPath();
                }
            },
            paintFormXObjectEnd: function() {
                var depth = this.current.paintFormXObjectDepth;
                do this.restore(); while (this.current.paintFormXObjectDepth >= depth);
                this.baseTransform = this.baseTransformStack.pop();
            },
            beginGroup: function(group) {
                this.save();
                var currentCtx = this.ctx;
                group.isolated || info("TODO: Support non-isolated groups.");
                group.knockout && TODO("Support knockout groups.");
                var currentTransform = currentCtx.mozCurrentTransform;
                group.matrix && currentCtx.transform.apply(currentCtx, group.matrix);
                assert(group.bbox, "Bounding box is required.");
                var bounds = Util.getAxialAlignedBoundingBox(group.bbox, currentCtx.mozCurrentTransform);
                var drawnWidth = Math.max(Math.ceil(bounds[2] - bounds[0]), 1);
                var drawnHeight = Math.max(Math.ceil(bounds[3] - bounds[1]), 1);
                var scratchCanvas = CachedCanvases.getCanvas("groupAt" + this.groupLevel, drawnWidth, drawnHeight, true);
                var groupCtx = scratchCanvas.context;
                var offsetX = bounds[0];
                var offsetY = bounds[1];
                groupCtx.translate(-offsetX, -offsetY);
                groupCtx.transform.apply(groupCtx, currentTransform);
                currentCtx.setTransform(1, 0, 0, 1, 0, 0);
                currentCtx.translate(offsetX, offsetY);
                copyCtxState(currentCtx, groupCtx);
                this.ctx = groupCtx;
                this.setGState([ [ "SMask", "None" ], [ "BM", "Normal" ], [ "ca", 1 ], [ "CA", 1 ] ]);
                this.groupStack.push(currentCtx);
                this.groupLevel++;
            },
            endGroup: function() {
                this.groupLevel--;
                var groupCtx = this.ctx;
                this.ctx = this.groupStack.pop();
                "imageSmoothingEnabled" in this.ctx ? this.ctx.imageSmoothingEnabled = false : this.ctx.mozImageSmoothingEnabled = false;
                this.ctx.drawImage(groupCtx.canvas, 0, 0);
                this.restore();
            },
            beginAnnotations: function() {
                this.save();
                this.current = new CanvasExtraState();
            },
            endAnnotations: function() {
                this.restore();
            },
            beginAnnotation: function(rect, transform, matrix) {
                this.save();
                if (rect && isArray(rect) && 4 == rect.length) {
                    var width = rect[2] - rect[0];
                    var height = rect[3] - rect[1];
                    this.rectangle(rect[0], rect[1], width, height);
                    this.clip();
                    this.endPath();
                }
                this.transform.apply(this, transform);
                this.transform.apply(this, matrix);
            },
            endAnnotation: function() {
                this.restore();
            },
            paintJpegXObject: function(objId, w, h) {
                var domImage = this.objs.get(objId);
                domImage || error("Dependent image isn't ready yet");
                this.save();
                var ctx = this.ctx;
                ctx.scale(1 / w, -1 / h);
                ctx.drawImage(domImage, 0, 0, domImage.width, domImage.height, 0, -h, w, h);
                if (this.imageLayer) {
                    var currentTransform = ctx.mozCurrentTransformInverse;
                    var position = this.getCanvasPosition(0, 0);
                    this.imageLayer.appendImage({
                        objId: objId,
                        left: position[0],
                        top: position[1],
                        width: w / currentTransform[0],
                        height: h / currentTransform[3]
                    });
                }
                this.restore();
            },
            paintImageMaskXObject: function(img) {
                var ctx = this.ctx;
                var width = img.width, height = img.height;
                var glyph = this.processingType3;
                if (COMPILE_TYPE3_GLYPHS && glyph && !("compiled" in glyph)) {
                    var MAX_SIZE_TO_COMPILE = 1e3;
                    glyph.compiled = MAX_SIZE_TO_COMPILE >= width && MAX_SIZE_TO_COMPILE >= height ? compileType3Glyph({
                        data: img.data,
                        width: width,
                        height: height
                    }) : null;
                }
                if (glyph && glyph.compiled) {
                    glyph.compiled(ctx);
                    return;
                }
                var maskCanvas = CachedCanvases.getCanvas("maskCanvas", width, height);
                var maskCtx = maskCanvas.context;
                maskCtx.save();
                putBinaryImageData(maskCtx, img);
                maskCtx.globalCompositeOperation = "source-in";
                var fillColor = this.current.fillColor;
                maskCtx.fillStyle = fillColor && fillColor.hasOwnProperty("type") && "Pattern" === fillColor.type ? fillColor.getPattern(maskCtx, this) : fillColor;
                maskCtx.fillRect(0, 0, width, height);
                maskCtx.restore();
                this.paintInlineImageXObject(maskCanvas.canvas);
            },
            paintImageMaskXObjectGroup: function(images) {
                var ctx = this.ctx;
                for (var i = 0, ii = images.length; ii > i; i++) {
                    var image = images[i];
                    var width = image.width, height = image.height;
                    var maskCanvas = CachedCanvases.getCanvas("maskCanvas", width, height);
                    var maskCtx = maskCanvas.context;
                    maskCtx.save();
                    putBinaryImageData(maskCtx, image);
                    maskCtx.globalCompositeOperation = "source-in";
                    var fillColor = this.current.fillColor;
                    maskCtx.fillStyle = fillColor && fillColor.hasOwnProperty("type") && "Pattern" === fillColor.type ? fillColor.getPattern(maskCtx, this) : fillColor;
                    maskCtx.fillRect(0, 0, width, height);
                    maskCtx.restore();
                    ctx.save();
                    ctx.transform.apply(ctx, image.transform);
                    ctx.scale(1, -1);
                    ctx.drawImage(maskCanvas.canvas, 0, 0, width, height, 0, -1, 1, 1);
                    ctx.restore();
                }
            },
            paintImageXObject: function(objId) {
                var imgData = this.objs.get(objId);
                imgData || error("Dependent image isn't ready yet");
                this.paintInlineImageXObject(imgData);
            },
            paintInlineImageXObject: function(imgData) {
                var width = imgData.width;
                var height = imgData.height;
                var ctx = this.ctx;
                this.save();
                ctx.scale(1 / width, -1 / height);
                var currentTransform = ctx.mozCurrentTransformInverse;
                var a = currentTransform[0], b = currentTransform[1];
                var widthScale = Math.max(Math.sqrt(a * a + b * b), 1);
                var c = currentTransform[2], d = currentTransform[3];
                var heightScale = Math.max(Math.sqrt(c * c + d * d), 1);
                var imgToPaint;
                if (imgData instanceof HTMLElement || !imgData.data) imgToPaint = imgData; else {
                    var tmpCanvas = CachedCanvases.getCanvas("inlineImage", width, height);
                    var tmpCtx = tmpCanvas.context;
                    putBinaryImageData(tmpCtx, imgData);
                    imgToPaint = tmpCanvas.canvas;
                }
                var paintWidth = width, paintHeight = height;
                var tmpCanvasId = "prescale1";
                while (widthScale > 2 && paintWidth > 1 || heightScale > 2 && paintHeight > 1) {
                    var newWidth = paintWidth, newHeight = paintHeight;
                    if (widthScale > 2 && paintWidth > 1) {
                        newWidth = Math.ceil(paintWidth / 2);
                        widthScale /= paintWidth / newWidth;
                    }
                    if (heightScale > 2 && paintHeight > 1) {
                        newHeight = Math.ceil(paintHeight / 2);
                        heightScale /= paintHeight / newHeight;
                    }
                    var tmpCanvas = CachedCanvases.getCanvas(tmpCanvasId, newWidth, newHeight);
                    tmpCtx = tmpCanvas.context;
                    tmpCtx.clearRect(0, 0, newWidth, newHeight);
                    tmpCtx.drawImage(imgToPaint, 0, 0, paintWidth, paintHeight, 0, 0, newWidth, newHeight);
                    imgToPaint = tmpCanvas.canvas;
                    paintWidth = newWidth;
                    paintHeight = newHeight;
                    tmpCanvasId = "prescale1" === tmpCanvasId ? "prescale2" : "prescale1";
                }
                ctx.drawImage(imgToPaint, 0, 0, paintWidth, paintHeight, 0, -height, width, height);
                if (this.imageLayer) {
                    var position = this.getCanvasPosition(0, -height);
                    this.imageLayer.appendImage({
                        imgData: imgData,
                        left: position[0],
                        top: position[1],
                        width: width / currentTransform[0],
                        height: height / currentTransform[3]
                    });
                }
                this.restore();
            },
            paintInlineImageXObjectGroup: function(imgData, map) {
                var ctx = this.ctx;
                var w = imgData.width;
                var h = imgData.height;
                var tmpCanvas = CachedCanvases.getCanvas("inlineImage", w, h);
                var tmpCtx = tmpCanvas.context;
                putBinaryImageData(tmpCtx, imgData);
                for (var i = 0, ii = map.length; ii > i; i++) {
                    var entry = map[i];
                    ctx.save();
                    ctx.transform.apply(ctx, entry.transform);
                    ctx.scale(1, -1);
                    ctx.drawImage(tmpCanvas.canvas, entry.x, entry.y, entry.w, entry.h, 0, -1, 1, 1);
                    if (this.imageLayer) {
                        var position = this.getCanvasPosition(entry.x, entry.y);
                        this.imageLayer.appendImage({
                            imgData: imgData,
                            left: position[0],
                            top: position[1],
                            width: w,
                            height: h
                        });
                    }
                    ctx.restore();
                }
            },
            markPoint: function() {},
            markPointProps: function() {},
            beginMarkedContent: function() {},
            beginMarkedContentProps: function() {},
            endMarkedContent: function() {},
            beginCompat: function() {},
            endCompat: function() {},
            consumePath: function() {
                if (this.pendingClip) {
                    if (this.pendingClip == EO_CLIP) if ("mozFillRule" in this.ctx) {
                        this.ctx.mozFillRule = "evenodd";
                        this.ctx.clip();
                        this.ctx.mozFillRule = "nonzero";
                    } else try {
                        this.ctx.clip("evenodd");
                    } catch (ex) {
                        this.ctx.clip();
                    } else this.ctx.clip();
                    this.pendingClip = null;
                }
                this.ctx.beginPath();
            },
            getSinglePixelWidth: function() {
                var inverse = this.ctx.mozCurrentTransformInverse;
                return Math.sqrt(Math.max(inverse[0] * inverse[0] + inverse[1] * inverse[1], inverse[2] * inverse[2] + inverse[3] * inverse[3]));
            },
            getCanvasPosition: function(x, y) {
                var transform = this.ctx.mozCurrentTransform;
                return [ transform[0] * x + transform[2] * y + transform[4], transform[1] * x + transform[3] * y + transform[5] ];
            }
        };
        return CanvasGraphics;
    }();
    PDFJS.disableFontFace = false;
    var FontLoader = {
        insertRule: function(rule) {
            var styleElement = document.getElementById("PDFJS_FONT_STYLE_TAG");
            if (!styleElement) {
                styleElement = document.createElement("style");
                styleElement.id = "PDFJS_FONT_STYLE_TAG";
                document.documentElement.getElementsByTagName("head")[0].appendChild(styleElement);
            }
            var styleSheet = styleElement.sheet;
            styleSheet.insertRule(rule, styleSheet.cssRules.length);
        },
        get loadTestFont() {
            return shadow(this, "loadTestFont", atob("T1RUTwALAIAAAwAwQ0ZGIDHtZg4AAAOYAAAAgUZGVE1lkzZwAAAEHAAAABxHREVGABQAFQAABDgAAAAeT1MvMlYNYwkAAAEgAAAAYGNtYXABDQLUAAACNAAAAUJoZWFk/xVFDQAAALwAAAA2aGhlYQdkA+oAAAD0AAAAJGhtdHgD6AAAAAAEWAAAAAZtYXhwAAJQAAAAARgAAAAGbmFtZVjmdH4AAAGAAAAAsXBvc3T/hgAzAAADeAAAACAAAQAAAAEAALZRFsRfDzz1AAsD6AAAAADOBOTLAAAAAM4KHDwAAAAAA+gDIQAAAAgAAgAAAAAAAAABAAADIQAAAFoD6AAAAAAD6AABAAAAAAAAAAAAAAAAAAAAAQAAUAAAAgAAAAQD6AH0AAUAAAKKArwAAACMAooCvAAAAeAAMQECAAACAAYJAAAAAAAAAAAAAQAAAAAAAAAAAAAAAFBmRWQAwAAuAC4DIP84AFoDIQAAAAAAAQAAAAAAAAAAACAAIAABAAAADgCuAAEAAAAAAAAAAQAAAAEAAAAAAAEAAQAAAAEAAAAAAAIAAQAAAAEAAAAAAAMAAQAAAAEAAAAAAAQAAQAAAAEAAAAAAAUAAQAAAAEAAAAAAAYAAQAAAAMAAQQJAAAAAgABAAMAAQQJAAEAAgABAAMAAQQJAAIAAgABAAMAAQQJAAMAAgABAAMAAQQJAAQAAgABAAMAAQQJAAUAAgABAAMAAQQJAAYAAgABWABYAAAAAAAAAwAAAAMAAAAcAAEAAAAAADwAAwABAAAAHAAEACAAAAAEAAQAAQAAAC7//wAAAC7////TAAEAAAAAAAABBgAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAD/gwAyAAAAAQAAAAAAAAAAAAAAAAAAAAABAAQEAAEBAQJYAAEBASH4DwD4GwHEAvgcA/gXBIwMAYuL+nz5tQXkD5j3CBLnEQACAQEBIVhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYAAABAQAADwACAQEEE/t3Dov6fAH6fAT+fPp8+nwHDosMCvm1Cvm1DAz6fBQAAAAAAAABAAAAAMmJbzEAAAAAzgTjFQAAAADOBOQpAAEAAAAAAAAADAAUAAQAAAABAAAAAgABAAAAAAAAAAAD6AAAAAAAAA=="));
        },
        loadTestFontId: 0,
        loadingContext: {
            requests: [],
            nextRequestId: 0
        },
        isSyncFontLoadingSupported: function() {
            if (isWorker) return false;
            var userAgent = window.navigator.userAgent;
            var m = /Mozilla\/5.0.*?rv:(\d+).*? Gecko/.exec(userAgent);
            if (m && m[1] >= 14) return true;
            return false;
        }(),
        bind: function(fonts, callback) {
            assert(!isWorker, "bind() shall be called from main thread");
            var rules = [], fontsToLoad = [];
            for (var i = 0, ii = fonts.length; ii > i; i++) {
                var font = fonts[i];
                if (font.attached || false === font.loading) continue;
                font.attached = true;
                var rule = font.bindDOM();
                if (rule) {
                    rules.push(rule);
                    fontsToLoad.push(font);
                }
            }
            var request = FontLoader.queueLoadingCallback(callback);
            rules.length > 0 && !this.isSyncFontLoadingSupported ? FontLoader.prepareFontLoadEvent(rules, fontsToLoad, request) : request.complete();
        },
        queueLoadingCallback: function(callback) {
            function LoadLoader_completeRequest() {
                assert(!request.end, "completeRequest() cannot be called twice");
                request.end = Date.now();
                while (context.requests.length > 0 && context.requests[0].end) {
                    var otherRequest = context.requests.shift();
                    setTimeout(otherRequest.callback, 0);
                }
            }
            var context = FontLoader.loadingContext;
            var requestId = "pdfjs-font-loading-" + context.nextRequestId++;
            var request = {
                id: requestId,
                complete: LoadLoader_completeRequest,
                callback: callback,
                started: Date.now()
            };
            context.requests.push(request);
            return request;
        },
        prepareFontLoadEvent: function(rules, fonts, request) {
            function int32(data, offset) {
                return data.charCodeAt(offset) << 24 | data.charCodeAt(offset + 1) << 16 | data.charCodeAt(offset + 2) << 8 | 255 & data.charCodeAt(offset + 3);
            }
            function string32(value) {
                return String.fromCharCode(255 & value >> 24) + String.fromCharCode(255 & value >> 16) + String.fromCharCode(255 & value >> 8) + String.fromCharCode(255 & value);
            }
            function spliceString(s, offset, remove, insert) {
                var chunk1 = data.substr(0, offset);
                var chunk2 = data.substr(offset + remove);
                return chunk1 + insert + chunk2;
            }
            function isFontReady(name, callback) {
                called++;
                if (called > 30) {
                    warn("Load test font never loaded.");
                    callback();
                    return;
                }
                ctx.font = "30px " + name;
                ctx.fillText(".", 0, 20);
                var imageData = ctx.getImageData(0, 0, 1, 1);
                if (imageData.data[3] > 0) {
                    callback();
                    return;
                }
                setTimeout(isFontReady.bind(null, name, callback));
            }
            var i, ii;
            var canvas = document.createElement("canvas");
            canvas.width = 1;
            canvas.height = 1;
            var ctx = canvas.getContext("2d");
            var called = 0;
            var loadTestFontId = "lt" + Date.now() + this.loadTestFontId++;
            var data = this.loadTestFont;
            var COMMENT_OFFSET = 976;
            data = spliceString(data, COMMENT_OFFSET, loadTestFontId.length, loadTestFontId);
            var CFF_CHECKSUM_OFFSET = 16;
            var XXXX_VALUE = 1482184792;
            var checksum = int32(data, CFF_CHECKSUM_OFFSET);
            for (i = 0, ii = loadTestFontId.length - 3; ii > i; i += 4) checksum = 0 | checksum - XXXX_VALUE + int32(loadTestFontId, i);
            loadTestFontId.length > i && (checksum = 0 | checksum - XXXX_VALUE + int32(loadTestFontId + "XXX", i));
            data = spliceString(data, CFF_CHECKSUM_OFFSET, 4, string32(checksum));
            var url = "url(data:font/opentype;base64," + btoa(data) + ");";
            var rule = '@font-face { font-family:"' + loadTestFontId + '";src:' + url + "}";
            FontLoader.insertRule(rule);
            var names = [];
            for (i = 0, ii = fonts.length; ii > i; i++) names.push(fonts[i].loadedName);
            names.push(loadTestFontId);
            var div = document.createElement("div");
            div.setAttribute("style", "visibility: hidden;width: 10px; height: 10px;position: absolute; top: 0px; left: 0px;");
            for (i = 0, ii = names.length; ii > i; ++i) {
                var span = document.createElement("span");
                span.textContent = "Hi";
                span.style.fontFamily = names[i];
                div.appendChild(span);
            }
            document.body.appendChild(div);
            isFontReady(loadTestFontId, function() {
                document.body.removeChild(div);
                request.complete();
            });
        }
    };
    var FontFace = function() {
        function FontFace() {
            this.compiledGlyphs = {};
            if (1 === arguments.length) {
                var data = arguments[0];
                for (var i in data) this[i] = data[i];
                return;
            }
        }
        FontFace.prototype = {
            bindDOM: function() {
                if (!this.data) return null;
                if (PDFJS.disableFontFace) {
                    this.disableFontFace = true;
                    return null;
                }
                var data = bytesToString(this.data);
                var fontName = this.loadedName;
                var url = "url(data:" + this.mimetype + ";base64," + window.btoa(data) + ");";
                var rule = '@font-face { font-family:"' + fontName + '";src:' + url + "}";
                FontLoader.insertRule(rule);
                PDFJS.pdfBug && "FontInspector" in globalScope && globalScope["FontInspector"].enabled && globalScope["FontInspector"].fontAdded(this, url);
                return rule;
            },
            getPathGenerator: function(objs, character) {
                if (!(character in this.compiledGlyphs)) {
                    var js = objs.get(this.loadedName + "_path_" + character);
                    this.compiledGlyphs[character] = new Function("c", "size", js);
                }
                return this.compiledGlyphs[character];
            }
        };
        return FontFace;
    }();
}).call("undefined" == typeof window ? this : window);

PDFJS.workerSrc || "undefined" == typeof document || (PDFJS.workerSrc = function() {
    "use strict";
    var scriptTagContainer = document.body || document.getElementsByTagName("head")[0];
    var pdfjsSrc = scriptTagContainer.lastChild.src;
    return pdfjsSrc && pdfjsSrc.replace(/\.js$/i, ".worker.js");
}());