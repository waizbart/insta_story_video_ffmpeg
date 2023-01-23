import { exec, execSync } from 'child_process'
import moment from 'moment'
import editly from 'editly'
import fs from 'fs'

const video = "video.MP4";
const audio = "audio.mp3";

const outputVideo = "videos/video_out.mp4";
const outputAudio = "audios/audio_out.mp3";

const vNormal = 5;  // tempo de video velocidade normal
const vFast = 5; // tempo de video velocidade rápida
const vSlow = 5; // tempo de video camera lenta
const cFast = 1.3;  // velocidade da camera rapida 2X
const cSlow = 0.5; // 50% de velocidade

const fadeInTime = 7; // tempo de fade in
const fadeOutTime = 5; // tempo de fade out

exec('ffprobe -show_streams ' + video, (error, stdout, stderr) => {
    if (error) {
        console.error(`error: ${error.message}`);
        return;
    }

    let duration;

    if (stderr) {
        duration = stderr.slice(stderr.search("Duration: ") + 10, stderr.search("Duration: ") + 21);
    } else {
        duration = stdout.slice(stdout.search("Duration: ") + 10, stdout.search("Duration: ") + 21);
    }

    let durationFormat = moment(duration, "hh:mm:ss").seconds() + moment(duration, "hh:mm:ss").minutes() * 60 + moment(duration, "hh:mm:ss").hours() * 3600;

    const clips = [
        vNormal > 0 && { duration: vNormal, layers: [{ type: 'video', path: video, cutFrom: 0, cutTo: vNormal }] },
        vSlow > 0 && { duration: vSlow/cSlow, layers: [{ type: 'video', path: video, cutFrom: vNormal > 0 ? vNormal : 0, cutTo: vFast > 0 ? vNormal + vSlow : durationFormat }] },
        vFast > 0 && { duration: (durationFormat - vNormal - vSlow)/cFast, layers: [{ type: 'video', path: video, cutFrom: vNormal + vSlow, cutTo: durationFormat }] },
    ].filter(Boolean)

    console.log(clips, durationFormat)

    editly({
        outPath: './tmp/speed.mp4',
        defaults: {
            transition: null,
        },
        clips,
    }).then(() => {
        execSync(`ffmpeg -y -i tmp/speed.mp4 -map 0 -c copy -f segment -segment_time 10 -reset_timestamps 1 tmp/video_%03d.mp4`)

        let filenames = fs.readdirSync('tmp')

        filenames.forEach(async (filename) => {
            if (filename != 'speed.mp4' && !filename.includes('_reversed'))
                execSync(`ffmpeg -y -i tmp/${filename} -vf reverse tmp/${filename}_reversed.mp4`)
        })

        const filenamesReversed = fs.readdirSync('tmp').filter(filename => filename.includes('_reversed')).reverse()

        fs.appendFileSync('tmp/filenames.txt', `file 'speed.mp4'\n`);

        //salva nomes dos arquivos reversos em um arquivo txt
        filenamesReversed.forEach(async (filename, index) => {
            fs.appendFileSync('tmp/filenames.txt', `file '${filename}'\n`);
        })

        execSync(`ffmpeg -y -f concat -safe 0 -i tmp/filenames.txt -c copy boomerang.mp4`)

        //limpa pasta tmp
        filenames = fs.readdirSync('tmp')
        filenames.forEach(async (filename, index) => {
            fs.unlinkSync(`tmp/${filename}`)
        })


        exec('ffprobe -show_streams ' + 'boomerang.mp4', (error, stdout, stderr) => {
            if (error) {
                console.error(`error: ${error.message}`);
                return;
            }

            let duration;

            if (stderr) {
                duration = stderr.slice(stderr.search("Duration: ") + 10, stderr.search("Duration: ") + 21);
            } else {
                duration = stdout.slice(stdout.search("Duration: ") + 10, stdout.search("Duration: ") + 21);
            }

            let durationFormat = moment(duration, "hh:mm:ss").seconds() + moment(duration, "hh:mm:ss").minutes() * 60 + moment(duration, "hh:mm:ss").hours() * 3600;

            execSync(`ffmpeg -ss 0 -t ${durationFormat} -y -i ${audio} audios/audio-cortado.mp3`)

            const ffmpegComandVideo =
                `ffmpeg -y -i 'boomerang.mp4' -vf "fade=t=in:st=0:d=${fadeInTime}, fade=t=out:st=${durationFormat - fadeOutTime}:d=${fadeOutTime}" -c:a copy ${outputVideo}`;

            const ffmpegComandAudio =
                `ffmpeg -y -i audios/audio-cortado.mp3 -af "afade=t=in:st=0:d=${fadeInTime}, afade=t=out:st=${durationFormat - fadeOutTime}:d=${fadeOutTime}" ${outputAudio}`;

            execSync(ffmpegComandVideo)
            execSync(ffmpegComandAudio)

            execSync(`ffmpeg -y -i ${outputVideo} -i ${outputAudio} -c:v copy -map 0:v:0 -map 1:a:0 videos_results/video.mp4`)
        });
    })
})
