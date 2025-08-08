// Video streaming functionality
document.addEventListener('DOMContentLoaded', function() {
    const video = document.getElementById('video');
    const status = document.getElementById('status');
    
    // Check if HLS is supported
    if (Hls.isSupported()) {
        const hls = new Hls();
        
        // Load the HLS stream
        hls.loadSource('/src/video/test.m3u8');
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, function() {
            status.className = 'status success';
            status.textContent = '✅ Video loaded successfully! Click play to start streaming.';
            console.log('HLS manifest loaded');
        });
        
        hls.on(Hls.Events.ERROR, function(event, data) {
            console.error('HLS Error:', data);
            status.className = 'status error';
            status.textContent = '❌ Error loading video. Check console for details.';
        });
        
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // For Safari which has native HLS support
        video.src = '/src/video/test.m3u8';
        video.addEventListener('loadedmetadata', function() {
            status.className = 'status success';
            status.textContent = '✅ Video loaded successfully! Click play to start streaming.';
        });
    } else {
        status.className = 'status error';
        status.textContent = '❌ HLS is not supported in this browser.';
    }
    
    // Add video event listeners for better status updates
    video.addEventListener('play', function() {
        status.className = 'status success';
        status.textContent = '▶️ Video is now playing!';
    });
    
    video.addEventListener('pause', function() {
        status.className = 'status info';
        status.textContent = '⏸️ Video paused.';
    });
    
    video.addEventListener('error', function() {
        status.className = 'status error';
        status.textContent = '❌ Video playback error occurred.';
    });
    
    // Add loading state
    video.addEventListener('loadstart', function() {
        status.className = 'status info';
        status.textContent = '🔄 Loading video stream...';
    });
    
    // Add buffering state
    video.addEventListener('waiting', function() {
        status.className = 'status info';
        status.textContent = '⏳ Buffering video...';
    });
    
    // Add canplay state
    video.addEventListener('canplay', function() {
        status.className = 'status success';
        status.textContent = '✅ Video ready to play!';
    });
});
