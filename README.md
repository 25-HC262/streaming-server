# Video Streaming Server with Left-Right Inversion

A powerful video streaming server that supports both real-time video mirroring and FFmpeg-based video inversion.

## Features

- **Real-time Video Mirroring**: Instantly flip video horizontally using CSS transforms
- **FFmpeg Video Inversion**: Process video files to create permanently inverted versions
- **HLS Streaming**: Support for HTTP Live Streaming
- **WebSocket Live Streaming**: Real-time video streaming capabilities
- **Multiple Video Sources**: Switch between normal and inverted video streams

## Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd streaming-server
```

2. Install dependencies:
```bash
npm install
```

## Usage

### 1. Basic Video Conversion

Convert your video to HLS format:
```bash
npm run ffmpeg
```

This creates `./src/video/test.m3u8` from `./src/video/test.mp4`.

### 2. Create Inverted Video

Create a permanently inverted (left-right flipped) version of your video:
```bash
npm run ffmpeg:invert
```

This creates `./src/video/test_inverted.m3u8`.

### 3. Create Both Versions

Create both normal and inverted versions:
```bash
npm run ffmpeg:both
```

### 4. Start the Streaming Server

```bash
npm start
```

The server will start on `http://localhost:3000`.

## Video Inversion Methods

### Method 1: Real-time CSS Mirroring (Recommended for live streaming)

- **Pros**: Instant, no processing delay, works with any video source
- **Cons**: Temporary, requires client-side processing
- **Use case**: Live streaming, real-time mirroring

Click the "🔄 Mirror Video (Left-Right)" button to instantly flip the video horizontally.

### Method 2: FFmpeg Video Processing

- **Pros**: Permanent, better performance, works offline
- **Cons**: Requires processing time, creates separate files
- **Use case**: Pre-recorded videos, permanent inversion

Use the video source selector to switch between normal and inverted video streams.

## File Structure

```
streaming-server/
├── src/
│   ├── video/
│   │   ├── test.mp4          # Original video file
│   │   ├── test.m3u8         # Normal HLS stream
│   │   └── test_inverted.m3u8 # Inverted HLS stream
│   ├── app.js                # Main server
│   ├── ffmpeg.js             # Video processing
│   ├── client.html           # Web interface
│   ├── script.js             # Client-side logic
│   └── app.css               # Styles
├── package.json
└── README.md
```

## API Endpoints

- `GET /` - Main video player interface
- `GET /src/video/*.m3u8` - HLS manifest files
- `GET /src/video/*.ts` - HLS video segments
- `WS /stream` - WebSocket endpoint for live streaming

## WebSocket Message Types

- `start_stream` - Begin streaming
- `video_chunk` - Video data chunk
- `stop_stream` - Stop streaming
- `subscribe` - Subscribe to a stream
- `unsubscribe` - Unsubscribe from a stream

## Browser Support

- **HLS**: Modern browsers with HLS.js support
- **WebSocket**: All modern browsers
- **CSS Transforms**: All modern browsers

## Troubleshooting

### Video not loading?
1. Ensure you've run `npm run ffmpeg` first
2. Check that `./src/video/test.mp4` exists
3. Verify the video file is valid

### Inverted video not working?
1. Run `npm run ffmpeg:invert` to create the inverted version
2. Check browser console for errors
3. Ensure HLS.js is loaded correctly

### Performance issues?
- Use CSS mirroring for real-time needs
- Use FFmpeg inversion for pre-recorded content
- Consider video resolution and bitrate

## Dependencies

- **fluent-ffmpeg**: FFmpeg wrapper for Node.js
- **@ffmpeg-installer/ffmpeg**: FFmpeg binary installer
- **express**: Web framework
- **hls-server**: HLS streaming server
- **ws**: WebSocket implementation

## License

ISC

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Support

For issues and questions, please check the browser console for error messages and refer to the troubleshooting section above.

