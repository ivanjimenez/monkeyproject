function Controller() {
    require("alloy/controllers/BaseController").apply(this, Array.prototype.slice.call(arguments));
    this.__controllerPath = "index";
    arguments[0] ? arguments[0]["__parentSymbol"] : null;
    arguments[0] ? arguments[0]["$model"] : null;
    arguments[0] ? arguments[0]["__itemTemplate"] : null;
    var $ = this;
    var exports = {};
    $.__views.index = Ti.UI.createWindow({
        backgroundColor: "white",
        id: "index"
    });
    $.__views.index && $.addTopLevelView($.__views.index);
    $.__views.webview = Ti.UI.createWebView({
        top: 0,
        width: Ti.UI.FILL,
        height: 200,
        id: "webview",
        url: "/web/viewer.html"
    });
    $.__views.index.add($.__views.webview);
    $.__views.btnStart = Ti.UI.createButton({
        title: "Start/Stop",
        top: 200,
        width: 200,
        height: 40,
        left: 0,
        id: "btnStart"
    });
    $.__views.index.add($.__views.btnStart);
    $.__views.btnPause = Ti.UI.createButton({
        title: "Pause/Resume",
        top: 200,
        height: 40,
        width: 200,
        left: 202,
        enabled: false,
        id: "btnPause"
    });
    $.__views.index.add($.__views.btnPause);
    exports.destroy = function() {};
    _.extend($, $.__views);
    Ti.Gesture.addEventListener("orientationchange", function() {
        Ti.Android.currentActivity.setRequestedOrientation(Ti.Android.SCREEN_ORIENTATION_LANDSCAPE);
    });
    var audioPlayer = Ti.Media.createAudioPlayer({
        url: "/audio.mp3",
        allowBackground: true
    });
    $.index.open();
    $.btnStart.addEventListener("click", function() {
        if (audioPlayer.playing || audioPlayer.paused) {
            audioPlayer.stop();
            $.btnPause.enabled = false;
            audioPlayer.release();
        } else {
            audioPlayer.start();
            $.btnPause.enabled = true;
        }
    });
    $.btnPause.addEventListener("click", function() {
        audioPlayer.paused ? audioPlayer.start() : audioPlayer.pause();
    });
    audioPlayer.addEventListener("change", function(e) {
        Ti.API.info("Tiempo de audio: " + Math.round(e.progress) + "ms");
    });
    audioPlayer.addEventListener("change", function(e) {
        Ti.API.info("Estado: " + e.description + " (" + e.state + ")");
    });
    _.extend($, exports);
}

var Alloy = require("alloy"), Backbone = Alloy.Backbone, _ = Alloy._;

module.exports = Controller;