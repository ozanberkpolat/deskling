#!/bin/sh
# Final render: scripts/final.sh v1
# Remotion runs in the render container (the host lacks Chromium's libs), ffmpeg on the host.
#   1. 240 fps master, 4:4:4, muted     2. tmix 4 subframes -> 60 fps motion blur, BT.601 limited -> BT.709
#   3. muted H.264 loop (the page), VP9 WebM, poster
set -e
ver=$1
out=out/final/$ver; mkdir -p "$out"
master=$out/master.mp4; blurred=$out/blurred.mov
FF=$(uv run --quiet --with imageio-ffmpeg python3 -c "import imageio_ffmpeg as i; print(i.get_ffmpeg_exe())")

scripts/in-docker.sh npx remotion render src/index.ts Deskling "$master" --props '{"fps":240}' \
  --codec h264 --crf 8 --pixel-format yuv444p --image-format png --muted --concurrency 2 --log error

"$FF" -v error -y -i "$master" \
  -vf "tmix=frames=4:weights='1 1 1 1',select='not(mod(n+1\,4))',setpts=N/(60*TB),scale=in_range=tv:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv444p10le" \
  -r 60 -c:v prores_ks -profile:v 4444 -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv "$blurred"

"$FF" -v error -y -i "$blurred" -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
  -x264-params colorprim=bt709:transfer=bt709:colormatrix=bt709 -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv \
  -movflags +faststart -an -t 20 "$out/deskling-film.mp4"
"$FF" -v error -y -i "$blurred" -c:v libvpx-vp9 -b:v 0 -crf 34 -row-mt 1 -pix_fmt yuv420p \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv -an -t 20 "$out/deskling-film.webm"
"$FF" -v error -y -ss 18.3 -i "$blurred" -frames:v 1 -q:v 2 "$out/poster.jpg"
rm -f "$master" "$blurred"
ls -la "$out"
