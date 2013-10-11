if (Ti.Platform.osname == 'android'){
            Ti.Gesture.addEventListener('orientationchange', function(e) {
 
              Ti.Android.currentActivity.setRequestedOrientation(Ti.Android.SCREEN_ORIENTATION_LANDSCAPE);
            });
        }

var audioPlayer = Ti.Media.createAudioPlayer({
	url : '/audio.mp3',
	allowBackground: true
});

$.index.open();

$.btnStart.addEventListener('click', function(){
	if (audioPlayer.playing || audioPlayer.paused)
    {

		audioPlayer.stop();
		$.btnPause.enabled = false;

		if (Ti.Platform.name === 'android')
		{
			audioPlayer.release();
		}			
	}
	else
	{
		audioPlayer.start();
		$.btnPause.enabled = true;
	}
});

$.btnPause.addEventListener('click', function(){

	if (audioPlayer.paused)
	{
		audioPlayer.start();
	}
	else {
		audioPlayer.pause();
	}
});

audioPlayer.addEventListener('change', function(e){
	Ti.API.info('Tiempo de audio: ' + Math.round(e.progress) + 'ms' );
});

audioPlayer.addEventListener('change', function(e){
	Ti.API.info('Estado: ' + e.description + ' (' + e.state + ')');
});