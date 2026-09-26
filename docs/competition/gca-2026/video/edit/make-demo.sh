#!/usr/bin/env bash
set -euo pipefail

EDIT_DIR="$(cd "$(dirname "$0")" && pwd)"
ASSET_DIR="$(cd "$EDIT_DIR/../../assets" && pwd)"
FFMPEG="${FFMPEG:-ffmpeg}"
FFPROBE="${FFPROBE:-ffprobe}"

mkdir -p "$EDIT_DIR/audio" "$EDIT_DIR/scenes" "$EDIT_DIR/verify"

images=(
  "$ASSET_DIR/01-main-visual-1920x1080.jpg"
  "$ASSET_DIR/02-home-1920x1080.jpg"
  "$ASSET_DIR/03-feed-1920x1080.jpg"
  "$ASSET_DIR/04-detail-1920x1080.jpg"
  "$ASSET_DIR/04-detail-1920x1080.jpg"
  "$ASSET_DIR/05-score-1920x1080.jpg"
  "$ASSET_DIR/01-main-visual-1920x1080.jpg"
)

texts=(
  "每天，手機裡都有用不到的優惠券默默過期。想分享，卻常遇到資訊散落、條碼被陌生人截走，也無法把票券交給真正需要的人。"
  "CouponShare 是一個完全免費的票券分享平台。目前已有超過三萬五千名成員，累計分享超過七千五百張票券，成功讓超過四千八百張券找到下一位使用者。"
  "登入後，可以依分類、贈送方式、券內容與期限快速篩選。即將到期的票券會集中顯示，讓社群優先救回快被浪費的好康。"
  "在票券詳情頁，申請者先說明需求。送出申請不代表搶到票券，而是由持有者親自選人，避免先搶先贏，也保留分享者的選擇權。"
  "安全是交換流程的核心。條碼不會出現在公開頁面；只有獲選者能在短效授權期間查看。雙方確認後才同時亮碼，降低截圖外流與重複兌換風險。"
  "每次成功贈送、交換、好評與感謝，都會累積貢獻值。等級、徽章、申請額度、評價與檢舉機制，讓先分享再領取成為可以長久循環的社群規則。"
  "CouponShare 想做的很單純：把我剛好用不到，送到我剛好需要的手上。讓好康不再過期，也讓每一次分享，都成為下一次互助的開始。"
)

captions=(
  "優惠券不該默默過期\n分享也不該冒著條碼外流的風險"
  "35,427 名成員｜7,509 張分享\n4,814 張成功送出"
  "多條件探索＋即將到期專區\n讓真正需要的人更快找到票券"
  "申請者說明需求，由持有者親自選人\n不是先搶先贏"
  "條碼不公開｜短效授權\n雙方確認才亮碼"
  "貢獻值、等級、徽章、評價與檢舉\n建立可長久運作的信任循環"
  "把「我剛好用不到」\n送到「我剛好需要」手上"
)

format_srt_time() {
  python3 - "$1" <<'PY'
import sys
t = float(sys.argv[1])
hours = int(t // 3600)
t -= hours * 3600
minutes = int(t // 60)
t -= minutes * 60
seconds = int(t)
millis = int(round((t - seconds) * 1000))
if millis == 1000:
    seconds += 1
    millis = 0
print(f"{hours:02d}:{minutes:02d}:{seconds:02d},{millis:03d}")
PY
}

: > "$EDIT_DIR/master.srt"
: > "$EDIT_DIR/concat.txt"
offset=0

for i in "${!texts[@]}"; do
  n=$((i + 1))
  audio="$EDIT_DIR/audio/scene_${n}.aiff"
  scene="$EDIT_DIR/scenes/scene_${n}.mp4"
  say -v Meijia -r 176 -o "$audio" -- "${texts[$i]}"
  speech_duration="$($FFPROBE -v error -show_entries format=duration -of csv=p=0 "$audio")"
  duration="$(python3 - "$speech_duration" <<'PY'
import sys
print(f"{float(sys.argv[1]) + 1.15:.3f}")
PY
)"
  fade_out="$(python3 - "$duration" <<'PY'
import sys
print(f"{max(0.0, float(sys.argv[1]) - 0.45):.3f}")
PY
)"
  frames="$(python3 - "$duration" <<'PY'
import sys
print(int(round(float(sys.argv[1]) * 30)))
PY
)"

  "$FFMPEG" -y -hide_banner -loglevel error \
    -loop 1 -i "${images[$i]}" -i "$audio" \
    -filter_complex "[0:v]scale=2016:1134,crop=1920:1080,zoompan=z='min(zoom+0.00018,1.045)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1920x1080:fps=30,fade=t=in:st=0:d=0.35,fade=t=out:st=${fade_out}:d=0.45,format=yuv420p[v];[1:a]apad=pad_dur=1.15,afade=t=in:st=0:d=0.03,afade=t=out:st=${fade_out}:d=0.03,aresample=48000[a]" \
    -map '[v]' -map '[a]' -t "$duration" -c:v libx264 -preset medium -crf 18 \
    -c:a aac -b:a 160k -movflags +faststart "$scene"

  printf "file '%s'\n" "$scene" >> "$EDIT_DIR/concat.txt"
  end="$(python3 - "$offset" "$duration" <<'PY'
import sys
print(f"{float(sys.argv[1]) + float(sys.argv[2]):.3f}")
PY
)"
  {
    printf '%d\n' "$n"
    printf '%s --> %s\n' "$(format_srt_time "$offset")" "$(format_srt_time "$end")"
    printf '%b\n\n' "${captions[$i]}"
  } >> "$EDIT_DIR/master.srt"
  offset="$end"
done

"$FFMPEG" -y -hide_banner -loglevel error -f concat -safe 0 -i "$EDIT_DIR/concat.txt" -c copy "$EDIT_DIR/preview-no-captions.mp4"

font="/System/Library/Fonts/STHeiti Medium.ttc"
subtitle_style="FontName=Heiti TC,FontSize=11,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H70000000,BackColour=&H80000000,BorderStyle=3,Outline=1,Shadow=0,Alignment=2,MarginV=28"
"$FFMPEG" -y -hide_banner -loglevel error -i "$EDIT_DIR/preview-no-captions.mp4" \
  -vf "subtitles='$EDIT_DIR/master.srt':fontsdir='$(dirname "$font")':force_style='$subtitle_style'" \
  -c:v libx264 -preset slow -crf 18 -c:a copy -movflags +faststart "$EDIT_DIR/final.mp4"

"$FFMPEG" -y -hide_banner -loglevel error -ss 0.5 -i "$EDIT_DIR/final.mp4" -frames:v 1 "$EDIT_DIR/verify/start.jpg"
mid="$(python3 - "$offset" <<'PY'
import sys
print(float(sys.argv[1]) / 2)
PY
)"
"$FFMPEG" -y -hide_banner -loglevel error -ss "$mid" -i "$EDIT_DIR/final.mp4" -frames:v 1 "$EDIT_DIR/verify/middle.jpg"
"$FFMPEG" -y -hide_banner -loglevel error -sseof -1.5 -i "$EDIT_DIR/final.mp4" -frames:v 1 "$EDIT_DIR/verify/end.jpg"

"$FFPROBE" -v error -show_entries format=duration,size -show_entries stream=index,codec_name,width,height,r_frame_rate -of json "$EDIT_DIR/final.mp4"
cp "$EDIT_DIR/final.mp4" "$EDIT_DIR/../couponshare-gca-demo.mp4"
