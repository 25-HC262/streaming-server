import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const videoPath = './src/video/test.mp4';
const outputPath = './src/video/test.m3u8';

ffmpeg(videoPath, { timeout: 432000 }).addOptions([
    '-profile:v baseline',
    '-level 3.0',
    '-start_number 0',
    '-hls_time 10', // 10 seconds per chunk
    '-hls_list_size 0',
    '-f hls' // output format
]).output(outputPath).on('end', () => {
    console.log('Video has been converted successfully');
}).run();

// export default ffmpeg;